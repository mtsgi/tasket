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

    /** 推論時の最大出力トークン数（日本語の料理名・複数品目のJSON途中切断を防ぐため1024に設定） */
    const val MAX_OUTPUT_TOKENS = 1024

    /** JSON形式不正・スキーマ検証失敗時の最大推論試行回数（初回 + 自動リトライ1回 = 最大2回） */
    const val MAX_INFERENCE_ATTEMPTS = 2

    /** 初回推論時のtemperature */
    const val INITIAL_TEMPERATURE = 0.0f

    /** JSON形式不正による自動再試行時のtemperature */
    const val RETRY_TEMPERATURE = 0.2f

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

    /** 推論方式定数 */
    const val INFERENCE_MODE_TYPED = "typed"
    const val INFERENCE_MODE_FREEFORM = "freeform"
    const val INFERENCE_MODE_TYPED_THEN_FREEFORM = "typed_then_freeform"
    const val INFERENCE_MODE_NONE = "none"

    /** 必須出力フィールド一覧（診断用、順序固定） */
    val REQUIRED_FIELDS = listOf(
        "isFood",
        "dishName",
        "recognizedItems",
        "calories",
        "protein",
        "fat",
        "carbs",
    )

    /** ルートJSONオブジェクトに混入し得るJSON Schema定義用キー一覧 */
    val SCHEMA_DEFINITION_KEYS = listOf(
        "properties",
        "required",
        "type",
        "\$schema",
    )

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
     * AI出力のパース・バリデーション結果（個人情報を含まない診断メタデータ付き）
     */
    sealed class ParseOutcome {
        data class Success(
            val data: MealAnalysisData,
            val fieldPresence: String = "isFood:bool,dishName:str,recognizedItems:arr,calories:num,protein:num,fat:num,carbs:num",
            val hasSchemaKeys: Boolean = false,
        ) : ParseOutcome()

        data object NotFood : ParseOutcome()

        data class Failure(
            val errorCode: String,
            val reason: String,
            val stage: String = "schema_validation",
            val failedField: String? = null,
            val validationReason: String? = null,
            val fieldPresence: String? = null,
            val hasSchemaKeys: Boolean = false,
        ) : ParseOutcome()
    }

    /**
     * 自由形式（GenerateContentRequest）単一回のオンデバイス推論の生出力
     */
    data class RawInferenceAttempt(
        val text: String?,
        val finishReason: Int? = null,
    )

    /**
     * 型付き出力（GenerateTypedContentRequest）単一回のオンデバイス推論の出力
     */
    data class TypedInferenceAttempt(
        val response: TypedMealAnalysisResult?,
        val finishReason: Int? = null,
    )

    /**
     * 自動リトライ／フォールバックを含む推論・パース実行結果（個人情報を含まない診断メタデータ付き）
     */
    data class InferenceExecutionResult(
        val outcome: ParseOutcome,
        val attemptCount: Int,
        val lastResponseLength: Int,
        val lastFinishReason: String,
        val inferenceMode: String = INFERENCE_MODE_FREEFORM,
        val structuredOutputAvailable: Boolean = false,
        val fieldPresence: String? = null,
        val validationReason: String? = null,
        val hasSchemaKeys: Boolean = false,
    )

    /**
     * 栄養素フィールド1項目の厳格検証結果
     */
    private sealed class NutritionFieldValidation {
        data class Valid(val value: Double) : NutritionFieldValidation()
        data class Invalid(val failure: ParseOutcome.Failure) : NutritionFieldValidation()
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
     * Candidate.FinishReason / TypedFinishReason 定数を個人情報を含まない診断用ラベルへ変換する
     */
    fun finishReasonToName(finishReason: Int?): String {
        return when (finishReason) {
            0 -> "STOP"
            1 -> "MAX_TOKENS"
            -100 -> "OTHER"
            null -> "NONE"
            else -> "UNKNOWN_$finishReason"
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
            -104 -> "structured_output_invalid_class"
            -106 -> "output_truncated"
            -105 -> "invalid_json"
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
     * 公式 Structured Output API（@Generable / generateTypedContentRequest）用の簡潔なプロンプトを構築する。
     * スキーマ定義はKSP生成の GenerableProvider からSDK/AICoreへ直接渡されるため、プロンプト内にJSON Schemaを再記述しない。
     */
    fun buildTypedMealAnalysisPrompt(
        hintText: String?,
        locale: String?,
    ): String {
        val isEnglish = locale?.lowercase()?.startsWith("en") == true
        val outputLanguage = if (isEnglish) "English" else "Japanese"
        val sanitizedHint = sanitizeHintText(hintText)

        val sb = StringBuilder()
        sb.appendLine("Determine if this photo shows food or drink, and estimate the total nutrition facts for the entire meal shown.")
        sb.appendLine("If the photo does NOT show food or drink, set isFood to false, dishName to \"\", recognizedItems to [], and calories, protein, fat, carbs to 0.")
        sb.appendLine("If food or drink is shown, set isFood to true, write dishName and recognizedItems (up to 8 main items) in $outputLanguage, and estimate actual numeric values for calories (kcal), protein (g), fat (g), and carbs (g) based on the visible dishes and portion sizes.")
        sb.appendLine("Always populate every required field with a non-null value, and output calories, protein, fat, and carbs as numeric values without unit strings.")
        if (sanitizedHint.isNotEmpty()) {
            sb.appendLine("User note / context hint (plain text description): \"$sanitizedHint\"")
        }
        return sb.toString().trim()
    }

    /**
     * 自由形式出力（Structured Output API非対応端末またはフォールバック時）用の改善プロンプトを構築する。
     * - 巨大なJSON Schema定義をプロンプトに含めない（スキーマ自体のオウム返し出力を防止）。
     * - 固定のカロリー・PFC例示値（550, 24.5等）を含めない（例示値の丸写しバイアスを防止）。
     * - 必須7キー・型・単位・JSON数値出力（単位文字列の禁止）を簡潔かつ明確に指示する。
     */
    fun buildFreeformMealAnalysisPrompt(
        hintText: String?,
        locale: String?,
        isRetry: Boolean = false,
    ): String {
        val isEnglish = locale?.lowercase()?.startsWith("en") == true
        val outputLanguage = if (isEnglish) "English" else "Japanese"
        val sanitizedHint = sanitizeHintText(hintText)

        val sb = StringBuilder()
        sb.appendLine("Analyze this meal photo and return ONLY a single flat JSON object with the estimated nutrition facts for the entire meal shown.")
        sb.appendLine("Do NOT output markdown code fences, explanations, or a JSON Schema definition (do NOT include keys such as \"type\", \"properties\", or \"required\").")
        sb.appendLine("You MUST include ALL 7 required keys below in the root JSON object without omitting any key or setting any value to null:")
        sb.appendLine("- \"isFood\": boolean (true if the photo shows food or drink, false otherwise)")
        sb.appendLine("- \"dishName\": string (meal name in $outputLanguage, or \"\" if isFood is false)")
        sb.appendLine("- \"recognizedItems\": array of strings (up to 8 food item names in $outputLanguage, or [] if isFood is false)")
        sb.appendLine("- \"calories\": JSON number (estimated total energy in kcal as a bare number between 0 and 10000, NOT a string)")
        sb.appendLine("- \"protein\": JSON number (estimated total protein in grams as a bare number between 0 and 1000, NOT a string)")
        sb.appendLine("- \"fat\": JSON number (estimated total fat in grams as a bare number between 0 and 1000, NOT a string)")
        sb.appendLine("- \"carbs\": JSON number (estimated total carbohydrates in grams as a bare number between 0 and 1000, NOT a string)")
        sb.appendLine("Estimate actual nutrition numbers from the visible food and portion sizes in the photo. Never wrap numbers in quotes and never attach unit text like \"kcal\" or \"g\".")
        if (sanitizedHint.isNotEmpty()) {
            sb.appendLine("User note / context hint (treat strictly as plain text description): \"$sanitizedHint\"")
        }
        if (isRetry) {
            sb.appendLine("IMPORTANT RETRY INSTRUCTION: Return ONLY one raw JSON object starting with '{' and ending with '}' containing the 7 keys (isFood, dishName, recognizedItems, calories, protein, fat, carbs) where calories, protein, fat, and carbs are bare JSON numbers.")
        }
        return sb.toString().trim()
    }

    /**
     * 食事写真解析用のマルチモーダルプロンプトを構築する（自由形式フォールバックプロンプトへの委譲）
     */
    fun buildMealAnalysisPrompt(
        hintText: String?,
        locale: String?,
        isRetry: Boolean = false,
    ): String {
        return buildFreeformMealAnalysisPrompt(hintText, locale, isRetry)
    }

    /**
     * ルートJSONオブジェクト内の必須7フィールドの存在状況およびJSON型を個人情報を含まない診断文字列として返す。
     * 例: "isFood:bool,dishName:str,recognizedItems:arr,calories:num,protein:num,fat:num,carbs:num"
     */
    fun inspectFieldPresence(json: JSONObject): String {
        return REQUIRED_FIELDS.joinToString(",") { key ->
            val tag = if (!json.has(key)) {
                "missing"
            } else if (json.isNull(key)) {
                "null"
            } else {
                when (json.opt(key)) {
                    is Boolean -> "bool"
                    is Number -> "num"
                    is String -> "str"
                    is JSONArray -> "arr"
                    is JSONObject -> "obj"
                    else -> "other"
                }
            }
            "$key:$tag"
        }
    }

    /**
     * 型付き出力オブジェクト（TypedMealAnalysisResult）のフィールド存在状況を診断文字列として返す
     */
    fun inspectTypedFieldPresence(typed: TypedMealAnalysisResult?): String? {
        if (typed == null) {
            return null
        }
        val dishNameAny: Any? = typed.dishName
        val itemsAny: Any? = typed.recognizedItems
        val dishTag = if (dishNameAny == null) "null" else "str"
        val itemsTag = if (itemsAny == null) "null" else "arr"
        return "isFood:bool,dishName:$dishTag,recognizedItems:$itemsTag,calories:num,protein:num,fat:num,carbs:num"
    }

    /**
     * ルートJSONオブジェクトに properties, required, type, $schema などのスキーマ定義用キーが存在するか判定する
     */
    fun detectHasSchemaKeys(json: JSONObject): Boolean {
        return SCHEMA_DEFINITION_KEYS.any { key -> json.has(key) && !json.isNull(key) }
    }

    /**
     * AIが推定データではなくJSON Schema定義そのものを出力してしまったケースか判定する
     */
    fun isSchemaDefinitionEcho(json: JSONObject): Boolean {
        if (!detectHasSchemaKeys(json)) {
            return false
        }
        val hasSchemaContainer = json.opt("properties") is JSONObject || json.opt("required") is JSONArray
        val isFoodVal = if (json.has("isFood") && !json.isNull("isFood")) json.opt("isFood") else null
        return hasSchemaContainer && isFoodVal !is Boolean
    }

    /**
     * 型付き推論結果のおおよそのシリアライズ文字数を算出する（ログ出力せず文字数のみ返す）
     */
    fun estimateTypedResponseLength(typed: TypedMealAnalysisResult?): Int {
        if (typed == null) {
            return 0
        }
        val dishLen = (typed.dishName as Any?)?.toString()?.length ?: 0
        val itemsLen = ((typed.recognizedItems as Any?) as? Iterable<*>)?.sumOf { (it?.toString()?.length ?: 0) + 3 } ?: 0
        return 95 + dishLen + itemsLen
    }

    /**
     * TypedResponseHelper が投げる GenAiException メッセージから、インメモリ診断用にのみ生レスポンステキストを抽出する。
     * 抽出した文字列は一切ログ出力せず、フィールド存在状況・文字数・スキーマキー判定のみに使用する。
     */
    fun extractRawResponseFromTypedException(exceptionMessage: String?): String? {
        if (exceptionMessage.isNullOrBlank()) {
            return null
        }
        val markers = listOf(". Response: ", ", Response: ")
        for (marker in markers) {
            val idx = exceptionMessage.indexOf(marker)
            if (idx >= 0) {
                val extracted = exceptionMessage.substring(idx + marker.length).trim()
                if (extracted.isNotEmpty()) {
                    return extracted
                }
            }
        }
        return null
    }

    /**
     * Structured Output API 呼び出し時の GenAiException のうち、自由形式出力へのフォールバック対象となるか判定する。
     * キャンセル・ストレージ不足・クォータ超過・不正画像・ビジーではフォールバックしない。
     */
    fun shouldFallbackFromTypedException(errorCode: Int): Boolean {
        return when (errorCode) {
            GenAiException.ErrorCode.CANCELLED,
            GenAiException.ErrorCode.NOT_ENOUGH_DISK_SPACE,
            GenAiException.ErrorCode.PER_APP_BATTERY_USE_QUOTA_EXCEEDED,
            GenAiException.ErrorCode.BACKGROUND_USE_BLOCKED,
            GenAiException.ErrorCode.INVALID_INPUT_IMAGE,
            GenAiException.ErrorCode.BUSY -> false
            else -> true
        }
    }

    /**
     * パース結果がJSON形式不正・スキーマ検証エラーにより自動再試行／フォールバックの対象となるか判定する。
     * 非食品判定（NotFood）や成功（Success）の場合は再試行しない。
     */
    fun shouldRetryOnParseFailure(outcome: ParseOutcome): Boolean {
        return outcome is ParseOutcome.Failure
    }

    /**
     * Structured Output API（型付き推論）と自由形式出力（フォールバック）を組み合わせたハイブリッド推論実行ヘルパー。
     * - structuredOutputAvailable == true の場合:
     *   1回目は公式 Structured Output API (typed) で実行し、型付き検証エラーまたは構造化出力例外が発生した場合のみ、
     *   2回目に改善済み自由形式出力 (freeform) へフォールバックする（inferenceMode = "typed_then_freeform"）。
     * - structuredOutputAvailable == false の場合:
     *   自由形式出力 (freeform) で実行し、JSON形式・スキーマ検証エラー時に最大1回自動再試行する（inferenceMode = "freeform"）。
     */
    suspend fun runHybridInference(
        structuredOutputAvailable: Boolean,
        maxAttempts: Int = MAX_INFERENCE_ATTEMPTS,
        performTypedAttempt: suspend (attemptIndex: Int) -> TypedInferenceAttempt,
        performFreeformAttempt: suspend (attemptIndex: Int, isRetry: Boolean) -> RawInferenceAttempt,
    ): InferenceExecutionResult {
        val totalAttempts = max(1, maxAttempts)

        if (structuredOutputAvailable) {
            var typedFinishReason = finishReasonToName(null)
            var typedResponseLength = 0
            val firstOutcome: ParseOutcome = try {
                val typedAttempt = performTypedAttempt(1)
                typedFinishReason = finishReasonToName(typedAttempt.finishReason)
                typedResponseLength = estimateTypedResponseLength(typedAttempt.response)
                validateTypedMealAnalysisResult(typedAttempt.response, typedAttempt.finishReason)
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: GenAiException) {
                if (!shouldFallbackFromTypedException(e.errorCode)) {
                    throw e
                }
                val isTruncated = e.errorCode == -106
                typedFinishReason = if (isTruncated) "MAX_TOKENS" else "OTHER"
                val extractedRaw = extractRawResponseFromTypedException(e.message)
                if (extractedRaw != null) {
                    typedResponseLength = extractedRaw.length
                    val inspected = parseMealAnalysisResponse(extractedRaw, if (isTruncated) 1 else 0)
                    if (inspected is ParseOutcome.Failure) {
                        inspected
                    } else {
                        ParseOutcome.Failure(
                            errorCode = "INVALID_JSON",
                            reason = "Structured output deserialization failed",
                            stage = "response_parse",
                            validationReason = "typed_deserialization_error",
                        )
                    }
                } else {
                    ParseOutcome.Failure(
                        errorCode = if (isTruncated) "OUTPUT_TRUNCATED" else "INVALID_JSON",
                        reason = "Structured output request failed (code=${e.errorCode})",
                        stage = "response_parse",
                        validationReason = if (isTruncated) "truncated_json" else "typed_deserialization_error",
                    )
                }
            }

            if (!shouldRetryOnParseFailure(firstOutcome) || totalAttempts < 2) {
                return buildExecutionResult(
                    outcome = firstOutcome,
                    attemptCount = 1,
                    lastResponseLength = typedResponseLength,
                    lastFinishReason = typedFinishReason,
                    inferenceMode = INFERENCE_MODE_TYPED,
                    structuredOutputAvailable = true,
                )
            }

            // Attempt 2: Structured Output が失敗したため、改善済み自由形式出力（freeform）へフォールバック
            val fallbackAttempt = performFreeformAttempt(2, true)
            val fallbackLength = fallbackAttempt.text?.length ?: 0
            val fallbackFinish = finishReasonToName(fallbackAttempt.finishReason)
            val fallbackOutcome = parseMealAnalysisResponse(fallbackAttempt.text, fallbackAttempt.finishReason)
            return buildExecutionResult(
                outcome = fallbackOutcome,
                attemptCount = 2,
                lastResponseLength = fallbackLength,
                lastFinishReason = fallbackFinish,
                inferenceMode = INFERENCE_MODE_TYPED_THEN_FREEFORM,
                structuredOutputAvailable = true,
            )
        }

        // Structured Output 非対応環境: 自由形式出力（freeform）で最大2回（初回 + 自動リトライ1回）
        var lastOutcome: ParseOutcome = ParseOutcome.Failure(
            errorCode = "EMPTY_RESPONSE",
            reason = "Model returned an empty response",
            stage = "response_parse",
            validationReason = "empty_response",
        )
        var executedAttempts = 0
        var lastResponseLength = 0
        var lastFinishReason = finishReasonToName(null)

        for (attemptIndex in 1..totalAttempts) {
            executedAttempts = attemptIndex
            val isRetry = attemptIndex > 1
            val rawAttempt = performFreeformAttempt(attemptIndex, isRetry)
            lastResponseLength = rawAttempt.text?.length ?: 0
            lastFinishReason = finishReasonToName(rawAttempt.finishReason)
            val outcome = parseMealAnalysisResponse(rawAttempt.text, rawAttempt.finishReason)
            lastOutcome = outcome
            if (!shouldRetryOnParseFailure(outcome)) {
                break
            }
        }

        return buildExecutionResult(
            outcome = lastOutcome,
            attemptCount = executedAttempts,
            lastResponseLength = lastResponseLength,
            lastFinishReason = lastFinishReason,
            inferenceMode = INFERENCE_MODE_FREEFORM,
            structuredOutputAvailable = false,
        )
    }

    /**
     * JSON形式不正・スキーマ検証エラー時に限り、最大1回（合計最大2回）まで自動再試行を行う自由形式推論ヘルパー。
     */
    suspend fun runInferenceWithFormatRetry(
        maxAttempts: Int = MAX_INFERENCE_ATTEMPTS,
        performAttempt: suspend (attemptIndex: Int, isRetry: Boolean) -> RawInferenceAttempt,
    ): InferenceExecutionResult {
        return runHybridInference(
            structuredOutputAvailable = false,
            maxAttempts = maxAttempts,
            performTypedAttempt = { TypedInferenceAttempt(null, null) },
            performFreeformAttempt = performAttempt,
        )
    }

    private fun buildExecutionResult(
        outcome: ParseOutcome,
        attemptCount: Int,
        lastResponseLength: Int,
        lastFinishReason: String,
        inferenceMode: String,
        structuredOutputAvailable: Boolean,
    ): InferenceExecutionResult {
        return when (outcome) {
            is ParseOutcome.Success -> InferenceExecutionResult(
                outcome = outcome,
                attemptCount = attemptCount,
                lastResponseLength = lastResponseLength,
                lastFinishReason = lastFinishReason,
                inferenceMode = inferenceMode,
                structuredOutputAvailable = structuredOutputAvailable,
                fieldPresence = outcome.fieldPresence,
                validationReason = null,
                hasSchemaKeys = outcome.hasSchemaKeys,
            )
            is ParseOutcome.NotFood -> InferenceExecutionResult(
                outcome = outcome,
                attemptCount = attemptCount,
                lastResponseLength = lastResponseLength,
                lastFinishReason = lastFinishReason,
                inferenceMode = inferenceMode,
                structuredOutputAvailable = structuredOutputAvailable,
                fieldPresence = "isFood:bool",
                validationReason = null,
                hasSchemaKeys = false,
            )
            is ParseOutcome.Failure -> InferenceExecutionResult(
                outcome = outcome,
                attemptCount = attemptCount,
                lastResponseLength = lastResponseLength,
                lastFinishReason = lastFinishReason,
                inferenceMode = inferenceMode,
                structuredOutputAvailable = structuredOutputAvailable,
                fieldPresence = outcome.fieldPresence,
                validationReason = outcome.validationReason,
                hasSchemaKeys = outcome.hasSchemaKeys,
            )
        }
    }

    /**
     * 公式 Structured Output API から返却された TypedMealAnalysisResult を厳格にバリデーションする。
     * クランプや欠損値の補完は一切行わず、範囲外・非有限数値・空の料理名は ParseOutcome.Failure として拒否する。
     */
    fun validateTypedMealAnalysisResult(
        typed: TypedMealAnalysisResult?,
        finishReason: Int? = null,
    ): ParseOutcome {
        val isMaxTokens = finishReason == 1
        if (typed == null) {
            return if (isMaxTokens) {
                ParseOutcome.Failure(
                    errorCode = "OUTPUT_TRUNCATED",
                    reason = "Typed model output was truncated due to MAX_TOKENS",
                    stage = "response_parse",
                    validationReason = "truncated_json",
                )
            } else {
                ParseOutcome.Failure(
                    errorCode = "EMPTY_RESPONSE",
                    reason = "Typed model response was null",
                    stage = "response_parse",
                    validationReason = "null_typed_response",
                )
            }
        }

        val fieldPresence = inspectTypedFieldPresence(typed)

        if (!typed.isFood) {
            return ParseOutcome.NotFood
        }

        val rawDishAny: Any? = typed.dishName
        if (rawDishAny !is String) {
            return ParseOutcome.Failure(
                errorCode = "MISSING_FIELD",
                reason = "dishName is null",
                stage = "schema_validation",
                failedField = "dishName",
                validationReason = "null_value",
                fieldPresence = fieldPresence,
                hasSchemaKeys = false,
            )
        }
        val dishName = rawDishAny.replace(Regex("[\\p{Cntrl}]"), " ").trim()
        if (dishName.isEmpty()) {
            return ParseOutcome.Failure(
                errorCode = "INVALID_DISH_NAME",
                reason = "dishName must be non-empty",
                stage = "schema_validation",
                failedField = "dishName",
                validationReason = "empty_string",
                fieldPresence = fieldPresence,
                hasSchemaKeys = false,
            )
        }
        if (dishName.length > MAX_DISH_NAME_LENGTH) {
            return ParseOutcome.Failure(
                errorCode = "INVALID_DISH_NAME",
                reason = "dishName exceeds maximum length",
                stage = "schema_validation",
                failedField = "dishName",
                validationReason = "string_too_long",
                fieldPresence = fieldPresence,
                hasSchemaKeys = false,
            )
        }

        val recognizedItems = mutableListOf<String>()
        val rawItemsAny: Any? = typed.recognizedItems
        if (rawItemsAny != null) {
            if (rawItemsAny !is List<*>) {
                return ParseOutcome.Failure(
                    errorCode = "INVALID_FIELD_TYPE",
                    reason = "recognizedItems must be a list",
                    stage = "schema_validation",
                    failedField = "recognizedItems",
                    validationReason = "type_mismatch",
                    fieldPresence = fieldPresence,
                    hasSchemaKeys = false,
                )
            }
            for (elem in rawItemsAny) {
                if (elem == null) {
                    return ParseOutcome.Failure(
                        errorCode = "INVALID_FIELD_TYPE",
                        reason = "recognizedItems element must not be null",
                        stage = "schema_validation",
                        failedField = "recognizedItems",
                        validationReason = "null_value",
                        fieldPresence = fieldPresence,
                        hasSchemaKeys = false,
                    )
                }
                if (elem !is String) {
                    return ParseOutcome.Failure(
                        errorCode = "INVALID_FIELD_TYPE",
                        reason = "recognizedItems element must be a string",
                        stage = "schema_validation",
                        failedField = "recognizedItems",
                        validationReason = "type_mismatch",
                        fieldPresence = fieldPresence,
                        hasSchemaKeys = false,
                    )
                }
                val cleanedItem = elem.replace(Regex("[\\p{Cntrl}]"), " ").trim()
                if (cleanedItem.isNotEmpty() && cleanedItem.length <= MAX_DISH_NAME_LENGTH && recognizedItems.size < 20) {
                    recognizedItems.add(cleanedItem)
                }
            }
        }
        if (recognizedItems.isEmpty()) {
            recognizedItems.add(dishName)
        }

        // 栄養素数値（calories, protein, fat, carbs）の厳格検証（クランプ禁止）
        if (!typed.calories.isFinite()) {
            return ParseOutcome.Failure(
                errorCode = "INVALID_NUTRITION_VALUE",
                reason = "calories is not a finite number",
                stage = "schema_validation",
                failedField = "calories",
                validationReason = "non_finite_number",
                fieldPresence = fieldPresence,
                hasSchemaKeys = false,
            )
        }
        if (typed.calories < MIN_CALORIES || typed.calories > MAX_CALORIES) {
            return ParseOutcome.Failure(
                errorCode = "OUT_OF_RANGE",
                reason = "calories is out of valid range",
                stage = "schema_validation",
                failedField = "calories",
                validationReason = "out_of_range",
                fieldPresence = fieldPresence,
                hasSchemaKeys = false,
            )
        }

        if (!typed.protein.isFinite()) {
            return ParseOutcome.Failure(
                errorCode = "INVALID_NUTRITION_VALUE",
                reason = "protein is not a finite number",
                stage = "schema_validation",
                failedField = "protein",
                validationReason = "non_finite_number",
                fieldPresence = fieldPresence,
                hasSchemaKeys = false,
            )
        }
        if (typed.protein < MIN_MACRO_GRAMS || typed.protein > MAX_MACRO_GRAMS) {
            return ParseOutcome.Failure(
                errorCode = "OUT_OF_RANGE",
                reason = "protein is out of valid range",
                stage = "schema_validation",
                failedField = "protein",
                validationReason = "out_of_range",
                fieldPresence = fieldPresence,
                hasSchemaKeys = false,
            )
        }

        if (!typed.fat.isFinite()) {
            return ParseOutcome.Failure(
                errorCode = "INVALID_NUTRITION_VALUE",
                reason = "fat is not a finite number",
                stage = "schema_validation",
                failedField = "fat",
                validationReason = "non_finite_number",
                fieldPresence = fieldPresence,
                hasSchemaKeys = false,
            )
        }
        if (typed.fat < MIN_MACRO_GRAMS || typed.fat > MAX_MACRO_GRAMS) {
            return ParseOutcome.Failure(
                errorCode = "OUT_OF_RANGE",
                reason = "fat is out of valid range",
                stage = "schema_validation",
                failedField = "fat",
                validationReason = "out_of_range",
                fieldPresence = fieldPresence,
                hasSchemaKeys = false,
            )
        }

        if (!typed.carbs.isFinite()) {
            return ParseOutcome.Failure(
                errorCode = "INVALID_NUTRITION_VALUE",
                reason = "carbs is not a finite number",
                stage = "schema_validation",
                failedField = "carbs",
                validationReason = "non_finite_number",
                fieldPresence = fieldPresence,
                hasSchemaKeys = false,
            )
        }
        if (typed.carbs < MIN_MACRO_GRAMS || typed.carbs > MAX_MACRO_GRAMS) {
            return ParseOutcome.Failure(
                errorCode = "OUT_OF_RANGE",
                reason = "carbs is out of valid range",
                stage = "schema_validation",
                failedField = "carbs",
                validationReason = "out_of_range",
                fieldPresence = fieldPresence,
                hasSchemaKeys = false,
            )
        }

        return ParseOutcome.Success(
            data = MealAnalysisData(
                isFood = true,
                dishName = dishName,
                recognizedItems = recognizedItems,
                calories = typed.calories.roundToInt(),
                protein = roundToOneDecimal(typed.protein),
                fat = roundToOneDecimal(typed.fat),
                carbs = roundToOneDecimal(typed.carbs),
            ),
            fieldPresence = fieldPresence ?: "isFood:bool,dishName:str,recognizedItems:arr,calories:num,protein:num,fat:num,carbs:num",
            hasSchemaKeys = false,
        )
    }

    /**
     * AIのレスポンステキストからJSONオブジェクトを抽出し、全項目を厳格にバリデーションする。
     * 欠損値・型不正・NaN・範囲外の値はクランプせず ParseOutcome.Failure として返す。
     */
    fun parseMealAnalysisResponse(rawText: String?, finishReason: Int? = null): ParseOutcome {
        if (rawText.isNullOrBlank()) {
            return ParseOutcome.Failure(
                errorCode = "EMPTY_RESPONSE",
                reason = "Model returned an empty response",
                stage = "response_parse",
                validationReason = "empty_response",
            )
        }

        val isMaxTokens = finishReason == 1
        val jsonText = extractJsonObjectString(rawText)
        if (jsonText == null) {
            return if (isMaxTokens || hasUnclosedJsonObject(rawText)) {
                ParseOutcome.Failure(
                    errorCode = "OUTPUT_TRUNCATED",
                    reason = "Model output was truncated before completing JSON object",
                    stage = "response_parse",
                    validationReason = "truncated_json",
                )
            } else {
                ParseOutcome.Failure(
                    errorCode = "INVALID_JSON",
                    reason = "Response does not contain a JSON object",
                    stage = "response_parse",
                    validationReason = "json_not_found",
                )
            }
        }

        val json = try {
            JSONObject(jsonText)
        } catch (_: JSONException) {
            return if (isMaxTokens) {
                ParseOutcome.Failure(
                    errorCode = "OUTPUT_TRUNCATED",
                    reason = "Model output hit maxOutputTokens and produced incomplete JSON",
                    stage = "response_parse",
                    validationReason = "truncated_json",
                )
            } else {
                ParseOutcome.Failure(
                    errorCode = "INVALID_JSON",
                    reason = "Failed to parse JSON response",
                    stage = "response_parse",
                    validationReason = "json_parse_error",
                )
            }
        }

        val fieldPresence = inspectFieldPresence(json)
        val hasSchemaKeys = detectHasSchemaKeys(json)

        // JSON Schema定義そのものが回答として返却された場合の検出
        if (isSchemaDefinitionEcho(json)) {
            return ParseOutcome.Failure(
                errorCode = "SCHEMA_ECHO",
                reason = "Model returned a JSON Schema definition instead of meal analysis values",
                stage = "schema_validation",
                failedField = "isFood",
                validationReason = "schema_echo",
                fieldPresence = fieldPresence,
                hasSchemaKeys = true,
            )
        }

        if (!json.has("isFood")) {
            return ParseOutcome.Failure(
                errorCode = "MISSING_FIELD",
                reason = "Missing isFood field",
                stage = "schema_validation",
                failedField = "isFood",
                validationReason = "missing_key",
                fieldPresence = fieldPresence,
                hasSchemaKeys = hasSchemaKeys,
            )
        }
        if (json.isNull("isFood")) {
            return ParseOutcome.Failure(
                errorCode = "MISSING_FIELD",
                reason = "isFood field is null",
                stage = "schema_validation",
                failedField = "isFood",
                validationReason = "null_value",
                fieldPresence = fieldPresence,
                hasSchemaKeys = hasSchemaKeys,
            )
        }

        val isFoodRaw = json.opt("isFood")
        val isFood = when (isFoodRaw) {
            is Boolean -> isFoodRaw
            is String -> return ParseOutcome.Failure(
                errorCode = "INVALID_FIELD_TYPE",
                reason = "isFood must be a boolean, not a string",
                stage = "schema_validation",
                failedField = "isFood",
                validationReason = "string_type",
                fieldPresence = fieldPresence,
                hasSchemaKeys = hasSchemaKeys,
            )
            else -> return ParseOutcome.Failure(
                errorCode = "INVALID_FIELD_TYPE",
                reason = "isFood must be a boolean",
                stage = "schema_validation",
                failedField = "isFood",
                validationReason = "type_mismatch",
                fieldPresence = fieldPresence,
                hasSchemaKeys = hasSchemaKeys,
            )
        }

        if (!isFood) {
            return ParseOutcome.NotFood
        }

        // dishName の厳格チェック
        if (!json.has("dishName")) {
            return ParseOutcome.Failure(
                errorCode = "MISSING_FIELD",
                reason = "Missing dishName field",
                stage = "schema_validation",
                failedField = "dishName",
                validationReason = "missing_key",
                fieldPresence = fieldPresence,
                hasSchemaKeys = hasSchemaKeys,
            )
        }
        if (json.isNull("dishName")) {
            return ParseOutcome.Failure(
                errorCode = "MISSING_FIELD",
                reason = "dishName field is null",
                stage = "schema_validation",
                failedField = "dishName",
                validationReason = "null_value",
                fieldPresence = fieldPresence,
                hasSchemaKeys = hasSchemaKeys,
            )
        }
        val dishNameRaw = json.opt("dishName")
        if (dishNameRaw !is String) {
            return ParseOutcome.Failure(
                errorCode = "INVALID_FIELD_TYPE",
                reason = "dishName must be a string",
                stage = "schema_validation",
                failedField = "dishName",
                validationReason = "type_mismatch",
                fieldPresence = fieldPresence,
                hasSchemaKeys = hasSchemaKeys,
            )
        }
        val dishName = dishNameRaw.replace(Regex("[\\p{Cntrl}]"), " ").trim()
        if (dishName.isEmpty()) {
            return ParseOutcome.Failure(
                errorCode = "INVALID_DISH_NAME",
                reason = "dishName must be non-empty",
                stage = "schema_validation",
                failedField = "dishName",
                validationReason = "empty_string",
                fieldPresence = fieldPresence,
                hasSchemaKeys = hasSchemaKeys,
            )
        }
        if (dishName.length > MAX_DISH_NAME_LENGTH) {
            return ParseOutcome.Failure(
                errorCode = "INVALID_DISH_NAME",
                reason = "dishName exceeds length limit",
                stage = "schema_validation",
                failedField = "dishName",
                validationReason = "string_too_long",
                fieldPresence = fieldPresence,
                hasSchemaKeys = hasSchemaKeys,
            )
        }

        // recognizedItems の厳格チェック
        val recognizedItems = mutableListOf<String>()
        if (json.has("recognizedItems") && !json.isNull("recognizedItems")) {
            val itemsRaw = json.opt("recognizedItems")
            if (itemsRaw is String) {
                return ParseOutcome.Failure(
                    errorCode = "INVALID_FIELD_TYPE",
                    reason = "recognizedItems must be an array, not a string",
                    stage = "schema_validation",
                    failedField = "recognizedItems",
                    validationReason = "string_type",
                    fieldPresence = fieldPresence,
                    hasSchemaKeys = hasSchemaKeys,
                )
            }
            if (itemsRaw !is JSONArray) {
                return ParseOutcome.Failure(
                    errorCode = "INVALID_FIELD_TYPE",
                    reason = "recognizedItems must be an array",
                    stage = "schema_validation",
                    failedField = "recognizedItems",
                    validationReason = "type_mismatch",
                    fieldPresence = fieldPresence,
                    hasSchemaKeys = hasSchemaKeys,
                )
            }
            for (i in 0 until itemsRaw.length()) {
                if (itemsRaw.isNull(i)) {
                    return ParseOutcome.Failure(
                        errorCode = "INVALID_FIELD_TYPE",
                        reason = "recognizedItems element must not be null",
                        stage = "schema_validation",
                        failedField = "recognizedItems",
                        validationReason = "null_value",
                        fieldPresence = fieldPresence,
                        hasSchemaKeys = hasSchemaKeys,
                    )
                }
                val itemElem = itemsRaw.opt(i)
                if (itemElem !is String) {
                    return ParseOutcome.Failure(
                        errorCode = "INVALID_FIELD_TYPE",
                        reason = "recognizedItems element must be a string",
                        stage = "schema_validation",
                        failedField = "recognizedItems",
                        validationReason = "type_mismatch",
                        fieldPresence = fieldPresence,
                        hasSchemaKeys = hasSchemaKeys,
                    )
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

        // 栄養素数値（calories, protein, fat, carbs）の厳格チェック（クランプ禁止・0補完禁止）
        val rawCalories = when (
            val calCheck = validateStrictNutritionField(
                json = json,
                key = "calories",
                min = MIN_CALORIES,
                max = MAX_CALORIES,
                fieldPresence = fieldPresence,
                hasSchemaKeys = hasSchemaKeys,
            )
        ) {
            is NutritionFieldValidation.Valid -> calCheck.value
            is NutritionFieldValidation.Invalid -> return calCheck.failure
        }

        val rawProtein = when (
            val protCheck = validateStrictNutritionField(
                json = json,
                key = "protein",
                min = MIN_MACRO_GRAMS,
                max = MAX_MACRO_GRAMS,
                fieldPresence = fieldPresence,
                hasSchemaKeys = hasSchemaKeys,
            )
        ) {
            is NutritionFieldValidation.Valid -> protCheck.value
            is NutritionFieldValidation.Invalid -> return protCheck.failure
        }

        val rawFat = when (
            val fatCheck = validateStrictNutritionField(
                json = json,
                key = "fat",
                min = MIN_MACRO_GRAMS,
                max = MAX_MACRO_GRAMS,
                fieldPresence = fieldPresence,
                hasSchemaKeys = hasSchemaKeys,
            )
        ) {
            is NutritionFieldValidation.Valid -> fatCheck.value
            is NutritionFieldValidation.Invalid -> return fatCheck.failure
        }

        val rawCarbs = when (
            val carbsCheck = validateStrictNutritionField(
                json = json,
                key = "carbs",
                min = MIN_MACRO_GRAMS,
                max = MAX_MACRO_GRAMS,
                fieldPresence = fieldPresence,
                hasSchemaKeys = hasSchemaKeys,
            )
        ) {
            is NutritionFieldValidation.Valid -> carbsCheck.value
            is NutritionFieldValidation.Invalid -> return carbsCheck.failure
        }

        val roundedCalories = rawCalories.roundToInt()
        val roundedProtein = roundToOneDecimal(rawProtein)
        val roundedFat = roundToOneDecimal(rawFat)
        val roundedCarbs = roundToOneDecimal(rawCarbs)

        return ParseOutcome.Success(
            data = MealAnalysisData(
                isFood = true,
                dishName = dishName,
                recognizedItems = recognizedItems,
                calories = roundedCalories,
                protein = roundedProtein,
                fat = roundedFat,
                carbs = roundedCarbs,
            ),
            fieldPresence = fieldPresence,
            hasSchemaKeys = hasSchemaKeys,
        )
    }

    /**
     * JSONオブジェクトから指定キーの栄養素数値を厳密に検証・抽出し、
     * 失敗時は具体的な理由（missing_key / null_value / string_type / type_mismatch / non_finite_number / out_of_range）を返す。
     */
    private fun validateStrictNutritionField(
        json: JSONObject,
        key: String,
        min: Double,
        max: Double,
        fieldPresence: String,
        hasSchemaKeys: Boolean,
    ): NutritionFieldValidation {
        if (!json.has(key)) {
            return NutritionFieldValidation.Invalid(
                ParseOutcome.Failure(
                    errorCode = "INVALID_NUTRITION_VALUE",
                    reason = "$key key is missing",
                    stage = "schema_validation",
                    failedField = key,
                    validationReason = "missing_key",
                    fieldPresence = fieldPresence,
                    hasSchemaKeys = hasSchemaKeys,
                ),
            )
        }
        if (json.isNull(key)) {
            return NutritionFieldValidation.Invalid(
                ParseOutcome.Failure(
                    errorCode = "INVALID_NUTRITION_VALUE",
                    reason = "$key is null",
                    stage = "schema_validation",
                    failedField = key,
                    validationReason = "null_value",
                    fieldPresence = fieldPresence,
                    hasSchemaKeys = hasSchemaKeys,
                ),
            )
        }
        val raw = json.opt(key)
        if (raw is String) {
            return NutritionFieldValidation.Invalid(
                ParseOutcome.Failure(
                    errorCode = "INVALID_NUTRITION_VALUE",
                    reason = "$key must be a JSON number, not a string",
                    stage = "schema_validation",
                    failedField = key,
                    validationReason = "string_type",
                    fieldPresence = fieldPresence,
                    hasSchemaKeys = hasSchemaKeys,
                ),
            )
        }
        if (raw !is Number) {
            return NutritionFieldValidation.Invalid(
                ParseOutcome.Failure(
                    errorCode = "INVALID_NUTRITION_VALUE",
                    reason = "$key must be a JSON number",
                    stage = "schema_validation",
                    failedField = key,
                    validationReason = "type_mismatch",
                    fieldPresence = fieldPresence,
                    hasSchemaKeys = hasSchemaKeys,
                ),
            )
        }
        val value = raw.toDouble()
        if (!value.isFinite()) {
            return NutritionFieldValidation.Invalid(
                ParseOutcome.Failure(
                    errorCode = "INVALID_NUTRITION_VALUE",
                    reason = "$key must be a finite number",
                    stage = "schema_validation",
                    failedField = key,
                    validationReason = "non_finite_number",
                    fieldPresence = fieldPresence,
                    hasSchemaKeys = hasSchemaKeys,
                ),
            )
        }
        if (value < min || value > max) {
            return NutritionFieldValidation.Invalid(
                ParseOutcome.Failure(
                    errorCode = "OUT_OF_RANGE",
                    reason = "$key is out of valid range",
                    stage = "schema_validation",
                    failedField = key,
                    validationReason = "out_of_range",
                    fieldPresence = fieldPresence,
                    hasSchemaKeys = hasSchemaKeys,
                ),
            )
        }
        return NutritionFieldValidation.Valid(value)
    }

    /**
     * 小数第1位に四捨五入する
     */
    fun roundToOneDecimal(value: Double): Double {
        return (value * 10.0).roundToInt() / 10.0
    }

    /**
     * テキスト内の最初の '{' から、文字列リテラル外の対応する '}' までのバランスしたJSONオブジェクト文字列を抽出する
     */
    fun extractJsonObjectString(rawText: String): String? {
        val startIndex = rawText.indexOf('{')
        if (startIndex < 0) {
            return null
        }
        var depth = 0
        var inString = false
        var escaped = false
        for (i in startIndex until rawText.length) {
            val ch = rawText[i]
            if (escaped) {
                escaped = false
                continue
            }
            if (ch == '\\' && inString) {
                escaped = true
                continue
            }
            if (ch == '"') {
                inString = !inString
                continue
            }
            if (!inString) {
                if (ch == '{') {
                    depth += 1
                } else if (ch == '}') {
                    depth -= 1
                    if (depth == 0) {
                        return rawText.substring(startIndex, i + 1).trim()
                    }
                }
            }
        }
        return null
    }

    /**
     * '{' でJSONオブジェクトが開始されているが閉じ括弧 '}' が不足し途中切断されているか判定する
     */
    fun hasUnclosedJsonObject(rawText: String): Boolean {
        val startIndex = rawText.indexOf('{')
        if (startIndex < 0) {
            return false
        }
        return extractJsonObjectString(rawText) == null
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
