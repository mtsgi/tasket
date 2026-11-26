package com.mtsgi.tasket

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

/**
 * HealthConnectSyncHelper のユニットテスト
 * P1-1〜P1-3, P2-4, P2-7 の Kotlin 側同期ロジックを検証
 */
class HealthConnectSyncHelperTest {

    @Test
    fun `computeNextClientRecordVersion returns monotonically increasing version across edits and restores`() {
        // 初回書き込み
        val v1 = HealthConnectSyncHelper.computeNextClientRecordVersion(
            nowEpochMillis = 1_700_000_000_000L,
            requestedVersion = 0L,
            existingMaxVersion = 0L
        )
        assertEquals(1_700_000_000_000L, v1)

        // 同一ミリ秒での再編集でも +1 インクリメントされる
        val v2 = HealthConnectSyncHelper.computeNextClientRecordVersion(
            nowEpochMillis = 1_700_000_000_000L,
            requestedVersion = v1,
            existingMaxVersion = v1
        )
        assertEquals(1_700_000_000_001L, v2)

        // バックアップ復元後（ローカルの requestedVersion が古く、端末時計が巻き戻っていても Health Connect 上の existingMaxVersion を上回る）
        val v3 = HealthConnectSyncHelper.computeNextClientRecordVersion(
            nowEpochMillis = 1_600_000_000_000L,
            requestedVersion = 100L,
            existingMaxVersion = 1_750_000_000_000L
        )
        assertEquals(1_750_000_000_001L, v3)
    }

    @Test
    fun `readPaginatedRecords fetches all pages and stops on empty token or duplicate token or maxPages`() = runBlocking {
        // 3ページの正常取得（最終ページの pageToken が空文字 "" のケース）
        val pages = mapOf(
            null to (listOf("rec-1", "rec-2") to "token-page-2"),
            "token-page-2" to (listOf("rec-3", "rec-4") to "token-page-3"),
            "token-page-3" to (listOf("rec-5") to "")
        )

        val all = HealthConnectSyncHelper.readPaginatedRecords { token ->
            pages[token] ?: (emptyList<String>() to null)
        }
        assertEquals(listOf("rec-1", "rec-2", "rec-3", "rec-4", "rec-5"), all)

        // 同一 pageToken が返り続ける異常系でも無限ループせず打ち切る
        var callCount = 0
        val loopGuarded = HealthConnectSyncHelper.readPaginatedRecords(maxPages = 10) { _ ->
            callCount++
            listOf("item-$callCount") to "stuck-token"
        }
        assertEquals(2, callCount)
        assertEquals(listOf("item-1", "item-2"), loopGuarded)
    }

    @Test
    fun `computeDailyHeartRateSummary filters out samples outside target day and detects external origin`() {
        val startOfDay = Instant.parse("2025-12-15T00:00:00Z")
        val endOfDay = Instant.parse("2025-12-16T00:00:00Z")
        val myPkg = "com.mtsgi.tasket"

        val samples = listOf(
            // 前日分（対象日外 -> 除外されること）
            HealthConnectSyncHelper.HeartRateSampleMeta(
                time = Instant.parse("2025-12-14T23:55:00Z"),
                beatsPerMinute = 180L,
                dataOriginPackage = "com.google.android.apps.fitness"
            ),
            // 当日分の他アプリサンプル (70, 80 -> 平均 75)
            HealthConnectSyncHelper.HeartRateSampleMeta(
                time = Instant.parse("2025-12-15T08:00:00Z"),
                beatsPerMinute = 70L,
                dataOriginPackage = "com.google.android.apps.fitness"
            ),
            HealthConnectSyncHelper.HeartRateSampleMeta(
                time = Instant.parse("2025-12-15T12:00:00Z"),
                beatsPerMinute = 80L,
                dataOriginPackage = "com.google.android.apps.fitness"
            ),
            // 翌日境界（endOfDay ちょうど -> 除外されること）
            HealthConnectSyncHelper.HeartRateSampleMeta(
                time = Instant.parse("2025-12-16T00:00:00Z"),
                beatsPerMinute = 160L,
                dataOriginPackage = "com.google.android.apps.fitness"
            )
        )

        val summary = HealthConnectSyncHelper.computeDailyHeartRateSummary(
            samples = samples,
            startOfDay = startOfDay,
            endOfDay = endOfDay,
            myPackageName = myPkg,
            maxTasketVersion = 123L
        )

        assertEquals(75, summary.averageBpm)
        assertEquals(75, summary.externalAverageBpm)
        assertNull(summary.tasketAverageBpm)
        assertTrue(summary.hasExternalSamples)
    }

