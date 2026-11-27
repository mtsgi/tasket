package com.mtsgi.tasket

import java.time.Instant
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Health Connect 同期・競合解決・ページネーション計算の純粋ロジックヘルパー
 * Android フレームワークや HealthConnectClient 実体に依存せず単体テスト可能な計算を提供する
 */
object HealthConnectSyncHelper {

    const val DEFAULT_PAGE_SIZE = 500
    const val DEFAULT_MAX_PAGES = 20

    enum class PaginationStopReason {
        COMPLETED,
        MAX_PAGES_REACHED,
        DUPLICATE_PAGE_TOKEN
    }

    data class PaginatedReadResult<T>(
        val records: List<T>,
        val isComplete: Boolean,
        val stopReason: PaginationStopReason,
        val pagesRead: Int
    )

    data class HeartRateSampleMeta(
        val time: Instant,
        val beatsPerMinute: Long,
        val dataOriginPackage: String
    )

    data class HeartRateDailySummary(
        val averageBpm: Int?,
        val externalAverageBpm: Int?,
        val tasketAverageBpm: Int?,
        val hasExternalSamples: Boolean,
        val maxTasketVersion: Long
    )

    data class SleepRecordMeta(
        val id: String,
        val clientRecordId: String?,
        val clientRecordVersion: Long,
        val dataOriginPackage: String,
        val startTime: Instant,
        val endTime: Instant
    )

    data class StaleSleepCleanupPlan(
        val recordIdsToDelete: List<String>,
        val clientRecordIdsToDelete: List<String>
    )

    sealed class AdditiveWriteAction {
        data class UpsertDelta(val deltaValue: Double) : AdditiveWriteAction()
        object DeleteTasketRecord : AdditiveWriteAction()
    }

    /**
     * Upsert 用の単調増加 clientRecordVersion を算出 (P1-1)
     * 同一日の再編集・アプリ再起動・バックアップ復元・時計の微小なズレでも必ず既存バージョンを上回る値を返す
     */
    fun computeNextClientRecordVersion(
        nowEpochMillis: Long,
        requestedVersion: Long = 0L,
        existingMaxVersion: Long = 0L
    ): Long {
        return maxOf(
            nowEpochMillis,
            requestedVersion + 1L,
            existingMaxVersion + 1L,
            1L
        )
    }

    /**
     * pageToken を用いた全ページ取得ループ（完了ステータス付き） (P2-7, Review #3)
     * - nextPageToken が null または空文字 "" の場合に COMPLETED として正常終了
     * - 同一トークンの再出現時は DUPLICATE_PAGE_TOKEN（isComplete = false）
     * - maxPages 到達時にまだ nextToken が残っている場合は MAX_PAGES_REACHED（isComplete = false）
     */
    suspend fun <T> readPaginatedRecordsWithStatus(
        maxPages: Int = DEFAULT_MAX_PAGES,
        fetchPage: suspend (pageToken: String?) -> Pair<List<T>, String?>
    ): PaginatedReadResult<T> {
        if (maxPages <= 0) {
            return PaginatedReadResult(
                records = emptyList(),
                isComplete = false,
                stopReason = PaginationStopReason.MAX_PAGES_REACHED,
                pagesRead = 0
            )
        }
        val allRecords = mutableListOf<T>()
        val seenTokens = mutableSetOf<String>()
        var currentToken: String? = null
        var pageCount = 0

        while (pageCount < maxPages) {
            val (records, nextToken) = fetchPage(currentToken)
            allRecords.addAll(records)
            pageCount++

            if (nextToken.isNullOrEmpty()) {
                return PaginatedReadResult(
                    records = allRecords,
                    isComplete = true,
                    stopReason = PaginationStopReason.COMPLETED,
                    pagesRead = pageCount
                )
            }
            if (!seenTokens.add(nextToken)) {
                return PaginatedReadResult(
                    records = allRecords,
                    isComplete = false,
                    stopReason = PaginationStopReason.DUPLICATE_PAGE_TOKEN,
                    pagesRead = pageCount
                )
            }
            currentToken = nextToken
        }

        return PaginatedReadResult(
            records = allRecords,
            isComplete = false,
            stopReason = PaginationStopReason.MAX_PAGES_REACHED,
            pagesRead = pageCount
        )
    }

