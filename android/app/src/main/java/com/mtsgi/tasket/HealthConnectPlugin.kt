package com.mtsgi.tasket

import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.activity.result.ActivityResultLauncher
import androidx.core.content.FileProvider
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.units.Mass
import androidx.health.connect.client.units.Percentage
import androidx.health.connect.client.units.Volume
import androidx.lifecycle.lifecycleScope
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlin.math.roundToInt
import kotlin.math.roundToLong

/**
 * Tasket用 Health Connect 双方向連携・ネイティブファイル出力 Capacitorプラグイン
 * 対象7項目: 歩数(steps), 睡眠(sleep), 心拍数(heartRate), 体重(weight),
 *           体脂肪率(bodyFatPercentage), 水分摂取量(waterIntake), 運動時間(exerciseMinutes)
 */
@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {

    companion object {
        private const val PROVIDER_PACKAGE_NAME = "com.google.android.apps.healthdata"

        private val PERM_READ_STEPS = HealthPermission.getReadPermission(StepsRecord::class)
        private val PERM_WRITE_STEPS = HealthPermission.getWritePermission(StepsRecord::class)
        private val PERM_READ_SLEEP = HealthPermission.getReadPermission(SleepSessionRecord::class)
        private val PERM_WRITE_SLEEP = HealthPermission.getWritePermission(SleepSessionRecord::class)
        private val PERM_READ_HEART_RATE = HealthPermission.getReadPermission(HeartRateRecord::class)
        private val PERM_WRITE_HEART_RATE = HealthPermission.getWritePermission(HeartRateRecord::class)
        private val PERM_READ_WEIGHT = HealthPermission.getReadPermission(WeightRecord::class)
        private val PERM_WRITE_WEIGHT = HealthPermission.getWritePermission(WeightRecord::class)
        private val PERM_READ_BODY_FAT = HealthPermission.getReadPermission(BodyFatRecord::class)
        private val PERM_WRITE_BODY_FAT = HealthPermission.getWritePermission(BodyFatRecord::class)
        private val PERM_READ_HYDRATION = HealthPermission.getReadPermission(HydrationRecord::class)
        private val PERM_WRITE_HYDRATION = HealthPermission.getWritePermission(HydrationRecord::class)
        private val PERM_READ_EXERCISE = HealthPermission.getReadPermission(ExerciseSessionRecord::class)
        private val PERM_WRITE_EXERCISE = HealthPermission.getWritePermission(ExerciseSessionRecord::class)

        private val METRIC_PERMISSIONS: Map<String, Pair<String, String>> = linkedMapOf(
            "steps" to (PERM_READ_STEPS to PERM_WRITE_STEPS),
            "sleep" to (PERM_READ_SLEEP to PERM_WRITE_SLEEP),
            "heartRate" to (PERM_READ_HEART_RATE to PERM_WRITE_HEART_RATE),
            "weight" to (PERM_READ_WEIGHT to PERM_WRITE_WEIGHT),
            "bodyFatPercentage" to (PERM_READ_BODY_FAT to PERM_WRITE_BODY_FAT),
            "waterIntake" to (PERM_READ_HYDRATION to PERM_WRITE_HYDRATION),
            "exerciseMinutes" to (PERM_READ_EXERCISE to PERM_WRITE_EXERCISE),
        )

        private val ALL_PERMISSIONS: Set<String> = METRIC_PERMISSIONS.values
            .flatMap { listOf(it.first, it.second) }
            .toSet()
    }

    private var permissionLauncher: ActivityResultLauncher<Set<String>>? = null
    private var pendingPermissionCall: PluginCall? = null

    override fun load() {
        super.load()
        val hostActivity = activity ?: return
        val contract = PermissionController.createRequestPermissionResultContract(PROVIDER_PACKAGE_NAME)
        permissionLauncher = hostActivity.registerForActivityResult(contract) { grantedSet ->
            val call = pendingPermissionCall
            pendingPermissionCall = null
            if (call != null) {
                hostActivity.lifecycleScope.launch {
                    val actualGranted = try {
                        val client = HealthConnectClient.getOrCreate(context, PROVIDER_PACKAGE_NAME)
                        client.permissionController.getGrantedPermissions()
                    } catch (_: Exception) {
                        grantedSet
                    }
                    call.resolve(buildPermissionsResult(actualGranted))
                }
            }
        }
    }

    /**
     * Health Connect の利用可否を判定
     */
    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val status = HealthConnectClient.getSdkStatus(context, PROVIDER_PACKAGE_NAME)
        val result = JSObject()
        result.put("platform", "android")
        when (status) {
            HealthConnectClient.SDK_AVAILABLE -> {
                result.put("available", true)
                result.put("status", "available")
            }
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> {
                result.put("available", false)
                result.put("status", "provider_update_required")
            }
            else -> {
                result.put("available", false)
                result.put("status", "unavailable")
            }
        }
        call.resolve(result)
    }

    /**
     * 現在の権限許可状態を確認
     */
    @PluginMethod
    override fun checkPermissions(call: PluginCall) {
        val hostActivity = activity
        if (hostActivity == null) {
            call.reject("Activity is not available")
            return
        }

        hostActivity.lifecycleScope.launch {
            try {
                val client = getClientOrNull()
                if (client == null) {
                    call.resolve(buildPermissionsResult(emptySet()))
                    return@launch
                }
                val granted = withContext(Dispatchers.IO) {
                    client.permissionController.getGrantedPermissions()
                }
                call.resolve(buildPermissionsResult(granted))
            } catch (e: Exception) {
                call.reject("Failed to check permissions: ${e.message}", e)
            }
        }
    }

    /**
     * Health Connect のアクセス権限を要求
     */
    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        val launcher = permissionLauncher
        if (launcher == null) {
            call.reject("Permission launcher is not initialized")
            return
        }
        if (getClientOrNull() == null) {
            call.reject("Health Connect is not available on this device")
            return
        }

        pendingPermissionCall = call
        try {
            launcher.launch(ALL_PERMISSIONS)
        } catch (e: Exception) {
            pendingPermissionCall = null
            call.reject("Failed to launch Health Connect permissions dialog: ${e.message}", e)
        }
    }

    /**
     * Health Connect の設定画面を開く
     */
    @PluginMethod
    fun openHealthConnectSettings(call: PluginCall) {
        try {
            val intent = Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            try {
                val fallbackIntent = Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse("market://details?id=$PROVIDER_PACKAGE_NAME")
                ).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(fallbackIntent)
                call.resolve()
            } catch (ex: Exception) {
                call.reject("Failed to open Health Connect settings: ${ex.message}", ex)
            }
        }
    }

    /**
     * 指定日（YYYY-MM-DD）の健康データを読み取って集約
     */
    @PluginMethod
    fun readDailyData(call: PluginCall) {
        val dateStr = call.getString("date")
        if (dateStr.isNullOrBlank()) {
            call.reject("date parameter is required")
            return
        }
        val hostActivity = activity
        if (hostActivity == null) {
            call.reject("Activity is not available")
            return
        }

        hostActivity.lifecycleScope.launch {
            try {
                val client = getClientOrNull()
                    ?: throw IllegalStateException("Health Connect is not available")
                val payload = withContext(Dispatchers.IO) {
                    val granted = client.permissionController.getGrantedPermissions()
                    readSingleDatePayload(client, granted, LocalDate.parse(dateStr))
                }
                call.resolve(payload)
            } catch (e: Exception) {
                call.reject("Failed to read daily data from Health Connect: ${e.message}", e)
            }
        }
    }

    /**
     * 指定期間（startDate〜endDate）の健康データを一括読み取り
     */
    @PluginMethod
    fun readDateRangeData(call: PluginCall) {
        val startDateStr = call.getString("startDate")
        val endDateStr = call.getString("endDate")
        if (startDateStr.isNullOrBlank() || endDateStr.isNullOrBlank()) {
            call.reject("startDate and endDate parameters are required")
            return
        }
        val hostActivity = activity
        if (hostActivity == null) {
            call.reject("Activity is not available")
            return
        }

        hostActivity.lifecycleScope.launch {
            try {
                val client = getClientOrNull()
                    ?: throw IllegalStateException("Health Connect is not available")
                val startDate = LocalDate.parse(startDateStr)
                val endDate = LocalDate.parse(endDateStr)

                val daysArray = withContext(Dispatchers.IO) {
                    val granted = client.permissionController.getGrantedPermissions()
                    val resultArray = JSArray()
                    var current = startDate
                    while (!current.isAfter(endDate)) {
                        val dayPayload = readSingleDatePayload(client, granted, current)
                        resultArray.put(dayPayload)
                        current = current.plusDays(1)
                    }
                    resultArray
                }

                val result = JSObject()
                result.put("days", daysArray)
                call.resolve(result)
            } catch (e: Exception) {
                call.reject("Failed to read date range data from Health Connect: ${e.message}", e)
            }
        }
    }

    /**
     * 指定日（YYYY-MM-DD）の健康データを clientRecordId 付きで Upsert 書き込み
     */
    @PluginMethod
    fun writeDailyData(call: PluginCall) {
        val dateStr = call.getString("date")
        val dataObj = call.getObject("data")
        if (dateStr.isNullOrBlank() || dataObj == null) {
            call.reject("date and data parameters are required")
            return
        }
        val hostActivity = activity
        if (hostActivity == null) {
            call.reject("Activity is not available")
            return
        }

        hostActivity.lifecycleScope.launch {
            try {
                val client = getClientOrNull()
                    ?: throw IllegalStateException("Health Connect is not available")
                val result = withContext(Dispatchers.IO) {
                    val granted = client.permissionController.getGrantedPermissions()
                    writeSingleDatePayload(client, granted, LocalDate.parse(dateStr), dataObj)
                }
                call.resolve(result)
            } catch (e: Exception) {
                call.reject("Failed to write daily data to Health Connect: ${e.message}", e)
            }
        }
    }

    /**
     * AndroidネイティブでのJSONバックアップ・CSVファイル保存（MediaStore Downloads / Shareシート）
     */
    @PluginMethod
    fun exportFile(call: PluginCall) {
        val filename = call.getString("filename")
        val content = call.getString("content")
        val mimeType = call.getString("mimeType") ?: "text/plain"

        if (filename.isNullOrBlank() || content == null) {
            call.reject("filename and content are required")
            return
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val resolver = context.contentResolver
                val contentValues = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, filename)
                    put(MediaStore.Downloads.MIME_TYPE, mimeType)
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                    ?: throw IllegalStateException("Failed to create download entry")

                resolver.openOutputStream(uri)?.use { outputStream ->
                    outputStream.write(content.toByteArray(Charsets.UTF_8))
                }

                contentValues.clear()
                contentValues.put(MediaStore.Downloads.IS_PENDING, 0)
                resolver.update(uri, contentValues, null, null)

                val result = JSObject()
                result.put("saved", true)
                result.put("uri", uri.toString())
                call.resolve(result)
            } else {
                val cacheFile = File(context.cacheDir, filename)
                cacheFile.writeText(content, Charsets.UTF_8)
                val uri = FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    cacheFile
                )
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = mimeType
                    putExtra(Intent.EXTRA_STREAM, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(Intent.createChooser(shareIntent, filename).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                })
                val result = JSObject()
                result.put("saved", true)
                result.put("uri", uri.toString())
                call.resolve(result)
            }
        } catch (e: Exception) {
            call.reject("Failed to export file: ${e.message}", e)
        }
    }

    private fun getClientOrNull(): HealthConnectClient? {
        val status = HealthConnectClient.getSdkStatus(context, PROVIDER_PACKAGE_NAME)
        if (status != HealthConnectClient.SDK_AVAILABLE) {
            return null
        }
        return HealthConnectClient.getOrCreate(context, PROVIDER_PACKAGE_NAME)
    }

    private fun buildPermissionsResult(granted: Set<String>): JSObject {
        val permissionsObj = JSObject()
        var allGranted = true
        var anyReadGranted = false
        var anyWriteGranted = false

        for ((metricKey, pair) in METRIC_PERMISSIONS) {
            val readGranted = granted.contains(pair.first)
            val writeGranted = granted.contains(pair.second)
            if (!readGranted || !writeGranted) {
                allGranted = false
            }
            if (readGranted) {
                anyReadGranted = true
            }
            if (writeGranted) {
                anyWriteGranted = true
            }

            val metricObj = JSObject()
            metricObj.put("read", readGranted)
            metricObj.put("write", writeGranted)
            permissionsObj.put(metricKey, metricObj)
        }

        val result = JSObject()
        result.put("permissions", permissionsObj)
        result.put("allGranted", allGranted)
        result.put("anyReadGranted", anyReadGranted)
        result.put("anyWriteGranted", anyWriteGranted)
        return result
    }

    /**
     * 1日分（LocalDate）の7項目データをHealth Connectから読み取ってJSObjectに集約
     */
    private suspend fun readSingleDatePayload(
        client: HealthConnectClient,
        granted: Set<String>,
        localDate: LocalDate
    ): JSObject {
        val zoneId = ZoneId.systemDefault()
        val startOfDay = localDate.atStartOfDay(zoneId).toInstant()
        val endOfDay = localDate.plusDays(1).atStartOfDay(zoneId).toInstant()
        val dayFilter = TimeRangeFilter.between(startOfDay, endOfDay)

        val payload = JSObject()
        payload.put("date", localDate.toString())

        // 1. 歩数（StepsRecord.COUNT_TOTAL 集計）
        if (granted.contains(PERM_READ_STEPS)) {
            try {
                val agg = client.aggregate(
                    AggregateRequest(
                        metrics = setOf(StepsRecord.COUNT_TOTAL),
                        timeRangeFilter = dayFilter
                    )
                )
                val totalSteps = agg[StepsRecord.COUNT_TOTAL]
                if (totalSteps != null && totalSteps > 0L) {
                    payload.put("steps", totalSteps.toInt())
                }
            } catch (_: Exception) {
            }
        }

        // 2. 睡眠時間（前日夜〜当日にまたがるセッションを含め、終了時刻＝起床がその日に含まれるものを集約）
        if (granted.contains(PERM_READ_SLEEP)) {
            try {
                val sleepQueryFilter = TimeRangeFilter.between(startOfDay.minusSeconds(86400), endOfDay)
                val response = client.readRecords(
                    ReadRecordsRequest(
                        recordType = SleepSessionRecord::class,
                        timeRangeFilter = sleepQueryFilter
                    )
                )
                val matchingSessions = response.records
                    .filter { !it.endTime.isBefore(startOfDay) && it.endTime.isBefore(endOfDay) }
                    .sortedBy { it.startTime }

                if (matchingSessions.isNotEmpty()) {
                    val sessionsArray = JSArray()
                    var totalSeconds = 0L
                    for (session in matchingSessions) {
                        val sessionObj = JSObject()
                        sessionObj.put("startTime", session.startTime.toString())
                        sessionObj.put("endTime", session.endTime.toString())
                        sessionsArray.put(sessionObj)
                        val durationSec = session.endTime.epochSecond - session.startTime.epochSecond
                        if (durationSec > 0) {
                            totalSeconds += durationSec
                        }
                    }
                    val sleepHours = ((totalSeconds / 3600.0) * 10.0).roundToInt() / 10.0
                    payload.put("sleepSessions", sessionsArray)
                    if (sleepHours > 0.0) {
                        payload.put("sleepHours", sleepHours)
                    }
                }
            } catch (_: Exception) {
            }
        }

        // 3. 心拍数（当日の全サンプルの平均値・整数bpm）
        if (granted.contains(PERM_READ_HEART_RATE)) {
            try {
                val response = client.readRecords(
                    ReadRecordsRequest(
                        recordType = HeartRateRecord::class,
                        timeRangeFilter = dayFilter
                    )
                )
                val samples = response.records.flatMap { it.samples }
                if (samples.isNotEmpty()) {
                    val avgBpm = samples.map { it.beatsPerMinute }.average().roundToInt()
                    if (avgBpm > 0) {
                        payload.put("heartRate", avgBpm)
                    }
                }
            } catch (_: Exception) {
            }
        }

        // 4. 体重（当日の最新値・小数第1位kg）
        if (granted.contains(PERM_READ_WEIGHT)) {
            try {
                val response = client.readRecords(
                    ReadRecordsRequest(
                        recordType = WeightRecord::class,
                        timeRangeFilter = dayFilter
                    )
                )
                val latestWeight = response.records.maxByOrNull { it.time }
                if (latestWeight != null) {
                    val kg = (latestWeight.weight.inKilograms * 10.0).roundToInt() / 10.0
                    if (kg > 0.0) {
                        payload.put("weight", kg)
                    }
                }
            } catch (_: Exception) {
            }
        }

        // 5. 体脂肪率（当日の最新値・小数第1位%）
        if (granted.contains(PERM_READ_BODY_FAT)) {
            try {
                val response = client.readRecords(
                    ReadRecordsRequest(
                        recordType = BodyFatRecord::class,
                        timeRangeFilter = dayFilter
                    )
                )
                val latestBodyFat = response.records.maxByOrNull { it.time }
                if (latestBodyFat != null) {
                    val pct = (latestBodyFat.percentage.value * 10.0).roundToInt() / 10.0
                    if (pct > 0.0) {
                        payload.put("bodyFatPercentage", pct)
                    }
                }
            } catch (_: Exception) {
            }
        }

        // 6. 水分摂取量（HydrationRecord.VOLUME_TOTAL 集計・整数ml）
        if (granted.contains(PERM_READ_HYDRATION)) {
            try {
                val agg = client.aggregate(
                    AggregateRequest(
                        metrics = setOf(HydrationRecord.VOLUME_TOTAL),
                        timeRangeFilter = dayFilter
                    )
                )
                val totalVolume = agg[HydrationRecord.VOLUME_TOTAL]
                if (totalVolume != null && totalVolume.inMilliliters > 0.0) {
                    payload.put("waterIntake", totalVolume.inMilliliters.roundToInt())
                }
            } catch (_: Exception) {
            }
        }

        // 7. 運動時間（ExerciseSessionRecord.EXERCISE_DURATION_TOTAL 集計・整数分）
        if (granted.contains(PERM_READ_EXERCISE)) {
            try {
                val agg = client.aggregate(
                    AggregateRequest(
                        metrics = setOf(ExerciseSessionRecord.EXERCISE_DURATION_TOTAL),
                        timeRangeFilter = dayFilter
                    )
                )
                val totalDuration = agg[ExerciseSessionRecord.EXERCISE_DURATION_TOTAL]
                if (totalDuration != null && totalDuration.toMinutes() > 0L) {
                    payload.put("exerciseMinutes", totalDuration.toMinutes().toInt())
                }
            } catch (_: Exception) {
            }
        }

        return payload
    }

    /**
     * 1日分の差分データを clientRecordId 付きで Health Connect へ Upsert 書き込み
     */
    private suspend fun writeSingleDatePayload(
        client: HealthConnectClient,
        granted: Set<String>,
        localDate: LocalDate,
        dataObj: JSObject
    ): JSObject {
        val dateStr = localDate.toString()
        val zoneId = ZoneId.systemDefault()
        val pointTime = localDate.atTime(8, 0).atZone(zoneId).toInstant()
        val pointOffset = zoneId.rules.getOffset(pointTime)

        val recordsToInsert = mutableListOf<Record>()
        val writtenFields = JSArray()
        val skippedPermissionFields = JSArray()

        // 1. 歩数
        if (dataObj.has("steps") && !dataObj.isNull("steps")) {
            val stepsVal = dataObj.optLong("steps", -1L)
            if (stepsVal > 0L) {
                if (granted.contains(PERM_WRITE_STEPS)) {
                    val startTime = localDate.atStartOfDay(zoneId).toInstant()
                    val endTime = localDate.atTime(23, 59, 59).atZone(zoneId).toInstant()
                    recordsToInsert.add(
                        StepsRecord(
                            startTime = startTime,
                            startZoneOffset = zoneId.rules.getOffset(startTime),
                            endTime = endTime,
                            endZoneOffset = zoneId.rules.getOffset(endTime),
                            count = stepsVal,
                            metadata = Metadata(clientRecordId = "tasket-steps-$dateStr")
                        )
                    )
                    writtenFields.put("steps")
                } else {
                    skippedPermissionFields.put("steps")
                }
            }
        }

        // 2. 睡眠セッション（sleepSessionsがある場合のみ実時刻でUpsert）
        if (dataObj.has("sleepSessions") && !dataObj.isNull("sleepSessions")) {
            val sessionsArray = dataObj.optJSONArray("sleepSessions")
            if (sessionsArray != null && sessionsArray.length() > 0) {
                if (granted.contains(PERM_WRITE_SLEEP)) {
                    var addedCount = 0
                    for (i in 0 until sessionsArray.length()) {
                        val sessionItem = sessionsArray.optJSONObject(i) ?: continue
                        val startStr = sessionItem.optString("startTime", "")
                        val endStr = sessionItem.optString("endTime", "")
                        if (startStr.isNotBlank() && endStr.isNotBlank()) {
                            val startInstant = Instant.parse(startStr)
                            val endInstant = Instant.parse(endStr)
                            if (endInstant.isAfter(startInstant)) {
                                recordsToInsert.add(
                                    SleepSessionRecord(
                                        startTime = startInstant,
                                        startZoneOffset = zoneId.rules.getOffset(startInstant),
                                        endTime = endInstant,
                                        endZoneOffset = zoneId.rules.getOffset(endInstant),
                                        metadata = Metadata(
                                            clientRecordId = "tasket-sleep-$dateStr-$addedCount"
                                        )
                                    )
                                )
                                addedCount++
                            }
                        }
                    }

                    // 以前のセッション数が多かった場合の余剰clientRecordIdをクリーンアップ
                    if (addedCount < 10) {
                        val staleIds = (addedCount until 10).map { "tasket-sleep-$dateStr-$it" }
                        try {
                            client.deleteRecords(
                                recordType = SleepSessionRecord::class,
                                recordIdsList = emptyList(),
                                clientRecordIdsList = staleIds
                            )
                        } catch (_: Exception) {
                        }
                    }

                    if (addedCount > 0) {
                        writtenFields.put("sleep")
                    }
                } else {
                    skippedPermissionFields.put("sleep")
                }
            }
        }

        // 3. 心拍数
        if (dataObj.has("heartRate") && !dataObj.isNull("heartRate")) {
            val bpm = dataObj.optDouble("heartRate", -1.0).roundToLong()
            if (bpm in 1L..300L) {
                if (granted.contains(PERM_WRITE_HEART_RATE)) {
                    recordsToInsert.add(
                        HeartRateRecord(
                            startTime = pointTime,
                            startZoneOffset = pointOffset,
                            endTime = pointTime.plusSeconds(60),
                            endZoneOffset = pointOffset,
                            samples = listOf(
                                HeartRateRecord.Sample(
                                    time = pointTime,
                                    beatsPerMinute = bpm
                                )
                            ),
                            metadata = Metadata(clientRecordId = "tasket-heartRate-$dateStr")
                        )
                    )
                    writtenFields.put("heartRate")
                } else {
                    skippedPermissionFields.put("heartRate")
                }
            }
        }

        // 4. 体重
        if (dataObj.has("weight") && !dataObj.isNull("weight")) {
            val weightKg = dataObj.optDouble("weight", -1.0)
            if (weightKg > 0.0) {
                if (granted.contains(PERM_WRITE_WEIGHT)) {
                    recordsToInsert.add(
                        WeightRecord(
                            time = pointTime,
                            zoneOffset = pointOffset,
                            weight = Mass.kilograms(weightKg),
                            metadata = Metadata(clientRecordId = "tasket-weight-$dateStr")
                        )
                    )
                    writtenFields.put("weight")
                } else {
                    skippedPermissionFields.put("weight")
                }
            }
        }

        // 5. 体脂肪率
        if (dataObj.has("bodyFatPercentage") && !dataObj.isNull("bodyFatPercentage")) {
            val bodyFatPct = dataObj.optDouble("bodyFatPercentage", -1.0)
            if (bodyFatPct > 0.0 && bodyFatPct < 100.0) {
                if (granted.contains(PERM_WRITE_BODY_FAT)) {
                    recordsToInsert.add(
                        BodyFatRecord(
                            time = pointTime,
                            zoneOffset = pointOffset,
                            percentage = Percentage(bodyFatPct),
                            metadata = Metadata(clientRecordId = "tasket-bodyFatPercentage-$dateStr")
                        )
                    )
                    writtenFields.put("bodyFatPercentage")
                } else {
                    skippedPermissionFields.put("bodyFatPercentage")
                }
            }
        }

        // 6. 水分摂取量
        if (dataObj.has("waterIntake") && !dataObj.isNull("waterIntake")) {
            val waterMl = dataObj.optDouble("waterIntake", -1.0)
            if (waterMl > 0.0) {
                if (granted.contains(PERM_WRITE_HYDRATION)) {
                    val startTime = localDate.atTime(12, 0).atZone(zoneId).toInstant()
                    val endTime = localDate.atTime(12, 15).atZone(zoneId).toInstant()
                    recordsToInsert.add(
                        HydrationRecord(
                            startTime = startTime,
                            startZoneOffset = zoneId.rules.getOffset(startTime),
                            endTime = endTime,
                            endZoneOffset = zoneId.rules.getOffset(endTime),
                            volume = Volume.milliliters(waterMl),
                            metadata = Metadata(clientRecordId = "tasket-waterIntake-$dateStr")
                        )
                    )
                    writtenFields.put("waterIntake")
                } else {
                    skippedPermissionFields.put("waterIntake")
                }
            }
        }

        // 7. 運動時間
        if (dataObj.has("exerciseMinutes") && !dataObj.isNull("exerciseMinutes")) {
            val exerciseMins = dataObj.optLong("exerciseMinutes", -1L)
            if (exerciseMins > 0L) {
                if (granted.contains(PERM_WRITE_EXERCISE)) {
                    val startTime = localDate.atTime(18, 0).atZone(zoneId).toInstant()
                    val endTime = startTime.plusSeconds(exerciseMins * 60L)
                    recordsToInsert.add(
                        ExerciseSessionRecord(
                            startTime = startTime,
                            startZoneOffset = zoneId.rules.getOffset(startTime),
                            endTime = endTime,
                            endZoneOffset = zoneId.rules.getOffset(endTime),
                            exerciseType = ExerciseSessionRecord.EXERCISE_TYPE_OTHER_WORKOUT,
                            metadata = Metadata(clientRecordId = "tasket-exerciseMinutes-$dateStr")
                        )
                    )
                    writtenFields.put("exerciseMinutes")
                } else {
                    skippedPermissionFields.put("exerciseMinutes")
                }
            }
        }

        if (recordsToInsert.isNotEmpty()) {
            client.insertRecords(recordsToInsert)
        }

        val result = JSObject()
        result.put("writtenFields", writtenFields)
        result.put("skippedPermissionFields", skippedPermissionFields)
        return result
    }
}