    @Test
    fun `computeLatestMeasurementTimestamp ensures write timestamp is newer than existing records within day`() {
        val startOfDay = Instant.parse("2025-12-15T00:00:00Z")
        val endOfDay = Instant.parse("2025-12-16T00:00:00Z")
        val defaultPointTime = Instant.parse("2025-12-15T08:00:00Z")
        val existingMorning = Instant.parse("2025-12-15T10:30:00Z")

        val ts = HealthConnectSyncHelper.computeLatestMeasurementTimestamp(
            startOfDay = startOfDay,
            endOfDay = endOfDay,
            defaultPointTime = defaultPointTime,
            existingTimes = listOf(existingMorning)
        )

        assertEquals(Instant.parse("2025-12-15T10:30:01Z"), ts)
        assertTrue(ts.isAfter(existingMorning))
        assertTrue(ts.isBefore(endOfDay))
    }

    @Test
    fun `computeAdditiveWriteAction returns delta upsert or delete record to prevent double counting`() {
        // 他アプリ1,000ml -> Tasketで1,200mlに編集 => 差分200mlのみUpsert
        val actionIncrease = HealthConnectSyncHelper.computeAdditiveWriteAction(
            targetTotal = 1200.0,
            externalTotal = 1000.0
        )
        assertTrue(actionIncrease is HealthConnectSyncHelper.AdditiveWriteAction.UpsertDelta)
        assertEquals(
            200.0,
            (actionIncrease as HealthConnectSyncHelper.AdditiveWriteAction.UpsertDelta).deltaValue,
            0.001
        )

        // 他アプリ1,000ml -> Tasketで800mlへ減少修正 => Tasketレコードを削除し他アプリ記録は改変しない
        val actionDecrease = HealthConnectSyncHelper.computeAdditiveWriteAction(
            targetTotal = 800.0,
            externalTotal = 1000.0
        )
        assertTrue(actionDecrease is HealthConnectSyncHelper.AdditiveWriteAction.DeleteTasketRecord)
    }

    @Test
    fun `mergeAndCalculateSleepHours merges overlapping intervals and preserves sub-minute precision`() {
        // 重複する2つのセッション: 23:00〜03:00 (4h) と 02:00〜07:00 (5h) -> マージ後 23:00〜07:00 (8.0h)
        val hours = HealthConnectSyncHelper.mergeAndCalculateSleepHours(
            listOf(
                Instant.parse("2025-12-14T23:00:00Z") to Instant.parse("2025-12-15T03:00:00Z"),
                Instant.parse("2025-12-15T02:00:00Z") to Instant.parse("2025-12-15T07:00:00Z")
            )
        )
        assertEquals(8.0, hours, 0.001)
    }

    @Test
    fun `selectStaleTasketSleepRecordsToDelete removes all stale Tasket records beyond 10 limit and never deletes external app records`() {
        val myPkg = "com.mtsgi.tasket"
        val dateStr = "2025-12-15"

        // Tasket自身の過去セッション15件（0〜14）＋他アプリのセッション2件
        val existingTasketRecords = (0 until 15).map { idx ->
            HealthConnectSyncHelper.SleepRecordMeta(
                id = "hc-tasket-id-$idx",
                clientRecordId = "tasket-sleep-$dateStr-$idx",
                clientRecordVersion = 10L,
                dataOriginPackage = myPkg,
                startTime = Instant.parse("2025-12-15T00:00:00Z"),
                endTime = Instant.parse("2025-12-15T01:00:00Z")
            )
        }
        val externalRecords = listOf(
            HealthConnectSyncHelper.SleepRecordMeta(
                id = "hc-external-id-1",
                clientRecordId = "external-sleep-1",
                clientRecordVersion = 1L,
                dataOriginPackage = "com.fitbit.FitbitMobile",
                startTime = Instant.parse("2025-12-14T23:00:00Z"),
                endTime = Instant.parse("2025-12-15T06:30:00Z")
            )
        )

        // 今回書き込んだのが2件（0, 1）のみの場合、2〜14の13件すべてが削除対象になり、他アプリのレコードは含まれない
        val newlyWritten = setOf("tasket-sleep-$dateStr-0", "tasket-sleep-$dateStr-1")
        val plan = HealthConnectSyncHelper.selectStaleTasketSleepRecordsToDelete(
            myPackageName = myPkg,
            dateStr = dateStr,
            existingRecords = existingTasketRecords + externalRecords,
            previousClientRecordIds = emptyList(),
            newlyWrittenClientRecordIds = newlyWritten
        )

        assertEquals(13, plan.clientRecordIdsToDelete.size)
        assertEquals(13, plan.recordIdsToDelete.size)
        assertTrue(plan.clientRecordIdsToDelete.contains("tasket-sleep-$dateStr-14"))
        assertFalse(plan.clientRecordIdsToDelete.contains("tasket-sleep-$dateStr-0"))
        assertFalse(plan.recordIdsToDelete.contains("hc-external-id-1"))
    }
}
