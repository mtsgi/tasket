package com.mtsgi.tasket

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.os.SystemClock
import android.util.Base64
import android.util.Log
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.mlkit.genai.common.DownloadStatus
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.common.GenAiException
import com.google.mlkit.genai.prompt.Feature
import com.google.mlkit.genai.prompt.GenerateContentRequest
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.GenerativeModel
import com.google.mlkit.genai.prompt.ImagePart
import com.google.mlkit.genai.prompt.TextPart
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.io.ByteArrayInputStream
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.max

/**
 * Tasket用 Gemini Nano（ML Kit GenAI Prompt API）オンデバイス食事写真解析 Capacitorプラグイン。
 * 写真や食事情報を外部サーバーへ一切送信せず、端末内のAICore / Gemini Nanoのみで栄養素推定を実行する。
 */
@CapacitorPlugin(name = "MealAi")
class MealAiPlugin : Plugin() {

    companion object {
        private const val TAG = "MealAiPlugin"
        private const val INFERENCE_TIMEOUT_MS = 60_000L
    }

    private val modelLock = Any()
    private var generativeModel: GenerativeModel? = null
    private val isDestroyed = AtomicBoolean(false)
    private val isDownloading = AtomicBoolean(false)
    private val isAnalyzing = AtomicBoolean(false)
    private var pluginScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    override fun load() {
        super.load()
        isDestroyed.set(false)
    }

    override fun handleOnDestroy() {
        isDestroyed.set(true)
        pluginScope.cancel()
        closeModelSafely()
        super.handleOnDestroy()
    }

    private fun getOrCreateModel(): GenerativeModel {
        synchronized(modelLock) {
            check(!isDestroyed.get()) { "Plugin has already been destroyed" }
            val existing = generativeModel
            if (existing != null) {
                return existing
            }
            val created = Generation.getClient()
            generativeModel = created
            return created
        }
    }

    private fun closeModelSafely() {
        synchronized(modelLock) {
            try {
                generativeModel?.close()
            } catch (e: Exception) {
                Log.w(TAG, "Failed to close GenerativeModel cleanly (code=${e.javaClass.simpleName})")
            } finally {
                generativeModel = null
            }
        }
    }

    /**
     * Gemini Nano（ML Kit GenAI Prompt API）の利用可否・モデル準備状態を確認する
     */
    @PluginMethod
    fun checkStatus(call: PluginCall) {
        pluginScope.launch {
            try {
                val statusInt = withContext(Dispatchers.IO) {
                    getOrCreateModel().checkStatus()
                }
                val statusStr = MealAiHelper.mapFeatureStatusToString(statusInt)
                val result = JSObject()
                    .put("available", statusInt == FeatureStatus.AVAILABLE)
                    .put("status", statusStr)
                    .put("featureStatus", statusInt)
                    .put("platform", "android")
                    .put("retryable", statusInt == FeatureStatus.DOWNLOADABLE || statusInt == FeatureStatus.DOWNLOADING)
                call.resolve(result)
            } catch (e: CancellationException) {
                call.reject("Status check cancelled", "CANCELLED")
                throw e
            } catch (e: GenAiException) {
                Log.w(TAG, "GenAiException during checkStatus: errorCode=${e.errorCode}, aiCoreErrorCode=${e.aiCoreErrorCode}")
                val classified = MealAiHelper.classifyStatusException(e.errorCode, e.aiCoreErrorCode)
                val result = JSObject()
                    .put("available", false)
                    .put("status", classified.status)
                    .put("featureStatus", FeatureStatus.UNAVAILABLE)
                    .put("platform", "android")
                    .put("errorCode", classified.errorCode)
                    .put("retryable", classified.retryable)
                call.resolve(result)
            } catch (e: Exception) {
                Log.w(TAG, "Unexpected exception during checkStatus: type=${e.javaClass.simpleName}")
                val result = JSObject()
                    .put("available", false)
                    .put("status", "unavailable")
                    .put("featureStatus", FeatureStatus.UNAVAILABLE)
                    .put("platform", "android")
                    .put("errorCode", "status_check_failed")
                    .put("retryable", true)
                call.resolve(result)
            }
        }
    }

