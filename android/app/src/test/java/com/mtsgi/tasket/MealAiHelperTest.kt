package com.mtsgi.tasket

import android.media.ExifInterface
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.common.GenAiException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * MealAiHelper のJVM単体テスト。
 * 実際の org.json.JSONObject を使用してAI出力のJSON抽出・厳格バリデーション（クランプ禁止）・
 * プロンプト構築・画像サイズ/EXIF計算・FeatureStatusマッピングを検証する。
 */
class MealAiHelperTest {

    @Test
    fun `mapFeatureStatusToString maps ML Kit FeatureStatus constants accurately`() {
        assertEquals("available", MealAiHelper.mapFeatureStatusToString(FeatureStatus.AVAILABLE))
        assertEquals("downloadable", MealAiHelper.mapFeatureStatusToString(FeatureStatus.DOWNLOADABLE))
        assertEquals("downloading", MealAiHelper.mapFeatureStatusToString(FeatureStatus.DOWNLOADING))
        assertEquals("unavailable", MealAiHelper.mapFeatureStatusToString(FeatureStatus.UNAVAILABLE))
        assertEquals("unavailable", MealAiHelper.mapFeatureStatusToString(-99))
    }

    @Test
    fun `classifyStatusException distinguishes permanent unsupported devices from transient AICore errors`() {
        val notSupported = MealAiHelper.classifyStatusException(GenAiException.ErrorCode.NOT_SUPPORTED)
        assertEquals("unavailable", notSupported.status)
        assertEquals("not_supported", notSupported.errorCode)
        assertFalse(notSupported.retryable)

        val incompatible = MealAiHelper.classifyStatusException(GenAiException.ErrorCode.AICORE_INCOMPATIBLE)
        assertFalse(incompatible.retryable)

        val manifestPending = MealAiHelper.classifyStatusException(GenAiException.ErrorCode.NOT_AVAILABLE, 606)
        assertEquals("aicore_manifest_pending", manifestPending.errorCode)
        assertTrue(manifestPending.retryable)

        val busy = MealAiHelper.classifyStatusException(GenAiException.ErrorCode.BUSY)
        assertEquals("busy", busy.errorCode)
        assertTrue(busy.retryable)
    }

    @Test
    fun `buildTypedMealAnalysisPrompt and buildFreeformMealAnalysisPrompt eliminate example number bias and schema echo risk`() {
        val typedJa = MealAiHelper.buildTypedMealAnalysisPrompt("  醤油ラーメン\n大盛り\t ", "ja")
        assertTrue(typedJa.contains("Japanese"))
        assertTrue(typedJa.contains("醤油ラーメン 大盛り"))
        assertFalse(typedJa.contains("\n大盛り"))
        // 型付き推論用プロンプトにはJSON Schema定義を含めない
        assertFalse(typedJa.contains("\"properties\""))

        val freeformJa = MealAiHelper.buildFreeformMealAnalysisPrompt("  鮭定食\nご飯大盛り\t ", "ja")
        assertTrue(freeformJa.contains("Japanese"))
        assertTrue(freeformJa.contains("鮭定食 ご飯大盛り"))
        assertFalse(freeformJa.contains("\nご飯大盛り"))
        assertFalse(freeformJa.contains("IMPORTANT RETRY INSTRUCTION"))

        // 旧プロンプトで問題となった具体的な栄養素例示値（550, 24.5, 18.0, 68.0）が含まれていないことを検証
        assertFalse(typedJa.contains("550"))
        assertFalse(typedJa.contains("24.5"))
        assertFalse(freeformJa.contains("550"))
        assertFalse(freeformJa.contains("24.5"))
        assertFalse(freeformJa.contains("18.0"))
        assertFalse(freeformJa.contains("68.0"))

        // 自由形式プロンプトがJSON Schema自体の出力を禁止し、7必須キーとJSON数値型を明示していることを検証
        assertTrue(freeformJa.contains("do NOT include keys such as \"type\", \"properties\", or \"required\""))
        for (field in MealAiHelper.REQUIRED_FIELDS) {
            assertTrue(freeformJa.contains("\"$field\""))
        }

        val promptEnRetry = MealAiHelper.buildFreeformMealAnalysisPrompt(null, "en-US", isRetry = true)
        assertTrue(promptEnRetry.contains("English"))
        assertFalse(promptEnRetry.contains("User note / context hint"))
        assertTrue(promptEnRetry.contains("IMPORTANT RETRY INSTRUCTION"))

        // 200文字を超えるヒントは切り詰められる
        val longHint = "あ".repeat(250)
        val sanitized = MealAiHelper.sanitizeHintText(longHint)
        assertEquals(MealAiHelper.MAX_HINT_LENGTH, sanitized.length)
    }