    /**
     * pageToken を用いた全ページ取得ループ
     * 最大ページ数到達やトークン重複により全件取得できなかった場合は例外を送出し、
     * 不完全な取得結果が正常値や差分書き込みの基準値として扱われることを防止する (Review #3)
     */
    suspend fun <T> readPaginatedRecords(
        maxPages: Int = DEFAULT_MAX_PAGES,
        fetchPage: suspend (pageToken: String?) -> Pair<List<T>, String?>
    ): List<T> {
        val result = readPaginatedRecordsWithStatus(maxPages, fetchPage)
        if (!result.isComplete) {
            throw IllegalStateException(
                "Incomplete paginated read: ${result.stopReason} after ${result.pagesRead} pages"
            )
        }
        return result.records
    }

    /**
     * 当日 [startOfDay, endOfDay) 内のサンプルのみを対象に心拍数平均および由来別情報を算出 (P1-3, P2-7)
     */
    fun computeDailyHeartRateSummary(
        samples: List<HeartRateSampleMeta>,
        startOfDay: Instant,
        endOfDay: Instant,
        myPackageName: String,
        maxTasketVersion: Long = 0L
    ): HeartRateDailySummary {
        val inDaySamples = samples.filter { sample ->
            !sample.time.isBefore(startOfDay) && sample.time.isBefore(endOfDay) && sample.beatsPerMinute > 0L
        }

        if (inDaySamples.isEmpty()) {
            return HeartRateDailySummary(
                averageBpm = null,
                externalAverageBpm = null,
                tasketAverageBpm = null,
                hasExternalSamples = false,
                maxTasketVersion = maxTasketVersion
            )
        }

        val externalSamples = inDaySamples.filter { it.dataOriginPackage != myPackageName }
        val tasketSamples = inDaySamples.filter { it.dataOriginPackage == myPackageName }

        val allAvg = inDaySamples.map { it.beatsPerMinute }.average().roundToInt().takeIf { it > 0 }
        val extAvg = if (externalSamples.isNotEmpty()) {
            externalSamples.map { it.beatsPerMinute }.average().roundToInt().takeIf { it > 0 }
        } else {
            null
        }
        val tasketAvg = if (tasketSamples.isNotEmpty()) {
            tasketSamples.map { it.beatsPerMinute }.average().roundToInt().takeIf { it > 0 }
        } else {
            null
        }

        return HeartRateDailySummary(
            averageBpm = allAvg,
            externalAverageBpm = extAvg,
            tasketAverageBpm = tasketAvg,
            hasExternalSamples = externalSamples.isNotEmpty(),
            maxTasketVersion = maxTasketVersion
        )
    }

    /**
     * 体重・体脂肪率などの時点測定レコードを書き込む際、当日の既存レコードより新しい時刻（当日内クランプ）を算出 (P1-3)
     */
    fun computeLatestMeasurementTimestamp(
        startOfDay: Instant,
        endOfDay: Instant,
        defaultPointTime: Instant,
        existingTimes: List<Instant>
    ): Instant {
        val latestBoundary = endOfDay.minusMillis(1)
        var candidate = when {
            defaultPointTime.isBefore(startOfDay) -> startOfDay
            defaultPointTime.isAfter(latestBoundary) -> latestBoundary
            else -> defaultPointTime
        }

        val maxExisting = existingTimes
            .filter { !it.isBefore(startOfDay) && it.isBefore(endOfDay) }
            .maxOrNull()

        if (maxExisting != null && !candidate.isAfter(maxExisting)) {
            val bumped = maxExisting.plusSeconds(1)
            candidate = if (bumped.isAfter(latestBoundary)) latestBoundary else bumped
        }

        return candidate
    }