    /**
     * Gemini Nanoモデルが未ダウンロード（DOWNLOADABLE）またはダウンロード中（DOWNLOADING）の場合にダウンロードを実行し、
     * 進捗を downloadProgress イベントで通知する
     */
    @PluginMethod
    fun downloadModel(call: PluginCall) {
        if (!isDownloading.compareAndSet(false, true)) {
            call.reject("Model download is already in progress", "DOWNLOAD_IN_PROGRESS")
            return
        }

        pluginScope.launch {
            try {
                val model = getOrCreateModel()
                val currentStatus = withContext(Dispatchers.IO) {
                    model.checkStatus()
                }

                if (currentStatus == FeatureStatus.AVAILABLE) {
                    withContext(Dispatchers.IO) {
                        try {
                            model.warmup()
                        } catch (_: Exception) {
                            // warmup失敗は推論時に再初期化されるため無視
                        }
                    }
                    call.resolve(
                        JSObject()
                            .put("status", "available")
                            .put("downloaded", true)
                    )
                    return@launch
                }

                if (currentStatus == FeatureStatus.UNAVAILABLE) {
                    call.reject("Gemini Nano is not available on this device", "MODEL_UNAVAILABLE")
                    return@launch
                }

                var bytesToDownload = 0L
                withContext(Dispatchers.IO) {
                    model.download().collect { downloadStatus ->
                        when (downloadStatus) {
                            is DownloadStatus.DownloadStarted -> {
                                bytesToDownload = downloadStatus.bytesToDownload
                                notifyListeners(
                                    "downloadProgress",
                                    JSObject()
                                        .put("status", "started")
                                        .put("bytesToDownload", bytesToDownload)
                                        .put("totalBytesDownloaded", 0L)
                                )
                            }
                            is DownloadStatus.DownloadProgress -> {
                                notifyListeners(
                                    "downloadProgress",
                                    JSObject()
                                        .put("status", "progress")
                                        .put("bytesToDownload", bytesToDownload)
                                        .put("totalBytesDownloaded", downloadStatus.totalBytesDownloaded)
                                )
                            }
                            is DownloadStatus.DownloadCompleted -> {
                                notifyListeners(
                                    "downloadProgress",
                                    JSObject()
                                        .put("status", "completed")
                                        .put("bytesToDownload", bytesToDownload)
                                        .put("totalBytesDownloaded", bytesToDownload)
                                )
                            }
                            is DownloadStatus.DownloadFailed -> {
                                throw downloadStatus.e
                            }
                        }
                    }
                    try {
                        model.warmup()
                    } catch (_: Exception) {
                        // warmup失敗は無視
                    }
                }

                call.resolve(
                    JSObject()
                        .put("status", "available")
                        .put("downloaded", true)
                )
            } catch (e: CancellationException) {
                call.reject("Model download cancelled", "CANCELLED")
                throw e
            } catch (e: GenAiException) {
                val reason = MealAiHelper.mapErrorCodeToReason(e.errorCode)
                Log.w(TAG, "GenAiException during downloadModel: errorCode=${e.errorCode}")
                call.reject("Model download failed ($reason)", reason.uppercase())
            } catch (e: Exception) {
                Log.w(TAG, "Exception during downloadModel: type=${e.javaClass.simpleName}")
                call.reject("Model download failed", "DOWNLOAD_FAILED")
            } finally {
                isDownloading.set(false)
            }
        }
    }