    @Test
    fun `validateTypedMealAnalysisResult validates @Generable TypedMealAnalysisResult and rounds nutrition values`() {
        val validTyped = TypedMealAnalysisResult(
            isFood = true,
            dishName = "  味噌ラーメン  ",
            recognizedItems = listOf("味噌ラーメン", "チャーシュー", "味玉"),
            calories = 742.6,
            protein = 28.44,
            fat = 24.16,
            carbs = 96.85,
        )
        val outcome = MealAiHelper.validateTypedMealAnalysisResult(validTyped, finishReason = 0)
        assertTrue(outcome is MealAiHelper.ParseOutcome.Success)
        val success = outcome as MealAiHelper.ParseOutcome.Success
        assertEquals("味噌ラーメン", success.data.dishName)
        assertEquals(listOf("味噌ラーメン", "チャーシュー", "味玉"), success.data.recognizedItems)
        assertEquals(743, success.data.calories)
        assertEquals(28.4, success.data.protein, 0.001)
        assertEquals(24.2, success.data.fat, 0.001)
        assertEquals(96.9, success.data.carbs, 0.001)
        assertEquals(
            "isFood:bool,dishName:str,recognizedItems:arr,calories:num,protein:num,fat:num,carbs:num",
            success.fieldPresence,
        )
        assertFalse(success.hasSchemaKeys)

        // isFood: false の型付き出力
        val notFoodTyped = TypedMealAnalysisResult(isFood = false)
        assertTrue(MealAiHelper.validateTypedMealAnalysisResult(notFoodTyped, finishReason = 0) is MealAiHelper.ParseOutcome.NotFood)

        // 範囲外の型付き出力（クランプせず OUT_OF_RANGE / out_of_range として拒否）
        val outOfRangeTyped = TypedMealAnalysisResult(
            isFood = true,
            dishName = "ラーメン",
            recognizedItems = listOf("ラーメン"),
            calories = 12000.0,
            protein = 25.0,
            fat = 20.0,
            carbs = 80.0,
        )
        val rangeFailure = MealAiHelper.validateTypedMealAnalysisResult(outOfRangeTyped, finishReason = 0)
        assertTrue(rangeFailure is MealAiHelper.ParseOutcome.Failure)
        assertEquals("OUT_OF_RANGE", (rangeFailure as MealAiHelper.ParseOutcome.Failure).errorCode)
        assertEquals("calories", rangeFailure.failedField)
        assertEquals("out_of_range", rangeFailure.validationReason)

        // null レスポンス（MAX_TOKENS時は OUTPUT_TRUNCATED、それ以外は EMPTY_RESPONSE）
        val maxTokenNull = MealAiHelper.validateTypedMealAnalysisResult(null, finishReason = 1)
        assertEquals("OUTPUT_TRUNCATED", (maxTokenNull as MealAiHelper.ParseOutcome.Failure).errorCode)
        assertEquals("truncated_json", maxTokenNull.validationReason)

        val stopNull = MealAiHelper.validateTypedMealAnalysisResult(null, finishReason = 0)
        assertEquals("EMPTY_RESPONSE", (stopNull as MealAiHelper.ParseOutcome.Failure).errorCode)
        assertEquals("null_typed_response", stopNull.validationReason)
    }