    /**
     * 加算型データ（歩数・水分摂取量・運動時間）の他アプリ由来合計に対する書き込みアクションを算出 (P1-3)
     */
    fun computeAdditiveWriteAction(
        targetTotal: Double,
        externalTotal: Double
    ): AdditiveWriteAction {
        val safeExternal = if (externalTotal > 0.0) externalTotal else 0.0
        val delta = targetTotal - safeExternal
        return if (delta > 0.0) {
            AdditiveWriteAction.UpsertDelta(delta)
        } else {
            AdditiveWriteAction.DeleteTasketRecord
        }
    }

    /**
     * 当日 [startOfDay, endOfDay) 内で他アプリ記録の時間帯（externalIntervals）と重複しない区間 [start, end] を探索する (Review #2)
     * Health Connect の Activity 系集計（StepsRecord.COUNT_TOTAL, ExerciseSessionRecord.EXERCISE_DURATION_TOTAL）は
     * 時間帯が重複するレコード間でアプリ優先順位に基づく重複排除を行うため、差分レコードは非重複区間に配置する。
     * 必要な長さの非重複区間が存在しない場合は null を返す。
     */
    fun findNonOverlappingInterval(
        startOfDay: Instant,
        endOfDay: Instant,
        durationSeconds: Long,
        preferredStart: Instant,
        externalIntervals: List<Pair<Instant, Instant>>
    ): Pair<Instant, Instant>? {
        val dayBoundEnd = endOfDay.minusSeconds(1)
        val requiredSeconds = durationSeconds.coerceAtLeast(1L)
        val dayTotalSeconds = dayBoundEnd.epochSecond - startOfDay.epochSecond
        if (requiredSeconds > dayTotalSeconds) {
            return null
        }

        // 当日内にクリップして重複する他アプリ区間をマージ
        val clipped = externalIntervals
            .mapNotNull { (rawStart, rawEnd) ->
                val s = if (rawStart.isBefore(startOfDay)) startOfDay else rawStart
                val e = if (rawEnd.isAfter(dayBoundEnd)) dayBoundEnd else rawEnd
                if (e.isAfter(s)) s to e else null
            }
            .sortedWith(compareBy<Pair<Instant, Instant>> { it.first }.thenBy { it.second })

        val mergedExternal = mutableListOf<Pair<Instant, Instant>>()
        for ((s, e) in clipped) {
            if (mergedExternal.isEmpty()) {
                mergedExternal.add(s to e)
            } else {
                val last = mergedExternal.last()
                if (!s.isAfter(last.second)) {
                    val newEnd = if (e.isAfter(last.second)) e else last.second
                    mergedExternal[mergedExternal.lastIndex] = last.first to newEnd
                } else {
                    mergedExternal.add(s to e)
                }
            }
        }

        val clampedPreferredStart = when {
            preferredStart.isBefore(startOfDay) -> startOfDay
            preferredStart.plusSeconds(requiredSeconds).isAfter(dayBoundEnd) -> dayBoundEnd.minusSeconds(requiredSeconds)
            else -> preferredStart
        }
        val clampedPreferredEnd = clampedPreferredStart.plusSeconds(requiredSeconds)

        if (mergedExternal.isEmpty()) {
            return clampedPreferredStart to clampedPreferredEnd
        }

        // preferredStart からの区間が他アプリ区間と一切重複しない場合はそのまま採用
        val overlapsPreferred = mergedExternal.any { (extStart, extEnd) ->
            clampedPreferredStart.isBefore(extEnd) && extStart.isBefore(clampedPreferredEnd)
        }
        if (!overlapsPreferred) {
            return clampedPreferredStart to clampedPreferredEnd
        }

        // 空き区間（ギャップ）を列挙
        val freeGaps = mutableListOf<Pair<Instant, Instant>>()
        var cursor = startOfDay
        for ((extStart, extEnd) in mergedExternal) {
            if (extStart.isAfter(cursor)) {
                freeGaps.add(cursor to extStart)
            }
            if (extEnd.isAfter(cursor)) {
                cursor = extEnd
            }
        }
        if (dayBoundEnd.isAfter(cursor)) {
            freeGaps.add(cursor to dayBoundEnd)
        }

        val candidateSlots = freeGaps.mapNotNull { (gapStart, gapEnd) ->
            val available = gapEnd.epochSecond - gapStart.epochSecond
            if (available < requiredSeconds) {
                null
            } else {
                // gap 内で preferredStart に最も近い位置を選択
                val slotStart = when {
                    clampedPreferredStart.isBefore(gapStart) -> gapStart
                    clampedPreferredStart.plusSeconds(requiredSeconds).isAfter(gapEnd) -> gapEnd.minusSeconds(requiredSeconds)
                    else -> clampedPreferredStart
                }
                slotStart to slotStart.plusSeconds(requiredSeconds)
            }
        }

        return candidateSlots.minWithOrNull(
            compareBy<Pair<Instant, Instant>> { (slotStart, _) ->
                if (!slotStart.isBefore(clampedPreferredStart)) 0 else 1
            }.thenBy { (slotStart, _) ->
                abs(slotStart.epochSecond - clampedPreferredStart.epochSecond)
            }
        )
    }