    /**
     * 個人情報を含まない診断情報（エラーコード・失敗段階・処理時間・試行回数・出力文字数・完了理由など）のJSObjectを構築する
     */
    private fun buildDiagnosticsJsObject(
        stage: String,
        errorCode: String? = null,
        elapsedMs: Long? = null,
        attemptCount: Int? = null,
        responseLength: Int? = null,
        finishReason: String? = null,
        failedField: String? = null,
        structuredOutputAvailable: Boolean? = null,
    ): JSObject {
        val obj = JSObject().put("stage", stage)
        if (!errorCode.isNullOrBlank()) {
            obj.put("errorCode", errorCode)
        }
        if (elapsedMs != null) {
            obj.put("elapsedMs", elapsedMs)
        }
        if (attemptCount != null) {
            obj.put("attemptCount", attemptCount)
        }
        if (responseLength != null) {
            obj.put("responseLength", responseLength)
        }
        if (!finishReason.isNullOrBlank()) {
            obj.put("finishReason", finishReason)
        }
        if (!failedField.isNullOrBlank()) {
            obj.put("failedField", failedField)
        }
        if (structuredOutputAvailable != null) {
            obj.put("structuredOutputAvailable", structuredOutputAvailable)
        }
        return obj
    }

    /**
     * 食事写真（Base64）と任意の補助ヒントからオンデバイスで料理・食品を認識し、カロリー・PFCを推定する。
     * 注意: 個人情報保護のため、画像・ヒント・プロンプト・AIの生レスポンスは一切ログ出力しない。
     */
    @PluginMethod
    fun analyzeMealPhoto(call: PluginCall) {
        val rawPhoto = call.getString("photoBase64")
        val hintText = call.getString("hintText")
        val locale = call.getString("locale") ?: "ja"

        val base64Payload = MealAiHelper.extractBase64Payload(rawPhoto)
        if (base64Payload == null) {
            call.reject(
                "Invalid or oversized meal photo data",
                "INVALID_IMAGE",
                buildDiagnosticsJsObject(
                    stage = "input_validation",
                    errorCode = "INVALID_IMAGE",
                    attemptCount = 0,
                ),
            )
            return
        }

        if (!isAnalyzing.compareAndSet(false, true)) {
            call.reject(
                "Another meal analysis is already in progress",
                "BUSY",
                buildDiagnosticsJsObject(
                    stage = "input_validation",
                    errorCode = "BUSY",
                    attemptCount = 0,
                ),
            )
            return
        }

        pluginScope.launch {
            var bitmap: Bitmap? = null
            var currentStage = "status_check"
            var currentAttemptCount = 0
            var structuredOutputAvailable: Boolean? = null
            val totalStartTimeMs = SystemClock.elapsedRealtime()
            try {
                val model = getOrCreateModel()
                val featureStatus = withContext(Dispatchers.IO) {
                    val status = model.checkStatus()
                    structuredOutputAvailable = try {
                        model.getAvailableFeatures().contains(Feature.STRUCTURED_OUTPUT)
                    } catch (_: Exception) {
                        null
                    }
                    status
                }

                when (featureStatus) {
                    FeatureStatus.AVAILABLE -> {
                        // 推論実行可能
                    }
                    FeatureStatus.DOWNLOADABLE -> {
                        call.reject(
                            "Model download is required before inference",
                            "MODEL_DOWNLOAD_REQUIRED",
                            buildDiagnosticsJsObject(
                                stage = currentStage,
                                errorCode = "MODEL_DOWNLOAD_REQUIRED",
                                attemptCount = 0,
                                structuredOutputAvailable = structuredOutputAvailable,
                            ),
                        )
                        return@launch
                    }
                    FeatureStatus.DOWNLOADING -> {
                        call.reject(
                            "Model is currently downloading",
                            "MODEL_DOWNLOADING",
                            buildDiagnosticsJsObject(
                                stage = currentStage,
                                errorCode = "MODEL_DOWNLOADING",
                                attemptCount = 0,
                                structuredOutputAvailable = structuredOutputAvailable,
                            ),
                        )
                        return@launch
                    }
                    else -> {
                        call.reject(
                            "Gemini Nano is not available on this device",
                            "MODEL_UNAVAILABLE",
                            buildDiagnosticsJsObject(
                                stage = currentStage,
                                errorCode = "MODEL_UNAVAILABLE",
                                attemptCount = 0,
                                structuredOutputAvailable = structuredOutputAvailable,
                            ),
                        )
                        return@launch
                    }
                }

                currentStage = "image_decode"
                val decodedBitmap = withContext(Dispatchers.Default) {
                    decodeNormalizedMealBitmap(base64Payload)
                }
                bitmap = decodedBitmap

                currentStage = "inference"
                val inferenceStartTimeMs = SystemClock.elapsedRealtime()

                val execResult = withContext(Dispatchers.IO) {
                    withTimeout(INFERENCE_TIMEOUT_MS) {
                        MealAiHelper.runInferenceWithFormatRetry(
                            maxAttempts = MealAiHelper.MAX_INFERENCE_ATTEMPTS,
                        ) { attemptIndex, isRetry ->
                            currentAttemptCount = attemptIndex
                            try {
                                model.clearImplicitCaches()
                            } catch (_: Exception) {
                                // 暗黙キャッシュのクリア失敗は推論継続に影響させない
                            }

                            val prompt = MealAiHelper.buildMealAnalysisPrompt(
                                hintText = hintText,
                                locale = locale,
                                isRetry = isRetry,
                            )
                            val request = GenerateContentRequest.Builder(
                                ImagePart(decodedBitmap),
                                TextPart(prompt),
                            ).apply {
                                temperature = if (isRetry) {
                                    MealAiHelper.RETRY_TEMPERATURE
                                } else {
                                    MealAiHelper.INITIAL_TEMPERATURE
                                }
                                candidateCount = 1
                                maxOutputTokens = MealAiHelper.MAX_OUTPUT_TOKENS
                                enableThinking = false
                            }.build()

                            val response = model.generateContent(request)
                            val candidate = response.candidates.firstOrNull()
                            MealAiHelper.RawInferenceAttempt(
                                text = candidate?.text,
                                finishReason = candidate?.finishReason,
                            )
                        }
                    }
                }

                val elapsedMs = max(0L, SystemClock.elapsedRealtime() - inferenceStartTimeMs)

                when (val outcome = execResult.outcome) {
                    is MealAiHelper.ParseOutcome.Success -> {
                        val itemsArray = JSArray()
                        outcome.data.recognizedItems.forEach { item ->
                            itemsArray.put(item)
                        }
                        val diagnostics = buildDiagnosticsJsObject(
                            stage = "completed",
                            elapsedMs = elapsedMs,
                            attemptCount = execResult.attemptCount,
                            responseLength = execResult.lastResponseLength,
                            finishReason = execResult.lastFinishReason,
                            structuredOutputAvailable = structuredOutputAvailable,
                        )
                        val result = JSObject()
                            .put("isFood", true)
                            .put("dishName", outcome.data.dishName)
                            .put("recognizedItems", itemsArray)
                            .put("calories", outcome.data.calories)
                            .put("protein", outcome.data.protein)
                            .put("fat", outcome.data.fat)
                            .put("carbs", outcome.data.carbs)
                            .put("elapsedMs", elapsedMs)
                            .put("diagnostics", diagnostics)
                        call.resolve(result)
                    }
                    is MealAiHelper.ParseOutcome.NotFood -> {
                        val diagnostics = buildDiagnosticsJsObject(
                            stage = "completed",
                            elapsedMs = elapsedMs,
                            attemptCount = execResult.attemptCount,
                            responseLength = execResult.lastResponseLength,
                            finishReason = execResult.lastFinishReason,
                            structuredOutputAvailable = structuredOutputAvailable,
                        )
                        val result = JSObject()
                            .put("isFood", false)
                            .put("dishName", "")
                            .put("recognizedItems", JSArray())
                            .put("elapsedMs", elapsedMs)
                            .put("diagnostics", diagnostics)
                        call.resolve(result)
                    }
                    is MealAiHelper.ParseOutcome.Failure -> {
                        Log.w(
                            TAG,
                            "Validation of AI output failed: code=${outcome.errorCode}, stage=${outcome.stage}, field=${outcome.failedField ?: "none"}, attempts=${execResult.attemptCount}, len=${execResult.lastResponseLength}, finish=${execResult.lastFinishReason}, elapsedMs=$elapsedMs",
                        )
                        val diagnostics = buildDiagnosticsJsObject(
                            stage = outcome.stage,
                            errorCode = outcome.errorCode,
                            elapsedMs = elapsedMs,
                            attemptCount = execResult.attemptCount,
                            responseLength = execResult.lastResponseLength,
                            finishReason = execResult.lastFinishReason,
                            failedField = outcome.failedField,
                            structuredOutputAvailable = structuredOutputAvailable,
                        )
                        call.reject(outcome.reason, outcome.errorCode, diagnostics)
                    }
                }
            } catch (e: TimeoutCancellationException) {
                val elapsedMs = max(0L, SystemClock.elapsedRealtime() - totalStartTimeMs)
                Log.w(TAG, "Meal photo analysis timed out: stage=$currentStage, attempts=$currentAttemptCount, elapsedMs=$elapsedMs")
                call.reject(
                    "Meal analysis timed out",
                    "TIMEOUT",
                    buildDiagnosticsJsObject(
                        stage = currentStage,
                        errorCode = "TIMEOUT",
                        elapsedMs = elapsedMs,
                        attemptCount = currentAttemptCount,
                        structuredOutputAvailable = structuredOutputAvailable,
                    ),
                )
            } catch (e: CancellationException) {
                val elapsedMs = max(0L, SystemClock.elapsedRealtime() - totalStartTimeMs)
                call.reject(
                    "Meal analysis cancelled",
                    "CANCELLED",
                    buildDiagnosticsJsObject(
                        stage = currentStage,
                        errorCode = "CANCELLED",
                        elapsedMs = elapsedMs,
                        attemptCount = currentAttemptCount,
                        structuredOutputAvailable = structuredOutputAvailable,
                    ),
                )
                throw e
            } catch (e: IllegalArgumentException) {
                val elapsedMs = max(0L, SystemClock.elapsedRealtime() - totalStartTimeMs)
                Log.w(TAG, "Invalid image input rejected: stage=$currentStage, elapsedMs=$elapsedMs")
                call.reject(
                    "Invalid meal photo data",
                    "INVALID_IMAGE",
                    buildDiagnosticsJsObject(
                        stage = currentStage,
                        errorCode = "INVALID_IMAGE",
                        elapsedMs = elapsedMs,
                        attemptCount = currentAttemptCount,
                        structuredOutputAvailable = structuredOutputAvailable,
                    ),
                )
            } catch (e: GenAiException) {
                val elapsedMs = max(0L, SystemClock.elapsedRealtime() - totalStartTimeMs)
                val reason = MealAiHelper.mapErrorCodeToReason(e.errorCode)
                val errorCode = reason.uppercase()
                Log.w(
                    TAG,
                    "GenAiException during analyzeMealPhoto: errorCode=${e.errorCode}, mapped=$errorCode, stage=$currentStage, attempts=$currentAttemptCount, elapsedMs=$elapsedMs",
                )
                call.reject(
                    "On-device AI inference failed ($reason)",
                    errorCode,
                    buildDiagnosticsJsObject(
                        stage = currentStage,
                        errorCode = errorCode,
                        elapsedMs = elapsedMs,
                        attemptCount = currentAttemptCount,
                        structuredOutputAvailable = structuredOutputAvailable,
                    ),
                )
            } catch (e: Exception) {
                val elapsedMs = max(0L, SystemClock.elapsedRealtime() - totalStartTimeMs)
                Log.w(
                    TAG,
                    "Unexpected exception during analyzeMealPhoto: type=${e.javaClass.simpleName}, stage=$currentStage, attempts=$currentAttemptCount, elapsedMs=$elapsedMs",
                )
                call.reject(
                    "On-device AI inference failed",
                    "INFERENCE_FAILED",
                    buildDiagnosticsJsObject(
                        stage = currentStage,
                        errorCode = "INFERENCE_FAILED",
                        elapsedMs = elapsedMs,
                        attemptCount = currentAttemptCount,
                        structuredOutputAvailable = structuredOutputAvailable,
                    ),
                )
            } finally {
                try {
                    if (bitmap != null && !bitmap.isRecycled) {
                        bitmap.recycle()
                    }
                } catch (_: Exception) {
                    // recycle失敗は無視
                }
                isAnalyzing.set(false)
            }
        }
    }