    @Test
    fun `parseMealAnalysisResponse detects JSON Schema echo when model outputs schema definition itself`() {
        val echoedSchema = """
            {
              "type": "object",
              "description": "Meal photo nutrition estimation result",
              "properties": {
                "isFood": {"type": "boolean"},
                "dishName": {"type": "string"},
                "recognizedItems": {"type": "array"},
                "calories": {"type": "integer"},
                "protein": {"type": "number"},
                "fat": {"type": "number"},
                "carbs": {"type": "number"}
              },
              "required": ["isFood", "dishName", "recognizedItems", "calories", "protein", "fat", "carbs"]
            }
        """.trimIndent()

        val outcome = MealAiHelper.parseMealAnalysisResponse(echoedSchema, finishReason = 0)
        assertTrue(outcome is MealAiHelper.ParseOutcome.Failure)
        val failure = outcome as MealAiHelper.ParseOutcome.Failure
        assertEquals("SCHEMA_ECHO", failure.errorCode)
        assertEquals("schema_validation", failure.stage)
        assertEquals("isFood", failure.failedField)
        assertEquals("schema_echo", failure.validationReason)
        assertTrue(failure.hasSchemaKeys)
        assertEquals(
            "isFood:missing,dishName:missing,recognizedItems:missing,calories:missing,protein:missing,fat:missing,carbs:missing",
            failure.fieldPresence,
        )
    }

    @Test
    fun `parseMealAnalysisResponse parses valid JSON and rounds calories to integer and PFC to 1 decimal`() {
        val raw = """
            ```json
            {
              "isFood": true,
              "dishName": "鮭定食",
              "recognizedItems": ["焼き鮭", "白米", "味噌汁"],
              "calories": 618.6,
              "protein": 32.46,
              "fat": 15.84,
              "carbs": 78.05
            }
            ```
        """.trimIndent()

        val outcome = MealAiHelper.parseMealAnalysisResponse(raw, finishReason = 0)
        assertTrue(outcome is MealAiHelper.ParseOutcome.Success)
        val data = (outcome as MealAiHelper.ParseOutcome.Success).data
        assertTrue(data.isFood)
        assertEquals("鮭定食", data.dishName)
        assertEquals(listOf("焼き鮭", "白米", "味噌汁"), data.recognizedItems)
        assertEquals(619, data.calories)
        assertEquals(32.5, data.protein, 0.001)
        assertEquals(15.8, data.fat, 0.001)
        assertEquals(78.1, data.carbs, 0.001)
    }

    @Test
    fun `extractJsonObjectString extracts first balanced JSON object even when trailing text has braces`() {
        val rawWithTrailingBraces = """
            {"isFood":true,"dishName":"うどん {並}","recognizedItems":["うどん"],"calories":350,"protein":10.5,"fat":2.0,"carbs":68.5}
            Note: {estimated from image}
        """.trimIndent()

        val extracted = MealAiHelper.extractJsonObjectString(rawWithTrailingBraces)
        assertNotNull(extracted)
        val outcome = MealAiHelper.parseMealAnalysisResponse(rawWithTrailingBraces)
        assertTrue(outcome is MealAiHelper.ParseOutcome.Success)
        assertEquals("うどん {並}", (outcome as MealAiHelper.ParseOutcome.Success).data.dishName)
    }

