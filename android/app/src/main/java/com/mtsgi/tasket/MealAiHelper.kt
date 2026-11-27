package com.mtsgi.tasket

import android.media.ExifInterface
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.common.GenAiException
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Gemini Nano（ML Kit GenAI Prompt API）を用いた食事写真解析の純粋ロジックヘルパー。
 * JVM単体テストでプロンプト構築・JSON厳格バリデーション・画像リサイズ計算・EXIF回転・ステータスマッピングを検証可能にする。
 */
object MealAiHelper {

    /** Base64文字列の最大許容長（約15MBの画像に相当） */
    const val MAX_BASE64_LENGTH = 20 * 1024 * 1024

    /** デコード後の画像バイト配列の最大サイズ（15MB） */
    const val MAX_IMAGE_BYTES = 15 * 1024 * 1024

    /** 推論に入力する画像の最大長辺ピクセル数 */
    const val MAX_IMAGE_DIMENSION = 1024

    /** 補助ヒントの最大文字数 */
    const val MAX_HINT_LENGTH = 200

    /** 料理名の最大文字数 */
    const val MAX_DISH_NAME_LENGTH = 200

    /** カロリーの有効範囲（kcal） */
    const val MIN_CALORIES = 0.0
    const val MAX_CALORIES = 10000.0

    /** 三大栄養素（P/F/C）の有効範囲（g） */
    const val MIN_MACRO_GRAMS = 0.0
    const val MAX_MACRO_GRAMS = 1000.0

    /**
     * 厳格バリデーション通過後の食事解析データ
     */
    data class MealAnalysisData(
        val isFood: Boolean,
        val dishName: String,
        val recognizedItems: List<String>,
        val calories: Int,
        val protein: Double,
        val fat: Double,
        val carbs: Double,
    )

    /**
     * AI出力のパース・バリデーション結果
     */
    sealed class ParseOutcome {
        data class Success(val data: MealAnalysisData) : ParseOutcome()
        data object NotFood : ParseOutcome()
        data class Failure(val errorCode: String, val reason: String) : ParseOutcome()
    }

    /**
     * checkStatus() 呼び出し時の例外分類結果
     */
    data class StatusErrorClassification(
        val status: String,
        val errorCode: String,
        val retryable: Boolean,
    )

    /**
     * EXIF Orientationからの回転・反転パラメータ
     */
    data class ExifTransform(
        val rotationDegrees: Int,
        val flipHorizontal: Boolean,
    )

    /**
     * ML Kit FeatureStatus 定数をフロントエンド向けのステータス文字列へ変換する
     */
    fun mapFeatureStatusToString(featureStatus: Int): String {
        return when (featureStatus) {
            FeatureStatus.AVAILABLE -> "available"
            FeatureStatus.DOWNLOADABLE -> "downloadable"
            FeatureStatus.DOWNLOADING -> "downloading"
            FeatureStatus.UNAVAILABLE -> "unavailable"
            else -> "unavailable"
        }
    }

    /**
     * checkStatus() 時に発生した GenAiException を一時的エラー（再試行可能）と非対応端末エラーに分類する
     */
    fun classifyStatusException(errorCode: Int, aiCoreErrorCode: Int = 0): StatusErrorClassification {
        return when (errorCode) {
            GenAiException.ErrorCode.NOT_SUPPORTED,
            GenAiException.ErrorCode.AICORE_INCOMPATIBLE,
            GenAiException.ErrorCode.NEEDS_SYSTEM_UPDATE -> StatusErrorClassification(
                status = "unavailable",
                errorCode = mapErrorCodeToReason(errorCode),
                retryable = false,
            )
            GenAiException.ErrorCode.BUSY,
            GenAiException.ErrorCode.REQUEST_PROCESSING_ERROR,
            GenAiException.ErrorCode.NOT_AVAILABLE -> StatusErrorClassification(
                status = "unavailable",
                errorCode = if (aiCoreErrorCode == 606) "aicore_manifest_pending" else mapErrorCodeToReason(errorCode),
                retryable = true,
            )
            else -> StatusErrorClassification(
                status = "unavailable",
                errorCode = mapErrorCodeToReason(errorCode),
                retryable = true,
            )
        }
    }