    /**
     * Base64画像をサブサンプリングデコードし、EXIFの回転・反転および最大長辺1024pxへの縮小を一括適用する
     */
    private fun decodeNormalizedMealBitmap(base64Payload: String): Bitmap {
        val imageBytes = try {
            Base64.decode(base64Payload, Base64.DEFAULT)
        } catch (e: IllegalArgumentException) {
            throw IllegalArgumentException("Invalid Base64 image data", e)
        }

        if (imageBytes.isEmpty() || imageBytes.size > MealAiHelper.MAX_IMAGE_BYTES) {
            throw IllegalArgumentException("Image byte size is invalid or exceeds limit")
        }

        // 1. ピクセルメモリを確保せず画像サイズのみ取得して検証
        val boundsOptions = BitmapFactory.Options().apply {
            inJustDecodeBounds = true
        }
        BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size, boundsOptions)
        val rawWidth = boundsOptions.outWidth
        val rawHeight = boundsOptions.outHeight
        if (rawWidth <= 0 || rawHeight <= 0) {
            throw IllegalArgumentException("Unable to decode image dimensions")
        }

        // 2. EXIFの回転・反転情報を取得
        val exifOrientation = try {
            ByteArrayInputStream(imageBytes).use { inputStream ->
                ExifInterface(inputStream).getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_NORMAL,
                )
            }
        } catch (_: Exception) {
            ExifInterface.ORIENTATION_NORMAL
        }
        val exifTransform = MealAiHelper.resolveExifTransform(exifOrientation)

        // 3. サブサンプリング倍率（2の累乗）を計算してデコード時のメモリ消費を抑制
        val sampleSize = MealAiHelper.calculateInSampleSize(
            width = rawWidth,
            height = rawHeight,
            maxDimension = MealAiHelper.MAX_IMAGE_DIMENSION,
        )
        val decodeOptions = BitmapFactory.Options().apply {
            inJustDecodeBounds = false
            inSampleSize = sampleSize
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        val sampledBitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size, decodeOptions)
            ?: throw IllegalArgumentException("Failed to decode image bitmap")

        // 4. EXIF回転・反転および最大1024pxへの縮小を単一のMatrixで適用
        val rotatedWidth = if (exifTransform.rotationDegrees == 90 || exifTransform.rotationDegrees == 270) {
            sampledBitmap.height
        } else {
            sampledBitmap.width
        }
        val rotatedHeight = if (exifTransform.rotationDegrees == 90 || exifTransform.rotationDegrees == 270) {
            sampledBitmap.width
        } else {
            sampledBitmap.height
        }
        val (targetWidth, targetHeight) = MealAiHelper.calculateTargetDimensions(
            width = rotatedWidth,
            height = rotatedHeight,
            maxDimension = MealAiHelper.MAX_IMAGE_DIMENSION,
        )

        val needsTransform = exifTransform.rotationDegrees != 0 ||
            exifTransform.flipHorizontal ||
            targetWidth != rotatedWidth ||
            targetHeight != rotatedHeight

        if (!needsTransform) {
            return sampledBitmap
        }

        val matrix = Matrix()
        if (exifTransform.flipHorizontal) {
            matrix.postScale(-1f, 1f, sampledBitmap.width / 2f, sampledBitmap.height / 2f)
        }
        if (exifTransform.rotationDegrees != 0) {
            matrix.postRotate(exifTransform.rotationDegrees.toFloat())
        }
        val scaleX = targetWidth.toFloat() / rotatedWidth.toFloat()
        val scaleY = targetHeight.toFloat() / rotatedHeight.toFloat()
        if (scaleX != 1f || scaleY != 1f) {
            matrix.postScale(scaleX, scaleY)
        }

        val transformed = Bitmap.createBitmap(
            sampledBitmap,
            0,
            0,
            sampledBitmap.width,
            sampledBitmap.height,
            matrix,
            true,
        )
        if (transformed !== sampledBitmap && !sampledBitmap.isRecycled) {
            sampledBitmap.recycle()
        }
        return transformed
    }
}