    @Test
    fun `parseMealAnalysisResponse detects OUTPUT_TRUNCATED when finishReason is MAX_TOKENS or JSON is unclosed`() {
        val truncatedRaw = """{"isFood":true,"dishName":"幕の内弁当","recognizedItems":["焼き魚","卵焼き","唐揚げ"""
        val outcomeMaxTokens = MealAiHelper.parseMealAnalysisResponse(truncatedRaw, finishReason = 1)
        assertTrue(outcomeMaxTokens is MealAiHelper.ParseOutcome.Failure)
        val failure1 = outcomeMaxTokens as MealAiHelper.ParseOutcome.Failure
        assertEquals("OUTPUT_TRUNCATED", failure1.errorCode)
        assertEquals("response_parse", failure1.stage)
        assertEquals("truncated_json", failure1.validationReason)

        // finishReason が STOP(0) または null でも '{' が閉じられていない場合は OUTPUT_TRUNCATED として検出する
        val outcomeUnclosed = MealAiHelper.parseMealAnalysisResponse(truncatedRaw, finishReason = 0)
        assertTrue(outcomeUnclosed is MealAiHelper.ParseOutcome.Failure)
        assertEquals("OUTPUT_TRUNCATED", (outcomeUnclosed as MealAiHelper.ParseOutcome.Failure).errorCode)
        assertEquals("truncated_json", outcomeUnclosed.validationReason)
    }

    @Test
    fun `runHybridInference selects typed mode when available, falls back to freeform on typed failure, and uses freeform when unavailable`() = kotlinx.coroutines.runBlocking {
        // 1. Structured Output 対応時: 1回目の typed 推論で成功すれば attemptCount = 1, inferenceMode = "typed"
        var typedCalls1 = 0
        var freeformCalls1 = 0
        val res1 = MealAiHelper.runHybridInference(
            structuredOutputAvailable = true,
            performTypedAttempt = { attempt ->
                typedCalls1 = attempt
                MealAiHelper.TypedInferenceAttempt(
                    response = TypedMealAnalysisResult(
                        isFood = true,
                        dishName = "豚骨ラーメン",
                        recognizedItems = listOf("豚骨ラーメン", "チャーシュー"),
                        calories = 820.0,
                        protein = 31.5,
                        fat = 34.0,
                        carbs = 88.0,
                    ),
                    finishReason = 0,
                )
            },
            performFreeformAttempt = { attempt, _ ->
                freeformCalls1 = attempt
                MealAiHelper.RawInferenceAttempt(null, 0)
            },
        )
        assertEquals(1, typedCalls1)
        assertEquals(0, freeformCalls1)
        assertEquals(1, res1.attemptCount)
        assertEquals(MealAiHelper.INFERENCE_MODE_TYPED, res1.inferenceMode)
        assertTrue(res1.structuredOutputAvailable)
        assertTrue(res1.outcome is MealAiHelper.ParseOutcome.Success)

        // 2. Structured Output 対応時: 1回目の typed 推論が検証失敗（または構造化出力例外）したとき、
        //    2回目に自動で freeform フォールバックを実行し inferenceMode = "typed_then_freeform" となること
        var typedCalls2 = 0
        var freeformCalls2 = 0
        val res2 = MealAiHelper.runHybridInference(
            structuredOutputAvailable = true,
            performTypedAttempt = { attempt ->
                typedCalls2 = attempt
                throw GenAiException(
                    "JSON structure does not match expected type. FinishReason: 0. Response: {\"isFood\":true,\"dishName\":\"ラーメン\",\"calories\":\"800kcal\"}",
                    null,
                    -105,
                )
            },
            performFreeformAttempt = { attempt, isRetry ->
                freeformCalls2 = attempt
                assertTrue(isRetry)
                MealAiHelper.RawInferenceAttempt(
                    text = """{"isFood":true,"dishName":"醤油ラーメン","recognizedItems":["醤油ラーメン"],"calories":680,"protein":26.0,"fat":18.5,"carbs":92.0}""",
                    finishReason = 0,
                )
            },
        )
        assertEquals(1, typedCalls2)
        assertEquals(2, freeformCalls2)
        assertEquals(2, res2.attemptCount)
        assertEquals(MealAiHelper.INFERENCE_MODE_TYPED_THEN_FREEFORM, res2.inferenceMode)
        assertTrue(res2.outcome is MealAiHelper.ParseOutcome.Success)

        // 3. Structured Output 非対応時: freeform で実行され、1回目失敗→2回目再試行で成功すること
        var typedCalls3 = 0
        var freeformCalls3 = 0
        val res3 = MealAiHelper.runHybridInference(
            structuredOutputAvailable = false,
            performTypedAttempt = { attempt ->
                typedCalls3 = attempt
                MealAiHelper.TypedInferenceAttempt(null, 0)
            },
            performFreeformAttempt = { attempt, _ ->
                freeformCalls3 = attempt
                if (attempt == 1) {
                    MealAiHelper.RawInferenceAttempt(
                        text = """{"isFood":true,"dishName":"ハンバーグ""",
                        finishReason = 1,
                    )
                } else {
                    MealAiHelper.RawInferenceAttempt(
                        text = """{"isFood":true,"dishName":"ハンバーグ定食","recognizedItems":["ハンバーグ","ライス"],"calories":780,"protein":34.2,"fat":32.5,"carbs":82.0}""",
                        finishReason = 0,
                    )
                }
            },
        )
        assertEquals(0, typedCalls3)
        assertEquals(2, freeformCalls3)
        assertEquals(2, res3.attemptCount)
        assertEquals(MealAiHelper.INFERENCE_MODE_FREEFORM, res3.inferenceMode)
        assertFalse(res3.structuredOutputAvailable)
        assertTrue(res3.outcome is MealAiHelper.ParseOutcome.Success)

        // 4. 1回目が isFood: false（NotFood）の場合はリトライ・フォールバックせず1回で終了するケース
        var freeformCalls4 = 0
        val res4 = MealAiHelper.runInferenceWithFormatRetry { attemptIndex, _ ->
            freeformCalls4 = attemptIndex
            MealAiHelper.RawInferenceAttempt(
                text = """{"isFood":false,"dishName":"","recognizedItems":[],"calories":0,"protein":0,"fat":0,"carbs":0}""",
                finishReason = 0,
            )
        }
        assertEquals(1, freeformCalls4)
        assertEquals(1, res4.attemptCount)
        assertTrue(res4.outcome is MealAiHelper.ParseOutcome.NotFood)
    }