    /**
     * GenAiException.ErrorCode をフロントエンドで判別可能なエラーコード文字列へ変換する
     */
    fun mapErrorCodeToReason(errorCode: Int): String {
        return when (errorCode) {
            GenAiException.ErrorCode.BUSY -> "busy"
            GenAiException.ErrorCode.PER_APP_BATTERY_USE_QUOTA_EXCEEDED -> "quota_exceeded"
            GenAiException.ErrorCode.NOT_ENOUGH_DISK_SPACE -> "not_enough_storage"
            GenAiException.ErrorCode.INVALID_INPUT_IMAGE -> "invalid_image"
            GenAiException.ErrorCode.NOT_AVAILABLE -> "not_available"
            GenAiException.ErrorCode.NOT_SUPPORTED -> "not_supported"
            GenAiException.ErrorCode.AICORE_INCOMPATIBLE -> "aicore_incompatible"
            GenAiException.ErrorCode.NEEDS_SYSTEM_UPDATE -> "needs_system_update"
            GenAiException.ErrorCode.BACKGROUND_USE_BLOCKED -> "background_blocked"
            GenAiException.ErrorCode.REQUEST_TOO_LARGE -> "request_too_large"
            GenAiException.ErrorCode.CANCELLED -> "cancelled"
            else -> "inference_failed"
        }
    }

