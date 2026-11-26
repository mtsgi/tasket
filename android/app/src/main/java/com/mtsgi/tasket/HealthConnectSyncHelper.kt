package com.mtsgi.tasket

import java.time.Instant
import kotlin.math.roundToInt

/**
 * Health Connect 同期・競合解決・ページネーション計算の純粋ロジックヘルパー
 * Android フレームワークや HealthConnectClient 実体に依存せず単体テスト可能な計算を提供する
 */
object HealthConnectSyncHelper {

    const val DEFAULT_PAGE_SIZE = 500
    const val DEFAULT_MAX_PAGES = 20

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
     * pageToken を用いた全ページ取得ループ (P2-7)
     * - nextPageToken が null または空文字 "" の場合に終了
     * - 同一トークンの再出現または maxPages 到達時に安全に打ち切り、無限ループ・メモリ枯渇を防止
     */
    suspend fun <T> readPaginatedRecords(
        maxPages: Int = DEFAULT_MAX_PAGES,
        fetchPage: suspend (pageToken: String?) -> Pair<List<T>, String?>
    ): List<T> {
        if (maxPages <= 0) return emptyList()
        val allRecords = mutableListOf<T>()
        val seenTokens = mutableSetOf<String>()
        var currentToken: String? = null
        var pageCount = 0

        while (pageCount < maxPages) {
            val (records, nextToken) = fetchPage(currentToken)
            allRecords.addAll(records)
            pageCount++

            if (nextToken.isNullOrEmpty()) {
                break
            }
            if (!seenTokens.add(nextToken)) {
                // 同一 pageToken が繰り返された場合は無限ループ防止のため終了
                break
            }
            currentToken = nextToken
        }

        return allRecords
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