    @Test
    fun `parseMealAnalysisResponse returns NotFood when isFood is false`() {
        val raw = """{"isFood":false,"dishName":"","recognizedItems":[],"calories":0,"protein":0,"fat":0,"carbs":0}"""
        val outcome = MealAiHelper.parseMealAnalysisResponse(raw)
        assertTrue(outcome is MealAiHelper.ParseOutcome.NotFood)
    }

    @Test
    fun `parseMealAnalysisResponse rejects missing, null, string, non-numeric, or out-of-range values with detailed privacy-safe diagnostics`() {
        // 0. isFood 欠損 / null / 文字列
        val missingIsFood = """{"dishName":"ラーメン","recognizedItems":["ラーメン"],"calories":700,"protein":25,"fat":20,"carbs":85}"""
        val missingIsFoodOutcome = MealAiHelper.parseMealAnalysisResponse(missingIsFood) as MealAiHelper.ParseOutcome.Failure
        assertEquals("MISSING_FIELD", missingIsFoodOutcome.errorCode)
        assertEquals("isFood", missingIsFoodOutcome.failedField)
        assertEquals("missing_key", missingIsFoodOutcome.validationReason)
        assertEquals(
            "isFood:missing,dishName:str,recognizedItems:arr,calories:num,protein:num,fat:num,carbs:num",
            missingIsFoodOutcome.fieldPresence,
        )
        assertFalse(missingIsFoodOutcome.hasSchemaKeys)
        // 診断情報に料理名「ラーメン」が含まれないこと
        assertFalse(missingIsFoodOutcome.fieldPresence!!.contains("ラーメン"))

        // 1. カロリー欠損（missing_key）
        val missingCalories = """{"isFood":true,"dishName":"カレー","recognizedItems":["カレー"],"protein":20,"fat":15,"carbs":80}"""
        val missingCalOutcome = MealAiHelper.parseMealAnalysisResponse(missingCalories) as MealAiHelper.ParseOutcome.Failure
        assertEquals("INVALID_NUTRITION_VALUE", missingCalOutcome.errorCode)
        assertEquals("calories", missingCalOutcome.failedField)
        assertEquals("missing_key", missingCalOutcome.validationReason)
        assertEquals(
            "isFood:bool,dishName:str,recognizedItems:arr,calories:missing,protein:num,fat:num,carbs:num",
            missingCalOutcome.fieldPresence,
        )

        // 2. タンパク質がnull（null_value）
        val nullProtein = """{"isFood":true,"dishName":"カレー","recognizedItems":["カレー"],"calories":700,"protein":null,"fat":15,"carbs":80}"""
        val nullProtOutcome = MealAiHelper.parseMealAnalysisResponse(nullProtein) as MealAiHelper.ParseOutcome.Failure
        assertEquals("INVALID_NUTRITION_VALUE", nullProtOutcome.errorCode)
        assertEquals("protein", nullProtOutcome.failedField)
        assertEquals("null_value", nullProtOutcome.validationReason)
        assertEquals(
            "isFood:bool,dishName:str,recognizedItems:arr,calories:num,protein:null,fat:num,carbs:num",
            nullProtOutcome.fieldPresence,
        )

        // 3. 脂質が文字列（string_type）
        val stringFat = """{"isFood":true,"dishName":"カレー","recognizedItems":["カレー"],"calories":700,"protein":20,"fat":"15g","carbs":80}"""
        val strFatOutcome = MealAiHelper.parseMealAnalysisResponse(stringFat) as MealAiHelper.ParseOutcome.Failure
        assertEquals("INVALID_NUTRITION_VALUE", strFatOutcome.errorCode)
        assertEquals("fat", strFatOutcome.failedField)
        assertEquals("string_type", strFatOutcome.validationReason)
        assertEquals(
            "isFood:bool,dishName:str,recognizedItems:arr,calories:num,protein:num,fat:str,carbs:num",
            strFatOutcome.fieldPresence,
        )
        assertFalse(strFatOutcome.fieldPresence!!.contains("15g"))

        // 3b. カロリーがその他の型不一致（type_mismatch）
        val arrayCalories = """{"isFood":true,"dishName":"カレー","recognizedItems":["カレー"],"calories":[700],"protein":20,"fat":15,"carbs":80}"""
        val arrCalOutcome = MealAiHelper.parseMealAnalysisResponse(arrayCalories) as MealAiHelper.ParseOutcome.Failure
        assertEquals("INVALID_NUTRITION_VALUE", arrCalOutcome.errorCode)
        assertEquals("calories", arrCalOutcome.failedField)
        assertEquals("type_mismatch", arrCalOutcome.validationReason)

        // 4. 負のカロリー（クランプせず OUT_OF_RANGE / out_of_range にすること）
        val negativeCalories = """{"isFood":true,"dishName":"カレー","recognizedItems":["カレー"],"calories":-10,"protein":20,"fat":15,"carbs":80}"""
        val negOutcome = MealAiHelper.parseMealAnalysisResponse(negativeCalories) as MealAiHelper.ParseOutcome.Failure
        assertEquals("OUT_OF_RANGE", negOutcome.errorCode)
        assertEquals("calories", negOutcome.failedField)
        assertEquals("out_of_range", negOutcome.validationReason)

        // 5. 上限超過のカロリー（10000超をクランプせずエラーにすること）
        val excessiveCalories = """{"isFood":true,"dishName":"カレー","recognizedItems":["カレー"],"calories":15000,"protein":20,"fat":15,"carbs":80}"""
        val excOutcome = MealAiHelper.parseMealAnalysisResponse(excessiveCalories) as MealAiHelper.ParseOutcome.Failure
        assertEquals("OUT_OF_RANGE", excOutcome.errorCode)
        assertEquals("out_of_range", excOutcome.validationReason)

        // 6. 上限超過の炭水化物（1000g超をクランプせずエラーにすること）
        val excessiveCarbs = """{"isFood":true,"dishName":"カレー","recognizedItems":["カレー"],"calories":700,"protein":20,"fat":15,"carbs":1200}"""
        val carbsOutcome = MealAiHelper.parseMealAnalysisResponse(excessiveCarbs) as MealAiHelper.ParseOutcome.Failure
        assertEquals("OUT_OF_RANGE", carbsOutcome.errorCode)
        assertEquals("carbs", carbsOutcome.failedField)
        assertEquals("out_of_range", carbsOutcome.validationReason)

        // 7. dishName が空文字（empty_string）
        val emptyDishName = """{"isFood":true,"dishName":"   ","recognizedItems":["カレー"],"calories":700,"protein":20,"fat":15,"carbs":80}"""
        val dishOutcome = MealAiHelper.parseMealAnalysisResponse(emptyDishName) as MealAiHelper.ParseOutcome.Failure
        assertEquals("INVALID_DISH_NAME", dishOutcome.errorCode)
        assertEquals("dishName", dishOutcome.failedField)
        assertEquals("empty_string", dishOutcome.validationReason)

        // 8. recognizedItems が文字列（string_type）
        val invalidItems = """{"isFood":true,"dishName":"カレー","recognizedItems":"カレーライス","calories":700,"protein":20,"fat":15,"carbs":80}"""
        val itemsOutcome = MealAiHelper.parseMealAnalysisResponse(invalidItems) as MealAiHelper.ParseOutcome.Failure
        assertEquals("INVALID_FIELD_TYPE", itemsOutcome.errorCode)
        assertEquals("recognizedItems", itemsOutcome.failedField)
        assertEquals("string_type", itemsOutcome.validationReason)

        // 9. JSONとして不正
        val notJsonOutcome = MealAiHelper.parseMealAnalysisResponse("Not a JSON response") as MealAiHelper.ParseOutcome.Failure
        assertEquals("INVALID_JSON", notJsonOutcome.errorCode)
        assertEquals("json_not_found", notJsonOutcome.validationReason)

        val emptyOutcome = MealAiHelper.parseMealAnalysisResponse("") as MealAiHelper.ParseOutcome.Failure
        assertEquals("EMPTY_RESPONSE", emptyOutcome.errorCode)
        assertEquals("empty_response", emptyOutcome.validationReason)
    }