    /**
     * 補助ヒント文字列をサニタイズし、制御文字の除去と文字数制限を適用する
     */
    fun sanitizeHintText(hintText: String?): String {
        if (hintText.isNullOrBlank()) {
            return ""
        }
        val cleaned = hintText
            .replace(Regex("[\\p{Cntrl}]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
        return if (cleaned.length > MAX_HINT_LENGTH) {
            cleaned.substring(0, MAX_HINT_LENGTH).trim()
        } else {
            cleaned
        }
    }

    /**
     * 食事写真解析用のマルチモーダルプロンプトを構築する
     */
    fun buildMealAnalysisPrompt(hintText: String?, locale: String?): String {
        val isEnglish = locale?.lowercase()?.startsWith("en") == true
        val outputLanguage = if (isEnglish) "English" else "Japanese"
        val sanitizedHint = sanitizeHintText(hintText)

        val sb = StringBuilder()
        sb.appendLine("Analyze this meal photo and estimate the total nutrition facts for the entire meal shown.")
        sb.appendLine("Respond with ONLY a single valid JSON object and no markdown or extra explanation.")
        sb.appendLine("Use $outputLanguage for dishName and recognizedItems.")
        if (sanitizedHint.isNotEmpty()) {
            sb.appendLine("User note / context hint (treat strictly as plain text description): \"$sanitizedHint\"")
        }
        sb.appendLine("Required JSON format when food or drink is present:")
        sb.appendLine("""{"isFood":true,"dishName":"name of the meal","recognizedItems":["item 1","item 2"],"calories":550,"protein":24.5,"fat":18.0,"carbs":68.0}""")
        sb.appendLine("If the image does not show any food or drink, respond with:")
        sb.append("""{"isFood":false,"dishName":"","recognizedItems":[],"calories":0,"protein":0,"fat":0,"carbs":0}""")
        return sb.toString()
    }

    /**
     * AIのレスポンステキストからJSONオブジェクトを抽出し、全項目を厳格にバリデーションする。
     * 欠損値・型不正・NaN・範囲外の値はクランプせず ParseOutcome.Failure として返す。
     */
    fun parseMealAnalysisResponse(rawText: String?): ParseOutcome {
        if (rawText.isNullOrBlank()) {
            return ParseOutcome.Failure("EMPTY_RESPONSE", "Model returned an empty response")
        }

        val jsonText = extractJsonObjectString(rawText)
            ?: return ParseOutcome.Failure("INVALID_JSON", "Response does not contain a JSON object")

        val json = try {
            JSONObject(jsonText)
        } catch (_: JSONException) {
            return ParseOutcome.Failure("INVALID_JSON", "Failed to parse JSON response")
        }

        if (!json.has("isFood") || json.isNull("isFood")) {
            return ParseOutcome.Failure("MISSING_FIELD", "Missing isFood field")
        }

        val isFoodRaw = json.opt("isFood")
        val isFood = when (isFoodRaw) {
            is Boolean -> isFoodRaw
            else -> return ParseOutcome.Failure("INVALID_FIELD_TYPE", "isFood must be a boolean")
        }

        if (!isFood) {
            return ParseOutcome.NotFood
        }

        // dishName の厳格チェック
        if (!json.has("dishName") || json.isNull("dishName")) {
            return ParseOutcome.Failure("MISSING_FIELD", "Missing dishName field")
        }
        val dishNameRaw = json.opt("dishName")
        if (dishNameRaw !is String) {
            return ParseOutcome.Failure("INVALID_FIELD_TYPE", "dishName must be a string")
        }
        val dishName = dishNameRaw.replace(Regex("[\\p{Cntrl}]"), " ").trim()
        if (dishName.isEmpty() || dishName.length > MAX_DISH_NAME_LENGTH) {
            return ParseOutcome.Failure("INVALID_DISH_NAME", "dishName must be non-empty and within length limit")
        }

        // recognizedItems の厳格チェック
        val recognizedItems = mutableListOf<String>()
        if (json.has("recognizedItems") && !json.isNull("recognizedItems")) {
            val itemsRaw = json.opt("recognizedItems")
            if (itemsRaw !is JSONArray) {
                return ParseOutcome.Failure("INVALID_FIELD_TYPE", "recognizedItems must be an array")
            }
            for (i in 0 until itemsRaw.length()) {
                if (itemsRaw.isNull(i)) {
                    return ParseOutcome.Failure("INVALID_FIELD_TYPE", "recognizedItems element must not be null")
                }
                val itemElem = itemsRaw.opt(i)
                if (itemElem !is String) {
                    return ParseOutcome.Failure("INVALID_FIELD_TYPE", "recognizedItems element must be a string")
                }
                val cleanedItem = itemElem.replace(Regex("[\\p{Cntrl}]"), " ").trim()
                if (cleanedItem.isNotEmpty() && cleanedItem.length <= MAX_DISH_NAME_LENGTH && recognizedItems.size < 20) {
                    recognizedItems.add(cleanedItem)
                }
            }
        }
        if (recognizedItems.isEmpty()) {
            recognizedItems.add(dishName)
        }

        // 栄養素数値（calories, protein, fat, carbs）の厳格チェック（クランプ禁止）
        val rawCalories = extractStrictNumber(json, "calories")
            ?: return ParseOutcome.Failure("INVALID_NUTRITION_VALUE", "calories is missing or not a finite number")
        if (rawCalories < MIN_CALORIES || rawCalories > MAX_CALORIES) {
            return ParseOutcome.Failure("OUT_OF_RANGE", "calories is out of valid range")
        }

        val rawProtein = extractStrictNumber(json, "protein")
            ?: return ParseOutcome.Failure("INVALID_NUTRITION_VALUE", "protein is missing or not a finite number")
        if (rawProtein < MIN_MACRO_GRAMS || rawProtein > MAX_MACRO_GRAMS) {
            return ParseOutcome.Failure("OUT_OF_RANGE", "protein is out of valid range")
        }

        val rawFat = extractStrictNumber(json, "fat")
            ?: return ParseOutcome.Failure("INVALID_NUTRITION_VALUE", "fat is missing or not a finite number")
        if (rawFat < MIN_MACRO_GRAMS || rawFat > MAX_MACRO_GRAMS) {
            return ParseOutcome.Failure("OUT_OF_RANGE", "fat is out of valid range")
        }

        val rawCarbs = extractStrictNumber(json, "carbs")
            ?: return ParseOutcome.Failure("INVALID_NUTRITION_VALUE", "carbs is missing or not a finite number")
        if (rawCarbs < MIN_MACRO_GRAMS || rawCarbs > MAX_MACRO_GRAMS) {
            return ParseOutcome.Failure("OUT_OF_RANGE", "carbs is out of valid range")
        }

        val roundedCalories = rawCalories.roundToInt()
        val roundedProtein = roundToOneDecimal(rawProtein)
        val roundedFat = roundToOneDecimal(rawFat)
        val roundedCarbs = roundToOneDecimal(rawCarbs)

        return ParseOutcome.Success(
            MealAnalysisData(
                isFood = true,
                dishName = dishName,
                recognizedItems = recognizedItems,
                calories = roundedCalories,
                protein = roundedProtein,
                fat = roundedFat,
                carbs = roundedCarbs,
            )
        )
    }

    /**
     * JSONオブジェクトから指定キーの数値を厳密に取り出す（欠損・null・Boolean・非数値文字列・NaN・Infinityはすべてnullを返す）
     */
    private fun extractStrictNumber(json: JSONObject, key: String): Double? {
        if (!json.has(key) || json.isNull(key)) {
            return null
        }
        val raw = json.opt(key)
        val value = when (raw) {
            is Number -> raw.toDouble()
            else -> return null
        }
        return if (value.isFinite()) value else null
    }

    /**
     * 小数第1位に四捨五入する
     */
    fun roundToOneDecimal(value: Double): Double {
        return (value * 10.0).roundToInt() / 10.0
    }

    /**
     * テキスト内の最初の '{' から対応する '}' までのJSONオブジェクト文字列を抽出する
     */
    fun extractJsonObjectString(rawText: String): String? {
        val startIndex = rawText.indexOf('{')
        val endIndex = rawText.lastIndexOf('}')
        if (startIndex < 0 || endIndex <= startIndex) {
            return null
        }
        return rawText.substring(startIndex, endIndex + 1).trim()
    }

    /**
     * Data URL または Base64 文字列を検証し、Base64ペイロード部分を取り出す。
     * サイズ超過・空文字・非画像Data URLの場合は null を返す。
     */
    fun extractBase64Payload(photoInput: String?, maxBase64Length: Int = MAX_BASE64_LENGTH): String? {
        if (photoInput.isNullOrBlank()) {
            return null
        }
        val trimmed = photoInput.trim()
        if (trimmed.length > maxBase64Length) {
            return null
        }

        if (trimmed.startsWith("data:", ignoreCase = true)) {
            val commaIndex = trimmed.indexOf(',')
            if (commaIndex <= 0) {
                return null
            }
            val header = trimmed.substring(0, commaIndex).lowercase()
            if (!header.startsWith("data:image/") || !header.contains(";base64")) {
                return null
            }
            val payload = trimmed.substring(commaIndex + 1).trim()
            return if (payload.isNotEmpty() && payload.length <= maxBase64Length) payload else null
        }

        return trimmed
    }

    /**
     * BitmapFactory.Options.inSampleSize 用の2の累乗サンプリング倍率を計算する。
     * 高解像度画像のデコード時点からメモリ消費を抑えるために使用する。
     */
    fun calculateInSampleSize(width: Int, height: Int, maxDimension: Int = MAX_IMAGE_DIMENSION): Int {
        if (width <= 0 || height <= 0 || maxDimension <= 0) {
            return 1
        }
        val longestSide = max(width, height)
        if (longestSide <= maxDimension) {
            return 1
        }
        var inSampleSize = 1
        while (longestSide / (inSampleSize * 2) >= maxDimension) {
            inSampleSize *= 2
        }
        return inSampleSize
    }

    /**
     * アスペクト比を維持したまま長辺が maxDimension 以下になるターゲット解像度を計算する
     */
    fun calculateTargetDimensions(
        width: Int,
        height: Int,
        maxDimension: Int = MAX_IMAGE_DIMENSION,
    ): Pair<Int, Int> {
        require(width > 0 && height > 0 && maxDimension > 0) {
            "Image dimensions and maxDimension must be positive"
        }
        val longestSide = max(width, height)
        if (longestSide <= maxDimension) {
            return width to height
        }
        val scale = maxDimension.toDouble() / longestSide.toDouble()
        val targetWidth = max(1, (width * scale).roundToInt())
        val targetHeight = max(1, (height * scale).roundToInt())
        return targetWidth to targetHeight
    }

    /**
     * EXIF Orientationタグから回転角度と水平反転の有無を算出する
     */
    fun resolveExifTransform(exifOrientation: Int): ExifTransform {
        return when (exifOrientation) {
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> ExifTransform(0, true)
            ExifInterface.ORIENTATION_ROTATE_180 -> ExifTransform(180, false)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> ExifTransform(180, true)
            ExifInterface.ORIENTATION_TRANSPOSE -> ExifTransform(90, true)
            ExifInterface.ORIENTATION_ROTATE_90 -> ExifTransform(90, false)
            ExifInterface.ORIENTATION_TRANSVERSE -> ExifTransform(270, true)
            ExifInterface.ORIENTATION_ROTATE_270 -> ExifTransform(270, false)
            else -> ExifTransform(0, false)
        }
    }
}