    /**
     * 重複する睡眠時間帯（オーバーラップ区間）をマージして合計睡眠時間（時間・小数第1位）を算出 (P2-4)
     */
    fun mergeAndCalculateSleepHours(intervals: List<Pair<Instant, Instant>>): Double {
        val valid = intervals
            .filter { it.second.isAfter(it.first) }
            .sortedWith(compareBy<Pair<Instant, Instant>> { it.first }.thenBy { it.second })

        if (valid.isEmpty()) return 0.0

        val merged = mutableListOf<Pair<Instant, Instant>>()
        var currentStart = valid[0].first
        var currentEnd = valid[0].second

        for (i in 1 until valid.size) {
            val (nextStart, nextEnd) = valid[i]
            if (nextStart.isBefore(currentEnd)) {
                if (nextEnd.isAfter(currentEnd)) {
                    currentEnd = nextEnd
                }
            } else {
                merged.add(currentStart to currentEnd)
                currentStart = nextStart
                currentEnd = nextEnd
            }
        }
        merged.add(currentStart to currentEnd)

        val totalMillis = merged.sumOf { (start, end) ->
            (end.toEpochMilli() - start.toEpochMilli()).coerceAtLeast(0L)
        }
        if (totalMillis <= 0L) return 0.0

        return ((totalMillis / 3_600_000.0) * 10.0).roundToInt() / 10.0
    }

    /**
     * 新しい睡眠セッションの書き込み成功後に削除すべき不要なTasket作成セッションを特定 (P1-2)
     * - 固定10件制限なし
     * - dataOriginPackage == myPackageName のレコードのみを削除対象とし、他アプリ作成レコードは一切含めない
     */
    fun selectStaleTasketSleepRecordsToDelete(
        myPackageName: String,
        dateStr: String,
        existingRecords: List<SleepRecordMeta>,
        previousClientRecordIds: Collection<String>,
        newlyWrittenClientRecordIds: Set<String>
    ): StaleSleepCleanupPlan {
        val prefix = "tasket-sleep-$dateStr-"
        val recordIds = linkedSetOf<String>()
        val clientRecordIds = linkedSetOf<String>()

        for (record in existingRecords) {
            if (record.dataOriginPackage != myPackageName) {
                continue
            }
            val cid = record.clientRecordId
            if (cid != null) {
                if (cid.startsWith(prefix) && !newlyWrittenClientRecordIds.contains(cid)) {
                    clientRecordIds.add(cid)
                    if (record.id.isNotBlank()) {
                        recordIds.add(record.id)
                    }
                }
            } else if (record.id.isNotBlank()) {
                // Tasket自身が当日起床時間帯に作成した clientRecordId なしレコードがある場合も安全に回収
                recordIds.add(record.id)
            }
        }

        for (prevCid in previousClientRecordIds) {
            if (prevCid.startsWith(prefix) && !newlyWrittenClientRecordIds.contains(prevCid)) {
                clientRecordIds.add(prevCid)
            }
        }

        return StaleSleepCleanupPlan(
            recordIdsToDelete = recordIds.toList(),
            clientRecordIdsToDelete = clientRecordIds.toList()
        )
    }
}