    @Test
    fun `extractBase64Payload validates data URL header and size limit`() {
        val validDataUrl = "data:image/jpeg;base64,aGVsbG8="
        assertEquals("aGVsbG8=", MealAiHelper.extractBase64Payload(validDataUrl))

        val plainBase64 = "aGVsbG8="
        assertEquals("aGVsbG8=", MealAiHelper.extractBase64Payload(plainBase64))

        // 非画像Data URLは拒否
        assertNull(MealAiHelper.extractBase64Payload("data:text/plain;base64,aGVsbG8="))
        // 空文字やサイズ超過は拒否
        assertNull(MealAiHelper.extractBase64Payload("   "))
        assertNull(MealAiHelper.extractBase64Payload("aGVsbG8=", maxBase64Length = 4))
    }

    @Test
    fun `calculateInSampleSize and calculateTargetDimensions downsample large images accurately`() {
        assertEquals(1, MealAiHelper.calculateInSampleSize(800, 600, 1024))
        assertEquals(2, MealAiHelper.calculateInSampleSize(2400, 1800, 1024))
        assertEquals(2, MealAiHelper.calculateInSampleSize(4032, 3024, 1024))
        assertEquals(4, MealAiHelper.calculateInSampleSize(4096, 3072, 1024))

        val (w1, h1) = MealAiHelper.calculateTargetDimensions(800, 600, 1024)
        assertEquals(800, w1)
        assertEquals(600, h1)

        val (w2, h2) = MealAiHelper.calculateTargetDimensions(2048, 1536, 1024)
        assertEquals(1024, w2)
        assertEquals(768, h2)
    }

