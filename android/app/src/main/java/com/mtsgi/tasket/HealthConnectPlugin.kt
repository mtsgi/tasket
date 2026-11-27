package com.mtsgi.tasket

import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
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
import androidx.health.connect.client.records.metadata.DataOrigin
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
import kotlin.reflect.KClass

/**
 * Tasket用 Health Connect 双方向連携・ネイティブファイル出力 Capacitorプラグイン
 * 対象7項目: 歩数(steps), 睡眠(sleep), 心拍数(heartRate), 体重(weight),
 *           体脂肪率(bodyFatPercentage), 水分摂取量(waterIntake), 運動時間(exerciseMinutes)
 */
@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {

    companion object {
        private const val TAG = "HealthConnectPlugin"
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
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed to verify granted permissions after dialog", e)
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
     * 指定日（YYYY-MM-DD）の健康データを clientRecordId / clientRecordVersion 付きで Upsert 書き込み
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
     * pageToken を用いて対象レコード型の全ページを取得 (P2-7, Review #3)
     * 最大ページ数到達やトークン重複で全件取得できなかった場合は IllegalStateException を送出し、
     * 不完全なデータを正常取得扱い・差分計算基準に使用しない
     */
    private suspend fun <T : Record> readAllRecords(
        client: HealthConnectClient,
        recordType: KClass<T>,
        timeRangeFilter: TimeRangeFilter,
        dataOriginFilter: Set<DataOrigin> = emptySet()
    ): List<T> {
        return HealthConnectSyncHelper.readPaginatedRecords(
            maxPages = HealthConnectSyncHelper.DEFAULT_MAX_PAGES
        ) { pageToken ->
            val response = client.readRecords(
                ReadRecordsRequest(
                    recordType = recordType,
                    timeRangeFilter = timeRangeFilter,
                    dataOriginFilter = dataOriginFilter,
                    pageSize = HealthConnectSyncHelper.DEFAULT_PAGE_SIZE,
                    pageToken = pageToken
                )
            )
            response.records to response.pageToken
        }
    }

    /**
     * 1日分（LocalDate）の7項目データをHealth Connectから読み取ってJSObjectに集約
     * DataOrigin別の内訳（externalValues / tasketValues）、clientRecordVersions、および項目別ステータスも返す
     */
    private suspend fun readSingleDatePayload(
        client: HealthConnectClient,
        granted: Set<String>,
        localDate: LocalDate
    ): JSObject {
        val myPackageName = context.packageName
        val myDataOrigin = DataOrigin(myPackageName)
        val zoneId = ZoneId.systemDefault()
        val startOfDay = localDate.atStartOfDay(zoneId).toInstant()
        val endOfDay = localDate.plusDays(1).atStartOfDay(zoneId).toInstant()
        val dayFilter = TimeRangeFilter.between(startOfDay, endOfDay)

        val payload = JSObject()
        payload.put("date", localDate.toString())

        val externalValues = JSObject()
        val tasketValues = JSObject()
        val clientRecordVersions = JSObject()
        val readFields = JSArray()
        val emptyFields = JSArray()
        val skippedPermissionFields = JSArray()
        val failedFields = JSArray()
        val fieldErrors = JSObject()

        fun handleReadError(metricKey: String, e: Exception) {
            if (e is SecurityException) {
                Log.w(TAG, "Permission denied while reading $metricKey on $localDate", e)
                skippedPermissionFields.put(metricKey)
                fieldErrors.put(metricKey, e.message ?: "Permission denied")
            } else {
                Log.e(TAG, "Failed to read $metricKey on $localDate", e)
                failedFields.put(metricKey)
                fieldErrors.put(metricKey, e.message ?: "Read failed")
            }
        }

        // 1. 歩数（Health Connect 公式 aggregate で重複排除・優先順位整合の全体値と由来別値を取得）
        if (granted.contains(PERM_READ_STEPS)) {
            try {
                val records = readAllRecords(client, StepsRecord::class, dayFilter)
                val externalOrigins = records
                    .map { it.metadata.dataOrigin }
                    .filter { it.packageName != myPackageName }
                    .toSet()
                val tasketRecords = records.filter { it.metadata.dataOrigin.packageName == myPackageName }

                val totalAgg = client.aggregate(
                    AggregateRequest(
                        metrics = setOf(StepsRecord.COUNT_TOTAL),
                        timeRangeFilter = dayFilter
                    )
                )
                val totalSteps = (totalAgg[StepsRecord.COUNT_TOTAL] ?: 0L).coerceAtLeast(0L)

                val externalSteps = if (externalOrigins.isNotEmpty()) {
                    val extAgg = client.aggregate(
                        AggregateRequest(
                            metrics = setOf(StepsRecord.COUNT_TOTAL),
                            timeRangeFilter = dayFilter,
                            dataOriginFilter = externalOrigins
                        )
                    )
                    (extAgg[StepsRecord.COUNT_TOTAL] ?: 0L).coerceAtLeast(0L)
                } else {
                    0L
                }

                val tasketSteps = if (tasketRecords.isNotEmpty()) {
                    val tskAgg = client.aggregate(
                        AggregateRequest(
                            metrics = setOf(StepsRecord.COUNT_TOTAL),
                            timeRangeFilter = dayFilter,
                            dataOriginFilter = setOf(myDataOrigin)
                        )
                    )
                    (tskAgg[StepsRecord.COUNT_TOTAL] ?: 0L).coerceAtLeast(0L)
                } else {
                    0L
                }

                val maxVersion = tasketRecords.maxOfOrNull { it.metadata.clientRecordVersion } ?: 0L

                externalValues.put("steps", externalSteps.toInt())
                tasketValues.put("steps", tasketSteps.toInt())
                if (maxVersion > 0L) {
                    clientRecordVersions.put("steps", maxVersion)
                }

                if (totalSteps > 0L) {
                    payload.put("steps", totalSteps.toInt())
                    readFields.put("steps")
                } else {
                    emptyFields.put("steps")
                }
            } catch (e: Exception) {
                handleReadError("steps", e)
            }
        } else {
            skippedPermissionFields.put("steps")
        }

        // 2. 睡眠時間（前日夜〜当日にまたがるセッションを含め、終了時刻＝起床がその日に含まれるものを集約）
        if (granted.contains(PERM_READ_SLEEP)) {
            try {
                val sleepQueryFilter = TimeRangeFilter.between(startOfDay.minusSeconds(86400), endOfDay)
                val records = readAllRecords(client, SleepSessionRecord::class, sleepQueryFilter)
                val matchingSessions = records
                    .filter { !it.endTime.isBefore(startOfDay) && it.endTime.isBefore(endOfDay) }
                    .sortedWith(compareBy<SleepSessionRecord> { it.startTime }.thenBy { it.endTime })

                val tasketSessions = matchingSessions.filter { it.metadata.dataOrigin.packageName == myPackageName }
                val maxVersion = tasketSessions.maxOfOrNull { it.metadata.clientRecordVersion } ?: 0L
                if (maxVersion > 0L) {
                    clientRecordVersions.put("sleep", maxVersion)
                }

                val tasketIdsArray = JSArray()
                for (ts in tasketSessions) {
                    val cid = ts.metadata.clientRecordId
                    if (!cid.isNullOrBlank()) {
                        tasketIdsArray.put(cid)
                    }
                }
                payload.put("tasketSleepClientRecordIds", tasketIdsArray)

                if (matchingSessions.isNotEmpty()) {
                    val sessionsArray = JSArray()
                    val intervals = mutableListOf<Pair<Instant, Instant>>()
                    for (session in matchingSessions) {
                        val isTasket = session.metadata.dataOrigin.packageName == myPackageName
                        val sessionObj = JSObject()
                        sessionObj.put("startTime", session.startTime.toString())
                        sessionObj.put("endTime", session.endTime.toString())
                        if (session.metadata.id.isNotBlank()) {
                            sessionObj.put("id", session.metadata.id)
                        }
                        if (!session.metadata.clientRecordId.isNullOrBlank()) {
                            sessionObj.put("clientRecordId", session.metadata.clientRecordId)
                        }
                        if (session.metadata.clientRecordVersion > 0L) {
                            sessionObj.put("clientRecordVersion", session.metadata.clientRecordVersion)
                        }
                        sessionObj.put("dataOrigin", session.metadata.dataOrigin.packageName)
                        sessionObj.put("source", if (isTasket) "tasket" else "external")
                        sessionsArray.put(sessionObj)
                        intervals.add(session.startTime to session.endTime)
                    }

                    val sleepHours = HealthConnectSyncHelper.mergeAndCalculateSleepHours(intervals)
                    payload.put("sleepSessions", sessionsArray)
                    if (sleepHours > 0.0) {
                        payload.put("sleepHours", sleepHours)
                    }
                    readFields.put("sleep")
                } else {
                    emptyFields.put("sleep")
                }
            } catch (e: Exception) {
                handleReadError("sleep", e)
            }
        } else {
            skippedPermissionFields.put("sleep")
        }

        // 3. 心拍数（当日 [startOfDay, endOfDay) 内のサンプルのみから平均bpmを算出）
        if (granted.contains(PERM_READ_HEART_RATE)) {
            try {
                val records = readAllRecords(client, HeartRateRecord::class, dayFilter)
                val maxTasketVersion = records
                    .filter { it.metadata.dataOrigin.packageName == myPackageName }
                    .maxOfOrNull { it.metadata.clientRecordVersion } ?: 0L

                val samples = records.flatMap { record ->
                    val pkg = record.metadata.dataOrigin.packageName
                    record.samples.map { sample ->
                        HealthConnectSyncHelper.HeartRateSampleMeta(
                            time = sample.time,
                            beatsPerMinute = sample.beatsPerMinute,
                            dataOriginPackage = pkg
                        )
                    }
                }

                val summary = HealthConnectSyncHelper.computeDailyHeartRateSummary(
                    samples = samples,
                    startOfDay = startOfDay,
                    endOfDay = endOfDay,
                    myPackageName = myPackageName,
                    maxTasketVersion = maxTasketVersion
                )

                payload.put("hasExternalHeartRate", summary.hasExternalSamples)
                if (summary.externalAverageBpm != null) {
                    externalValues.put("heartRate", summary.externalAverageBpm)
                }
                if (summary.tasketAverageBpm != null) {
                    tasketValues.put("heartRate", summary.tasketAverageBpm)
                }
                if (summary.maxTasketVersion > 0L) {
                    clientRecordVersions.put("heartRate", summary.maxTasketVersion)
                }

                if (summary.averageBpm != null) {
                    payload.put("heartRate", summary.averageBpm)
                    readFields.put("heartRate")
                } else {
                    emptyFields.put("heartRate")
                }
            } catch (e: Exception) {
                handleReadError("heartRate", e)
            }
        } else {
            skippedPermissionFields.put("heartRate")
        }

        // 4. 体重（当日の最新値・小数第1位kg）
        if (granted.contains(PERM_READ_WEIGHT)) {
            try {
                val records = readAllRecords(client, WeightRecord::class, dayFilter)
                val tasketRecords = records.filter { it.metadata.dataOrigin.packageName == myPackageName }
                val externalRecords = records.filter { it.metadata.dataOrigin.packageName != myPackageName }

                val maxVersion = tasketRecords.maxOfOrNull { it.metadata.clientRecordVersion } ?: 0L
                if (maxVersion > 0L) {
                    clientRecordVersions.put("weight", maxVersion)
                }

                externalRecords.maxByOrNull { it.time }?.let { ext ->
                    val extKg = (ext.weight.inKilograms * 10.0).roundToInt() / 10.0
                    if (extKg > 0.0) externalValues.put("weight", extKg)
                }
                tasketRecords.maxByOrNull { it.time }?.let { tsk ->
                    val tskKg = (tsk.weight.inKilograms * 10.0).roundToInt() / 10.0
                    if (tskKg > 0.0) tasketValues.put("weight", tskKg)
                }

                val latestWeight = records.maxWithOrNull(
                    compareBy<WeightRecord> { it.time }
                        .thenBy { it.metadata.dataOrigin.packageName == myPackageName }
                )
                if (latestWeight != null) {
                    val kg = (latestWeight.weight.inKilograms * 10.0).roundToInt() / 10.0
                    if (kg > 0.0) {
                        payload.put("weight", kg)
                        readFields.put("weight")
                    } else {
                        emptyFields.put("weight")
                    }
                } else {
                    emptyFields.put("weight")
                }
            } catch (e: Exception) {
                handleReadError("weight", e)
            }
        } else {
            skippedPermissionFields.put("weight")
        }

        // 5. 体脂肪率（当日の最新値・小数第1位%）
        if (granted.contains(PERM_READ_BODY_FAT)) {
            try {
                val records = readAllRecords(client, BodyFatRecord::class, dayFilter)
                val tasketRecords = records.filter { it.metadata.dataOrigin.packageName == myPackageName }
                val externalRecords = records.filter { it.metadata.dataOrigin.packageName != myPackageName }

                val maxVersion = tasketRecords.maxOfOrNull { it.metadata.clientRecordVersion } ?: 0L
                if (maxVersion > 0L) {
                    clientRecordVersions.put("bodyFatPercentage", maxVersion)
                }

                externalRecords.maxByOrNull { it.time }?.let { ext ->
                    val extPct = (ext.percentage.value * 10.0).roundToInt() / 10.0
                    if (extPct > 0.0) externalValues.put("bodyFatPercentage", extPct)
                }
                tasketRecords.maxByOrNull { it.time }?.let { tsk ->
                    val tskPct = (tsk.percentage.value * 10.0).roundToInt() / 10.0
                    if (tskPct > 0.0) tasketValues.put("bodyFatPercentage", tskPct)
                }

                val latestBodyFat = records.maxWithOrNull(
                    compareBy<BodyFatRecord> { it.time }
                        .thenBy { it.metadata.dataOrigin.packageName == myPackageName }
                )
                if (latestBodyFat != null) {
                    val pct = (latestBodyFat.percentage.value * 10.0).roundToInt() / 10.0
                    if (pct > 0.0) {
                        payload.put("bodyFatPercentage", pct)
                        readFields.put("bodyFatPercentage")
                    } else {
                        emptyFields.put("bodyFatPercentage")
                    }
                } else {
                    emptyFields.put("bodyFatPercentage")
                }
            } catch (e: Exception) {
                handleReadError("bodyFatPercentage", e)
            }
        } else {
            skippedPermissionFields.put("bodyFatPercentage")
        }

        // 6. 水分摂取量（他アプリ由来とTasket由来を分離して集計・整数ml）
        if (granted.contains(PERM_READ_HYDRATION)) {
            try {
                val records = readAllRecords(client, HydrationRecord::class, dayFilter)
                val externalRecords = records.filter { it.metadata.dataOrigin.packageName != myPackageName }
                val tasketRecords = records.filter { it.metadata.dataOrigin.packageName == myPackageName }

                val externalMl = externalRecords.sumOf { it.volume.inMilliliters }.roundToInt().coerceAtLeast(0)
                val tasketMl = tasketRecords.sumOf { it.volume.inMilliliters }.roundToInt().coerceAtLeast(0)
                val totalMl = externalMl + tasketMl
                val maxVersion = tasketRecords.maxOfOrNull { it.metadata.clientRecordVersion } ?: 0L

                externalValues.put("waterIntake", externalMl)
                tasketValues.put("waterIntake", tasketMl)
                if (maxVersion > 0L) {
                    clientRecordVersions.put("waterIntake", maxVersion)
                }

                if (totalMl > 0) {
                    payload.put("waterIntake", totalMl)
                    readFields.put("waterIntake")
                } else {
                    emptyFields.put("waterIntake")
                }
            } catch (e: Exception) {
                handleReadError("waterIntake", e)
            }
        } else {
            skippedPermissionFields.put("waterIntake")
        }

        // 7. 運動時間（Health Connect 公式 aggregate で重複排除整合の全体値と由来別値を取得・整数分）
        if (granted.contains(PERM_READ_EXERCISE)) {
            try {
                val records = readAllRecords(client, ExerciseSessionRecord::class, dayFilter)
                val externalOrigins = records
                    .map { it.metadata.dataOrigin }
                    .filter { it.packageName != myPackageName }
                    .toSet()
                val tasketRecords = records.filter { it.metadata.dataOrigin.packageName == myPackageName }

                val totalAgg = client.aggregate(
                    AggregateRequest(
                        metrics = setOf(ExerciseSessionRecord.EXERCISE_DURATION_TOTAL),
                        timeRangeFilter = dayFilter
                    )
                )
                val totalMins = (totalAgg[ExerciseSessionRecord.EXERCISE_DURATION_TOTAL]?.toMinutes() ?: 0L)
                    .coerceAtLeast(0L)
                    .toInt()

                val externalMins = if (externalOrigins.isNotEmpty()) {
                    val agg = client.aggregate(
                        AggregateRequest(
                            metrics = setOf(ExerciseSessionRecord.EXERCISE_DURATION_TOTAL),
                            timeRangeFilter = dayFilter,
                            dataOriginFilter = externalOrigins
                        )
                    )
                    (agg[ExerciseSessionRecord.EXERCISE_DURATION_TOTAL]?.toMinutes() ?: 0L).coerceAtLeast(0L).toInt()
                } else {
                    0
                }

                val tasketMins = if (tasketRecords.isNotEmpty()) {
                    val tskAgg = client.aggregate(
                        AggregateRequest(
                            metrics = setOf(ExerciseSessionRecord.EXERCISE_DURATION_TOTAL),
                            timeRangeFilter = dayFilter,
                            dataOriginFilter = setOf(myDataOrigin)
                        )
                    )
                    (tskAgg[ExerciseSessionRecord.EXERCISE_DURATION_TOTAL]?.toMinutes() ?: 0L).coerceAtLeast(0L).toInt()
                } else {
                    0
                }

                val maxVersion = tasketRecords.maxOfOrNull { it.metadata.clientRecordVersion } ?: 0L

                externalValues.put("exerciseMinutes", externalMins)
                tasketValues.put("exerciseMinutes", tasketMins)
                if (maxVersion > 0L) {
                    clientRecordVersions.put("exerciseMinutes", maxVersion)
                }

                if (totalMins > 0) {
                    payload.put("exerciseMinutes", totalMins)
                    readFields.put("exerciseMinutes")
                } else {
                    emptyFields.put("exerciseMinutes")
                }
            } catch (e: Exception) {
                handleReadError("exerciseMinutes", e)
            }
        } else {
            skippedPermissionFields.put("exerciseMinutes")
        }

        payload.put("externalValues", externalValues)
        payload.put("tasketValues", tasketValues)
        payload.put("clientRecordVersions", clientRecordVersions)
        payload.put("readFields", readFields)
        payload.put("emptyFields", emptyFields)
        payload.put("skippedPermissionFields", skippedPermissionFields)
        payload.put("failedFields", failedFields)
        payload.put("fieldErrors", fieldErrors)
        return payload
    }

    /**
     * 1日分の差分データを clientRecordId / clientRecordVersion 付きで Health Connect へ Upsert 書き込み
     * - 項目ごとに独立して Upsert / 削除を実行し、一部の項目が失敗しても他項目の書き込みを維持する
     * - 加算型データ（steps, waterIntake, exerciseMinutes）は読み取り権限で現在の他アプリ記録を確認できた場合のみ差分を Upsert し、
     *   読み取り権限がない場合は古いメタデータや0を使わず localOnlyFields としてローカル保存のみとする (Review #2)
     * - Activity 系（steps, exerciseMinutes）は他アプリ区間と重複しない時間帯へ配置し、アプリ優先順位による重複排除と整合させる (Review #2)
     * - 睡眠セッションは新しいレコードの insertRecords 成功後にのみ不要な Tasket レコードを削除する (P1-2)
     */
    private suspend fun writeSingleDatePayload(
        client: HealthConnectClient,
        granted: Set<String>,
        localDate: LocalDate,
        dataObj: JSObject
    ): JSObject {
        val myPackageName = context.packageName
        val dateStr = localDate.toString()
        val zoneId = ZoneId.systemDefault()
        val startOfDay = localDate.atStartOfDay(zoneId).toInstant()
        val endOfDay = localDate.plusDays(1).atStartOfDay(zoneId).toInstant()
        val dayFilter = TimeRangeFilter.between(startOfDay, endOfDay)

        val nowInstant = Instant.now()
        val defaultPointTime = if (localDate == LocalDate.now(zoneId)) {
            nowInstant.coerceIn(startOfDay, endOfDay.minusSeconds(1))
        } else {
            localDate.atTime(8, 0).atZone(zoneId).toInstant()
        }

        val hintVersionsObj = dataObj.optJSONObject("clientRecordVersions")
        val prevSleepIdsJson = dataObj.optJSONArray("previousSleepClientRecordIds")
        val prevSleepClientRecordIds = mutableListOf<String>()
        if (prevSleepIdsJson != null) {
            for (i in 0 until prevSleepIdsJson.length()) {
                val idStr = prevSleepIdsJson.optString(i, "")
                if (idStr.isNotBlank()) {
                    prevSleepClientRecordIds.add(idStr)
                }
            }
        }

        val writtenFields = JSArray()
        val skippedPermissionFields = JSArray()
        val invalidFields = JSArray()
        val localOnlyFields = JSArray()
        val failedFields = JSArray()
        val fieldErrors = JSObject()
        val outExternalValues = JSObject()
        val outTasketValues = JSObject()
        val outVersions = JSObject()
        var outTasketSleepIds: JSArray? = null
        var outPendingDeleteSleepIds: JSArray? = null

        fun handleWriteError(metricKey: String, e: Exception) {
            if (e is SecurityException) {
                Log.w(TAG, "Permission denied while writing $metricKey on $localDate", e)
                skippedPermissionFields.put(metricKey)
                fieldErrors.put(metricKey, e.message ?: "Permission denied")
            } else {
                Log.e(TAG, "Failed to write $metricKey on $localDate", e)
                failedFields.put(metricKey)
                fieldErrors.put(metricKey, e.message ?: "Write failed")
            }
        }

        // 1. 歩数（加算型：読み取り権限で現在の他アプリ歩数を確認できる場合のみ非重複区間に差分を Upsert）
        if (dataObj.has("steps") && !dataObj.isNull("steps")) {
            val stepsVal = dataObj.optLong("steps", -1L)
            if (stepsVal < 0L) {
                invalidFields.put("steps")
            } else if (!granted.contains(PERM_WRITE_STEPS)) {
                skippedPermissionFields.put("steps")
            } else if (!granted.contains(PERM_READ_STEPS)) {
                // 読み取り権限がない場合、古いメタデータや0を使うと二重計上になるためローカル保存のみとする
                localOnlyFields.put("steps")
            } else {
                try {
                    val records = readAllRecords(client, StepsRecord::class, dayFilter)
                    val externalRecords = records.filter { it.metadata.dataOrigin.packageName != myPackageName }
                    val externalOrigins = externalRecords.map { it.metadata.dataOrigin }.toSet()
                    val tasketRecords = records.filter { it.metadata.dataOrigin.packageName == myPackageName }
                    val existingMaxVersion = tasketRecords.maxOfOrNull { it.metadata.clientRecordVersion } ?: 0L
                    val existingTasketIds = tasketRecords.mapNotNull { it.metadata.id.takeIf { id -> id.isNotBlank() } }

                    val externalSteps = if (externalOrigins.isNotEmpty()) {
                        val agg = client.aggregate(
                            AggregateRequest(
                                metrics = setOf(StepsRecord.COUNT_TOTAL),
                                timeRangeFilter = dayFilter,
                                dataOriginFilter = externalOrigins
                            )
                        )
                        (agg[StepsRecord.COUNT_TOTAL] ?: 0L).coerceAtLeast(0L)
                    } else {
                        0L
                    }

                    val requestedVersion = hintVersionsObj?.optLong("steps", 0L) ?: 0L
                    val nextVersion = HealthConnectSyncHelper.computeNextClientRecordVersion(
                        nowEpochMillis = System.currentTimeMillis(),
                        requestedVersion = requestedVersion,
                        existingMaxVersion = existingMaxVersion
                    )
                    val clientRecordId = "tasket-steps-$dateStr"

                    when (val action = HealthConnectSyncHelper.computeAdditiveWriteAction(stepsVal.toDouble(), externalSteps.toDouble())) {
                        is HealthConnectSyncHelper.AdditiveWriteAction.UpsertDelta -> {
                            val deltaCount = action.deltaValue.roundToLong().coerceAtLeast(1L)
                            val slot: Pair<Instant, Instant>? = if (externalRecords.isEmpty()) {
                                startOfDay to localDate.atTime(23, 59, 59).atZone(zoneId).toInstant()
                            } else {
                                val externalIntervals = externalRecords.map { it.startTime to it.endTime }
                                val preferredStart = localDate.atTime(23, 58).atZone(zoneId).toInstant()
                                HealthConnectSyncHelper.findNonOverlappingInterval(
                                    startOfDay = startOfDay,
                                    endOfDay = endOfDay,
                                    durationSeconds = 60L,
                                    preferredStart = preferredStart,
                                    externalIntervals = externalIntervals
                                ) ?: HealthConnectSyncHelper.findNonOverlappingInterval(
                                    startOfDay = startOfDay,
                                    endOfDay = endOfDay,
                                    durationSeconds = 1L,
                                    preferredStart = preferredStart,
                                    externalIntervals = externalIntervals
                                )
                            }

                            if (slot != null) {
                                client.insertRecords(
                                    listOf(
                                        StepsRecord(
                                            startTime = slot.first,
                                            startZoneOffset = zoneId.rules.getOffset(slot.first),
                                            endTime = slot.second,
                                            endZoneOffset = zoneId.rules.getOffset(slot.second),
                                            count = deltaCount,
                                            metadata = Metadata(
                                                clientRecordId = clientRecordId,
                                                clientRecordVersion = nextVersion
                                            )
                                        )
                                    )
                                )
                                outExternalValues.put("steps", externalSteps.toInt())
                                outTasketValues.put("steps", deltaCount.toInt())
                                outVersions.put("steps", nextVersion)
                                writtenFields.put("steps")
                            } else {
                                // 他アプリ記録が24時間全体を覆っており非重複区間がない場合は Tasket レコードを削除してローカル保存のみとする
                                if (existingTasketIds.isNotEmpty()) {
                                    client.deleteRecords(
                                        recordType = StepsRecord::class,
                                        recordIdsList = existingTasketIds,
                                        clientRecordIdsList = listOf(clientRecordId)
                                    )
                                }
                                outExternalValues.put("steps", externalSteps.toInt())
                                outTasketValues.put("steps", 0)
                                localOnlyFields.put("steps")
                            }
                        }
                        is HealthConnectSyncHelper.AdditiveWriteAction.DeleteTasketRecord -> {
                            client.deleteRecords(
                                recordType = StepsRecord::class,
                                recordIdsList = existingTasketIds,
                                clientRecordIdsList = listOf(clientRecordId)
                            )
                            outExternalValues.put("steps", externalSteps.toInt())
                            outTasketValues.put("steps", 0)
                            if (stepsVal < externalSteps) {
                                localOnlyFields.put("steps")
                            } else {
                                writtenFields.put("steps")
                            }
                        }
                    }
                } catch (e: Exception) {
                    handleWriteError("steps", e)
                }
            }
        }

        // 2. 睡眠セッション（insertRecords 成功後にのみ不要な Tasket セッションを削除・固定10件制限なし）
        if (dataObj.has("sleepSessions") && !dataObj.isNull("sleepSessions")) {
            val sessionsArray = dataObj.optJSONArray("sleepSessions")
            if (sessionsArray == null) {
                invalidFields.put("sleep")
            } else if (!granted.contains(PERM_WRITE_SLEEP)) {
                skippedPermissionFields.put("sleep")
            } else {
                try {
                    val sleepQueryFilter = TimeRangeFilter.between(startOfDay.minusSeconds(86400), endOfDay)
                    val existingSleepMetas = if (granted.contains(PERM_READ_SLEEP)) {
                        val records = readAllRecords(client, SleepSessionRecord::class, sleepQueryFilter)
                        records
                            .filter { !it.endTime.isBefore(startOfDay) && it.endTime.isBefore(endOfDay) }
                            .map { rec ->
                                HealthConnectSyncHelper.SleepRecordMeta(
                                    id = rec.metadata.id,
                                    clientRecordId = rec.metadata.clientRecordId,
                                    clientRecordVersion = rec.metadata.clientRecordVersion,
                                    dataOriginPackage = rec.metadata.dataOrigin.packageName,
                                    startTime = rec.startTime,
                                    endTime = rec.endTime
                                )
                            }
                    } else {
                        emptyList()
                    }

                    val existingMaxVersion = existingSleepMetas
                        .filter { it.dataOriginPackage == myPackageName }
                        .maxOfOrNull { it.clientRecordVersion } ?: 0L
                    val requestedVersion = hintVersionsObj?.optLong("sleep", 0L) ?: 0L
                    val nextVersion = HealthConnectSyncHelper.computeNextClientRecordVersion(
                        nowEpochMillis = System.currentTimeMillis(),
                        requestedVersion = requestedVersion,
                        existingMaxVersion = existingMaxVersion
                    )

                    val sleepRecordsToInsert = mutableListOf<SleepSessionRecord>()
                    val newlyWrittenClientRecordIds = linkedSetOf<String>()
                    var hasInvalidSessionEntry = false

                    for (i in 0 until sessionsArray.length()) {
                        val sessionItem = sessionsArray.optJSONObject(i)
                        if (sessionItem == null) {
                            hasInvalidSessionEntry = true
                            continue
                        }
                        val source = sessionItem.optString("source", "tasket")
                        if (source == "external" || source == "manual") {
                            continue
                        }
                        val startStr = sessionItem.optString("startTime", "")
                        val endStr = sessionItem.optString("endTime", "")
                        if (startStr.isBlank() || endStr.isBlank()) {
                            hasInvalidSessionEntry = true
                            continue
                        }
                        val startInstant = try {
                            Instant.parse(startStr)
                        } catch (_: Exception) {
                            hasInvalidSessionEntry = true
                            null
                        }
                        val endInstant = try {
                            Instant.parse(endStr)
                        } catch (_: Exception) {
                            hasInvalidSessionEntry = true
                            null
                        }
                        if (startInstant != null && endInstant != null && endInstant.isAfter(startInstant)) {
                            val idx = sleepRecordsToInsert.size
                            val cid = "tasket-sleep-$dateStr-$idx"
                            val itemRequestedVersion = sessionItem.optLong("clientRecordVersion", 0L)
                            val recordVersion = maxOf(nextVersion, itemRequestedVersion + 1L)
                            sleepRecordsToInsert.add(
                                SleepSessionRecord(
                                    startTime = startInstant,
                                    startZoneOffset = zoneId.rules.getOffset(startInstant),
                                    endTime = endInstant,
                                    endZoneOffset = zoneId.rules.getOffset(endInstant),
                                    metadata = Metadata(
                                        clientRecordId = cid,
                                        clientRecordVersion = recordVersion
                                    )
                                )
                            )
                            newlyWrittenClientRecordIds.add(cid)
                        } else {
                            hasInvalidSessionEntry = true
                        }
                    }

                    if (sessionsArray.length() > 0 && sleepRecordsToInsert.isEmpty() && hasInvalidSessionEntry) {
                        invalidFields.put("sleep")
                    } else {
                        // Step A: まず新しい睡眠セッションを insertRecords で書き込む（失敗時は既存セッションを削除しない）
                        if (sleepRecordsToInsert.isNotEmpty()) {
                            client.insertRecords(sleepRecordsToInsert)
                        }

                        // Step B: 新規書き込みが成功した後にのみ、不要となった過去の Tasket 睡眠セッションを削除
                        val cleanupPlan = HealthConnectSyncHelper.selectStaleTasketSleepRecordsToDelete(
                            myPackageName = myPackageName,
                            dateStr = dateStr,
                            existingRecords = existingSleepMetas,
                            previousClientRecordIds = prevSleepClientRecordIds,
                            newlyWrittenClientRecordIds = newlyWrittenClientRecordIds
                        )

                        val tasketIdsArray = JSArray()
                        for (cid in newlyWrittenClientRecordIds) {
                            tasketIdsArray.put(cid)
                        }
                        outTasketSleepIds = tasketIdsArray

                        if (cleanupPlan.recordIdsToDelete.isNotEmpty() || cleanupPlan.clientRecordIdsToDelete.isNotEmpty()) {
                            try {
                                client.deleteRecords(
                                    recordType = SleepSessionRecord::class,
                                    recordIdsList = cleanupPlan.recordIdsToDelete,
                                    clientRecordIdsList = cleanupPlan.clientRecordIdsToDelete
                                )
                                outPendingDeleteSleepIds = JSArray()
                            } catch (delEx: Exception) {
                                Log.e(TAG, "Failed to delete stale Tasket sleep sessions on $localDate", delEx)
                                val pendingArray = JSArray()
                                for (cid in cleanupPlan.clientRecordIdsToDelete) {
                                    pendingArray.put(cid)
                                }
                                outPendingDeleteSleepIds = pendingArray
                                failedFields.put("sleep")
                                fieldErrors.put("sleep", "Failed to delete stale sleep sessions: ${delEx.message}")
                            }
                        } else {
                            outPendingDeleteSleepIds = JSArray()
                        }

                        outVersions.put("sleep", nextVersion)
                        writtenFields.put("sleep")
                    }
                } catch (e: Exception) {
                    handleWriteError("sleep", e)
                }
            }
        }

        // 3. 心拍数（読み取り権限で他アプリ由来サンプルがないことを確認できた日のみ Upsert）
        if (dataObj.has("heartRate") && !dataObj.isNull("heartRate")) {
            val bpm = dataObj.optDouble("heartRate", -1.0).roundToLong()
            if (bpm !in 1L..300L) {
                invalidFields.put("heartRate")
            } else if (!granted.contains(PERM_WRITE_HEART_RATE)) {
                skippedPermissionFields.put("heartRate")
            } else if (!granted.contains(PERM_READ_HEART_RATE)) {
                localOnlyFields.put("heartRate")
            } else {
                try {
                    val records = readAllRecords(client, HeartRateRecord::class, dayFilter)
                    val existingMaxVersion = records
                        .filter { it.metadata.dataOrigin.packageName == myPackageName }
                        .maxOfOrNull { it.metadata.clientRecordVersion } ?: 0L
                    val hasExternalHr = records.any { rec ->
                        rec.metadata.dataOrigin.packageName != myPackageName &&
                            rec.samples.any { s -> !s.time.isBefore(startOfDay) && s.time.isBefore(endOfDay) }
                    }

                    if (hasExternalHr) {
                        localOnlyFields.put("heartRate")
                    } else {
                        val requestedVersion = hintVersionsObj?.optLong("heartRate", 0L) ?: 0L
                        val nextVersion = HealthConnectSyncHelper.computeNextClientRecordVersion(
                            nowEpochMillis = System.currentTimeMillis(),
                            requestedVersion = requestedVersion,
                            existingMaxVersion = existingMaxVersion
                        )
                        val pointOffset = zoneId.rules.getOffset(defaultPointTime)
                        client.insertRecords(
                            listOf(
                                HeartRateRecord(
                                    startTime = defaultPointTime,
                                    startZoneOffset = pointOffset,
                                    endTime = defaultPointTime.plusSeconds(60).coerceAtMost(endOfDay.minusMillis(1)),
                                    endZoneOffset = pointOffset,
                                    samples = listOf(
                                        HeartRateRecord.Sample(
                                            time = defaultPointTime,
                                            beatsPerMinute = bpm
                                        )
                                    ),
                                    metadata = Metadata(
                                        clientRecordId = "tasket-heartRate-$dateStr",
                                        clientRecordVersion = nextVersion
                                    )
                                )
                            )
                        )
                        outTasketValues.put("heartRate", bpm.toInt())
                        outVersions.put("heartRate", nextVersion)
                        writtenFields.put("heartRate")
                    }
                } catch (e: Exception) {
                    handleWriteError("heartRate", e)
                }
            }
        }

        // 4. 体重（当日内の既存レコードより新しい時刻で Upsert）
        if (dataObj.has("weight") && !dataObj.isNull("weight")) {
            val weightKg = dataObj.optDouble("weight", -1.0)
            if (weightKg <= 0.0 || weightKg > 500.0) {
                invalidFields.put("weight")
            } else if (!granted.contains(PERM_WRITE_WEIGHT)) {
                skippedPermissionFields.put("weight")
            } else {
                try {
                    var existingMaxVersion = 0L
                    var existingTimes = emptyList<Instant>()

                    if (granted.contains(PERM_READ_WEIGHT)) {
                        val records = readAllRecords(client, WeightRecord::class, dayFilter)
                        existingMaxVersion = records
                            .filter { it.metadata.dataOrigin.packageName == myPackageName }
                            .maxOfOrNull { it.metadata.clientRecordVersion } ?: 0L
                        existingTimes = records.map { it.time }
                    }

                    val requestedVersion = hintVersionsObj?.optLong("weight", 0L) ?: 0L
                    val nextVersion = HealthConnectSyncHelper.computeNextClientRecordVersion(
                        nowEpochMillis = System.currentTimeMillis(),
                        requestedVersion = requestedVersion,
                        existingMaxVersion = existingMaxVersion
                    )
                    val writeTime = HealthConnectSyncHelper.computeLatestMeasurementTimestamp(
                        startOfDay = startOfDay,
                        endOfDay = endOfDay,
                        defaultPointTime = defaultPointTime,
                        existingTimes = existingTimes
                    )
                    val writeOffset = zoneId.rules.getOffset(writeTime)

                    client.insertRecords(
                        listOf(
                            WeightRecord(
                                time = writeTime,
                                zoneOffset = writeOffset,
                                weight = Mass.kilograms(weightKg),
                                metadata = Metadata(
                                    clientRecordId = "tasket-weight-$dateStr",
                                    clientRecordVersion = nextVersion
                                )
                            )
                        )
                    )
                    outTasketValues.put("weight", weightKg)
                    outVersions.put("weight", nextVersion)
                    writtenFields.put("weight")
                } catch (e: Exception) {
                    handleWriteError("weight", e)
                }
            }
        }

        // 5. 体脂肪率（当日内の既存レコードより新しい時刻で Upsert）
        if (dataObj.has("bodyFatPercentage") && !dataObj.isNull("bodyFatPercentage")) {
            val bodyFatPct = dataObj.optDouble("bodyFatPercentage", -1.0)
            if (bodyFatPct <= 0.0 || bodyFatPct >= 100.0) {
                invalidFields.put("bodyFatPercentage")
            } else if (!granted.contains(PERM_WRITE_BODY_FAT)) {
                skippedPermissionFields.put("bodyFatPercentage")
            } else {
                try {
                    var existingMaxVersion = 0L
                    var existingTimes = emptyList<Instant>()

                    if (granted.contains(PERM_READ_BODY_FAT)) {
                        val records = readAllRecords(client, BodyFatRecord::class, dayFilter)
                        existingMaxVersion = records
                            .filter { it.metadata.dataOrigin.packageName == myPackageName }
                            .maxOfOrNull { it.metadata.clientRecordVersion } ?: 0L
                        existingTimes = records.map { it.time }
                    }

                    val requestedVersion = hintVersionsObj?.optLong("bodyFatPercentage", 0L) ?: 0L
                    val nextVersion = HealthConnectSyncHelper.computeNextClientRecordVersion(
                        nowEpochMillis = System.currentTimeMillis(),
                        requestedVersion = requestedVersion,
                        existingMaxVersion = existingMaxVersion
                    )
                    val writeTime = HealthConnectSyncHelper.computeLatestMeasurementTimestamp(
                        startOfDay = startOfDay,
                        endOfDay = endOfDay,
                        defaultPointTime = defaultPointTime,
                        existingTimes = existingTimes
                    )
                    val writeOffset = zoneId.rules.getOffset(writeTime)

                    client.insertRecords(
                        listOf(
                            BodyFatRecord(
                                time = writeTime,
                                zoneOffset = writeOffset,
                                percentage = Percentage(bodyFatPct),
                                metadata = Metadata(
                                    clientRecordId = "tasket-bodyFatPercentage-$dateStr",
                                    clientRecordVersion = nextVersion
                                )
                            )
                        )
                    )
                    outTasketValues.put("bodyFatPercentage", bodyFatPct)
                    outVersions.put("bodyFatPercentage", nextVersion)
                    writtenFields.put("bodyFatPercentage")
                } catch (e: Exception) {
                    handleWriteError("bodyFatPercentage", e)
                }
            }
        }

        // 6. 水分摂取量（加算型：読み取り権限で現在の他アプリ水分量を確認できる場合のみ差分を Upsert）
        if (dataObj.has("waterIntake") && !dataObj.isNull("waterIntake")) {
            val waterMl = dataObj.optDouble("waterIntake", -1.0)
            if (waterMl < 0.0) {
                invalidFields.put("waterIntake")
            } else if (!granted.contains(PERM_WRITE_HYDRATION)) {
                skippedPermissionFields.put("waterIntake")
            } else if (!granted.contains(PERM_READ_HYDRATION)) {
                // 読み取り権限がない場合、古いメタデータや0を使うと二重計上になるためローカル保存のみとする
                localOnlyFields.put("waterIntake")
            } else {
                try {
                    val records = readAllRecords(client, HydrationRecord::class, dayFilter)
                    val externalRecords = records.filter { it.metadata.dataOrigin.packageName != myPackageName }
                    val tasketRecords = records.filter { it.metadata.dataOrigin.packageName == myPackageName }
                    val externalWaterMl = externalRecords.sumOf { it.volume.inMilliliters }.coerceAtLeast(0.0)
                    val existingMaxVersion = tasketRecords.maxOfOrNull { it.metadata.clientRecordVersion } ?: 0L
                    val existingTasketIds = tasketRecords.mapNotNull { it.metadata.id.takeIf { id -> id.isNotBlank() } }

                    val requestedVersion = hintVersionsObj?.optLong("waterIntake", 0L) ?: 0L
                    val nextVersion = HealthConnectSyncHelper.computeNextClientRecordVersion(
                        nowEpochMillis = System.currentTimeMillis(),
                        requestedVersion = requestedVersion,
                        existingMaxVersion = existingMaxVersion
                    )
                    val clientRecordId = "tasket-waterIntake-$dateStr"

                    when (val action = HealthConnectSyncHelper.computeAdditiveWriteAction(waterMl, externalWaterMl)) {
                        is HealthConnectSyncHelper.AdditiveWriteAction.UpsertDelta -> {
                            val deltaMl = action.deltaValue.roundToInt().coerceAtLeast(1)
                            val startTime = localDate.atTime(12, 0).atZone(zoneId).toInstant()
                            val endTime = localDate.atTime(12, 15).atZone(zoneId).toInstant()
                            client.insertRecords(
                                listOf(
                                    HydrationRecord(
                                        startTime = startTime,
                                        startZoneOffset = zoneId.rules.getOffset(startTime),
                                        endTime = endTime,
                                        endZoneOffset = zoneId.rules.getOffset(endTime),
                                        volume = Volume.milliliters(deltaMl.toDouble()),
                                        metadata = Metadata(
                                            clientRecordId = clientRecordId,
                                            clientRecordVersion = nextVersion
                                        )
                                    )
                                )
                            )
                            outExternalValues.put("waterIntake", externalWaterMl.roundToInt())
                            outTasketValues.put("waterIntake", deltaMl)
                            outVersions.put("waterIntake", nextVersion)
                            writtenFields.put("waterIntake")
                        }
                        is HealthConnectSyncHelper.AdditiveWriteAction.DeleteTasketRecord -> {
                            client.deleteRecords(
                                recordType = HydrationRecord::class,
                                recordIdsList = existingTasketIds,
                                clientRecordIdsList = listOf(clientRecordId)
                            )
                            outExternalValues.put("waterIntake", externalWaterMl.roundToInt())
                            outTasketValues.put("waterIntake", 0)
                            if (waterMl.roundToInt() < externalWaterMl.roundToInt()) {
                                localOnlyFields.put("waterIntake")
                            } else {
                                writtenFields.put("waterIntake")
                            }
                        }
                    }
                } catch (e: Exception) {
                    handleWriteError("waterIntake", e)
                }
            }
        }

        // 7. 運動時間（加算型：読み取り権限で現在の他アプリ運動時間を確認できる場合のみ非重複区間に差分を Upsert）
        if (dataObj.has("exerciseMinutes") && !dataObj.isNull("exerciseMinutes")) {
            val exerciseMins = dataObj.optLong("exerciseMinutes", -1L)
            if (exerciseMins < 0L) {
                invalidFields.put("exerciseMinutes")
            } else if (!granted.contains(PERM_WRITE_EXERCISE)) {
                skippedPermissionFields.put("exerciseMinutes")
            } else if (!granted.contains(PERM_READ_EXERCISE)) {
                // 読み取り権限がない場合、古いメタデータや0を使うと二重計上になるためローカル保存のみとする
                localOnlyFields.put("exerciseMinutes")
            } else {
                try {
                    val records = readAllRecords(client, ExerciseSessionRecord::class, dayFilter)
                    val externalRecords = records.filter { it.metadata.dataOrigin.packageName != myPackageName }
                    val externalOrigins = externalRecords.map { it.metadata.dataOrigin }.toSet()
                    val tasketRecords = records.filter { it.metadata.dataOrigin.packageName == myPackageName }
                    val existingMaxVersion = tasketRecords.maxOfOrNull { it.metadata.clientRecordVersion } ?: 0L
                    val existingTasketIds = tasketRecords.mapNotNull { it.metadata.id.takeIf { id -> id.isNotBlank() } }

                    val externalExerciseMins = if (externalOrigins.isNotEmpty()) {
                        val agg = client.aggregate(
                            AggregateRequest(
                                metrics = setOf(ExerciseSessionRecord.EXERCISE_DURATION_TOTAL),
                                timeRangeFilter = dayFilter,
                                dataOriginFilter = externalOrigins
                            )
                        )
                        (agg[ExerciseSessionRecord.EXERCISE_DURATION_TOTAL]?.toMinutes() ?: 0L).coerceAtLeast(0L)
                    } else {
                        0L
                    }

                    val requestedVersion = hintVersionsObj?.optLong("exerciseMinutes", 0L) ?: 0L
                    val nextVersion = HealthConnectSyncHelper.computeNextClientRecordVersion(
                        nowEpochMillis = System.currentTimeMillis(),
                        requestedVersion = requestedVersion,
                        existingMaxVersion = existingMaxVersion
                    )
                    val clientRecordId = "tasket-exerciseMinutes-$dateStr"

                    when (val action = HealthConnectSyncHelper.computeAdditiveWriteAction(exerciseMins.toDouble(), externalExerciseMins.toDouble())) {
                        is HealthConnectSyncHelper.AdditiveWriteAction.UpsertDelta -> {
                            val deltaMins = action.deltaValue.roundToLong().coerceAtLeast(1L)
                            val durationSeconds = (deltaMins * 60L).coerceAtMost(86399L)
                            val preferredStart = localDate.atTime(18, 0).atZone(zoneId).toInstant()
                            val externalIntervals = externalRecords.map { it.startTime to it.endTime }
                            val slot = HealthConnectSyncHelper.findNonOverlappingInterval(
                                startOfDay = startOfDay,
                                endOfDay = endOfDay,
                                durationSeconds = durationSeconds,
                                preferredStart = preferredStart,
                                externalIntervals = externalIntervals
                            )

                            if (slot != null) {
                                client.insertRecords(
                                    listOf(
                                        ExerciseSessionRecord(
                                            startTime = slot.first,
                                            startZoneOffset = zoneId.rules.getOffset(slot.first),
                                            endTime = slot.second,
                                            endZoneOffset = zoneId.rules.getOffset(slot.second),
                                            exerciseType = ExerciseSessionRecord.EXERCISE_TYPE_OTHER_WORKOUT,
                                            metadata = Metadata(
                                                clientRecordId = clientRecordId,
                                                clientRecordVersion = nextVersion
                                            )
                                        )
                                    )
                                )
                                outExternalValues.put("exerciseMinutes", externalExerciseMins.toInt())
                                outTasketValues.put("exerciseMinutes", deltaMins.toInt())
                                outVersions.put("exerciseMinutes", nextVersion)
                                writtenFields.put("exerciseMinutes")
                            } else {
                                if (existingTasketIds.isNotEmpty()) {
                                    client.deleteRecords(
                                        recordType = ExerciseSessionRecord::class,
                                        recordIdsList = existingTasketIds,
                                        clientRecordIdsList = listOf(clientRecordId)
                                    )
                                }
                                outExternalValues.put("exerciseMinutes", externalExerciseMins.toInt())
                                outTasketValues.put("exerciseMinutes", 0)
                                localOnlyFields.put("exerciseMinutes")
                            }
                        }
                        is HealthConnectSyncHelper.AdditiveWriteAction.DeleteTasketRecord -> {
                            client.deleteRecords(
                                recordType = ExerciseSessionRecord::class,
                                recordIdsList = existingTasketIds,
                                clientRecordIdsList = listOf(clientRecordId)
                            )
                            outExternalValues.put("exerciseMinutes", externalExerciseMins.toInt())
                            outTasketValues.put("exerciseMinutes", 0)
                            if (exerciseMins < externalExerciseMins) {
                                localOnlyFields.put("exerciseMinutes")
                            } else {
                                writtenFields.put("exerciseMinutes")
                            }
                        }
                    }
                } catch (e: Exception) {
                    handleWriteError("exerciseMinutes", e)
                }
            }
        }

        val result = JSObject()
        result.put("writtenFields", writtenFields)
        result.put("skippedPermissionFields", skippedPermissionFields)
        result.put("invalidFields", invalidFields)
        result.put("localOnlyFields", localOnlyFields)
        result.put("failedFields", failedFields)
        result.put("fieldErrors", fieldErrors)
        result.put("externalValues", outExternalValues)
        result.put("tasketValues", outTasketValues)
        result.put("clientRecordVersions", outVersions)
        if (outTasketSleepIds != null) {
            result.put("tasketSleepClientRecordIds", outTasketSleepIds)
        }
        if (outPendingDeleteSleepIds != null) {
            result.put("pendingDeleteSleepClientRecordIds", outPendingDeleteSleepIds)
        }
        return result
    }
}