    @Test
    fun `resolveExifTransform maps EXIF orientation constants to rotation and flip`() {
        val normal = MealAiHelper.resolveExifTransform(ExifInterface.ORIENTATION_NORMAL)
        assertEquals(0, normal.rotationDegrees)
        assertFalse(normal.flipHorizontal)

        val rotate90 = MealAiHelper.resolveExifTransform(ExifInterface.ORIENTATION_ROTATE_90)
        assertEquals(90, rotate90.rotationDegrees)
        assertFalse(rotate90.flipHorizontal)

        val rotate180 = MealAiHelper.resolveExifTransform(ExifInterface.ORIENTATION_ROTATE_180)
        assertEquals(180, rotate180.rotationDegrees)
        assertFalse(rotate180.flipHorizontal)

        val rotate270 = MealAiHelper.resolveExifTransform(ExifInterface.ORIENTATION_ROTATE_270)
        assertEquals(270, rotate270.rotationDegrees)
        assertFalse(rotate270.flipHorizontal)

        val flipH = MealAiHelper.resolveExifTransform(ExifInterface.ORIENTATION_FLIP_HORIZONTAL)
        assertEquals(0, flipH.rotationDegrees)
        assertTrue(flipH.flipHorizontal)

        val transpose = MealAiHelper.resolveExifTransform(ExifInterface.ORIENTATION_TRANSPOSE)
        assertEquals(90, transpose.rotationDegrees)
        assertTrue(transpose.flipHorizontal)
    }

    @Test
    fun `KSP generates GenerableProvider for TypedMealAnalysisResult and ServiceLoader discovers it`() {
        val provider = TypedMealAnalysisResult_GeneratedProvider()
        assertEquals(TypedMealAnalysisResult::class, provider.targetClass)
        val detail = provider.getGenerableDetail()
        val guideNames = detail.guideDetails.map { it.name }
        assertEquals(MealAiHelper.REQUIRED_FIELDS, guideNames)

        val caloriesGuide = detail.guideDetails.first { it.name == "calories" }
        assertEquals(0.0, caloriesGuide.minimum!!, 0.001)
        assertEquals(10000.0, caloriesGuide.maximum!!, 0.001)
        assertFalse(caloriesGuide.nullable)

        val itemsGuide = detail.guideDetails.first { it.name == "recognizedItems" }
        assertTrue(itemsGuide.isList)
        assertEquals(8, itemsGuide.maxItems)

        val loadedProviders = java.util.ServiceLoader.load(
            com.google.mlkit.genai.schema.guided.GenerableProvider::class.java,
            TypedMealAnalysisResult::class.java.classLoader,
        ).toList()
        assertTrue(loadedProviders.any { it.targetClass == TypedMealAnalysisResult::class })
    }

    @Test
    fun `runHybridInference rethrows non-recoverable system GenAiException without falling back to freeform`() = kotlinx.coroutines.runBlocking {
        var freeformCalled = false
        var caughtCode: Int? = null
        try {
            MealAiHelper.runHybridInference(
                structuredOutputAvailable = true,
                performTypedAttempt = {
                    throw GenAiException(
                        "Quota exceeded",
                        null,
                        GenAiException.ErrorCode.PER_APP_BATTERY_USE_QUOTA_EXCEEDED,
                    )
                },
                performFreeformAttempt = { _, _ ->
                    freeformCalled = true
                    MealAiHelper.RawInferenceAttempt(null, 0)
                },
            )
        } catch (e: GenAiException) {
            caughtCode = e.errorCode
        }
        assertEquals(GenAiException.ErrorCode.PER_APP_BATTERY_USE_QUOTA_EXCEEDED, caughtCode)
        assertFalse(freeformCalled)
    }
}

