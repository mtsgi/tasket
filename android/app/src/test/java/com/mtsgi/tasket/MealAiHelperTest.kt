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
    fun `buildMealAnalysisPrompt sanitizes hintText, selects output language, and eliminates concrete example nutrient number bias`() {
        val promptJa = MealAiHelper.buildMealAnalysisPrompt("  鮭定食\nご飯大盛り\t ", "ja")
        assertTrue(promptJa.contains("Use Japanese for dishName and recognizedItems."))
        assertTrue(promptJa.contains("鮭定食 ご飯大盛り"))
        assertFalse(promptJa.contains("\nご飯大盛り"))
        assertFalse(promptJa.contains("IMPORTANT: Output ONLY a single compact valid JSON object"))

        // 旧プロンプトで問題となった具体的な栄養素例示値（550, 24.5, 18.0, 68.0）が含まれていないことを検証
        assertFalse(promptJa.contains("550"))
        assertFalse(promptJa.contains("24.5"))
        assertFalse(promptJa.contains("18.0"))
        assertFalse(promptJa.contains("68.0"))

        // ML Kit Structured Output互換のJSON Schema定義が含まれていることを検証
        val schemaJson = org.json.JSONObject(MealAiHelper.buildMealAnalysisJsonSchema("Japanese"))
        assertEquals("object", schemaJson.getString("type"))
        val props = schemaJson.getJSONObject("properties")
        assertTrue(props.has("isFood"))
        assertTrue(props.has("dishName"))
        assertTrue(props.has("recognizedItems"))
        assertTrue(props.has("calories"))
        assertTrue(props.has("protein"))
        assertTrue(props.has("fat"))
        assertTrue(props.has("carbs"))

        val promptEnRetry = MealAiHelper.buildMealAnalysisPrompt(null, "en-US", isRetry = true)
        assertTrue(promptEnRetry.contains("Use English for dishName and recognizedItems."))
        assertFalse(promptEnRetry.contains("User note / context hint"))
        assertTrue(promptEnRetry.contains("IMPORTANT: Output ONLY a single compact valid JSON object"))

        // 200文字を超えるヒントは切り詰められる
        val longHint = "あ".repeat(250)
        val sanitized = MealAiHelper.sanitizeHintText(longHint)
        assertEquals(MealAiHelper.MAX_HINT_LENGTH, sanitized.length)
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

        // finishReason が STOP(0) または null でも '{' が閉じられていない場合は OUTPUT_TRUNCATED として検出する
        val outcomeUnclosed = MealAiHelper.parseMealAnalysisResponse(truncatedRaw, finishReason = 0)
        assertTrue(outcomeUnclosed is MealAiHelper.ParseOutcome.Failure)
        assertEquals("OUTPUT_TRUNCATED", (outcomeUnclosed as MealAiHelper.ParseOutcome.Failure).errorCode)
    }

    @Test
    fun `runInferenceWithFormatRetry retries at most once on format failure and does not retry on NotFood or Success`() = kotlinx.coroutines.runBlocking {
        // 1. 1回目がJSON途中切断、2回目（自動リトライ）で成功するケース
        var callCount1 = 0
        val retryFlags1 = mutableListOf<Boolean>()
        val result1 = MealAiHelper.runInferenceWithFormatRetry { attemptIndex, isRetry ->
            callCount1 = attemptIndex
            retryFlags1.add(isRetry)
            if (attemptIndex == 1) {
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
        }
        assertEquals(2, callCount1)
        assertEquals(listOf(false, true), retryFlags1)
        assertEquals(2, result1.attemptCount)
        assertEquals("STOP", result1.lastFinishReason)
        assertTrue(result1.outcome is MealAiHelper.ParseOutcome.Success)

        // 2. 1回目・2回目ともに不正JSONの場合は2回で終了し Failure を返すケース
        var callCount2 = 0
        val result2 = MealAiHelper.runInferenceWithFormatRetry { attemptIndex, _ ->
            callCount2 = attemptIndex
            MealAiHelper.RawInferenceAttempt(
                text = "Invalid output without JSON",
                finishReason = 0,
            )
        }
        assertEquals(2, callCount2)
        assertEquals(2, result2.attemptCount)
        assertEquals("Invalid output without JSON".length, result2.lastResponseLength)
        assertTrue(result2.outcome is MealAiHelper.ParseOutcome.Failure)
        assertEquals("INVALID_JSON", (result2.outcome as MealAiHelper.ParseOutcome.Failure).errorCode)

        // 3. 1回目が isFood: false（NotFood）の場合はリトライせず1回で終了するケース
        var callCount3 = 0
        val result3 = MealAiHelper.runInferenceWithFormatRetry { attemptIndex, _ ->
            callCount3 = attemptIndex
            MealAiHelper.RawInferenceAttempt(
                text = """{"isFood":false,"dishName":"","recognizedItems":[],"calories":0,"protein":0,"fat":0,"carbs":0}""",
                finishReason = 0,
            )
        }
        assertEquals(1, callCount3)
        assertEquals(1, result3.attemptCount)
        assertTrue(result3.outcome is MealAiHelper.ParseOutcome.NotFood)
    }

    @Test
    fun `parseMealAnalysisResponse returns NotFood when isFood is false`() {
        val raw = """{"isFood":false,"dishName":"","recognizedItems":[],"calories":0,"protein":0,"fat":0,"carbs":0}"""
        val outcome = MealAiHelper.parseMealAnalysisResponse(raw)
        assertTrue(outcome is MealAiHelper.ParseOutcome.NotFood)
    }

    @Test
    fun `parseMealAnalysisResponse rejects missing, null, non-numeric, or out-of-range values without clamping`() {
        // 1. カロリー欠損
        val missingCalories = """{"isFood":true,"dishName":"カレー","recognizedItems":["カレー"],"protein":20,"fat":15,"carbs":80}"""
        val missingCalOutcome = MealAiHelper.parseMealAnalysisResponse(missingCalories)
        assertTrue(missingCalOutcome is MealAiHelper.ParseOutcome.Failure)
        assertEquals("calories", (missingCalOutcome as MealAiHelper.ParseOutcome.Failure).failedField)

        // 2. タンパク質がnull
        val nullProtein = """{"isFood":true,"dishName":"カレー","recognizedItems":["カレー"],"calories":700,"protein":null,"fat":15,"carbs":80}"""
        val nullProtOutcome = MealAiHelper.parseMealAnalysisResponse(nullProtein)
        assertTrue(nullProtOutcome is MealAiHelper.ParseOutcome.Failure)
        assertEquals("protein", (nullProtOutcome as MealAiHelper.ParseOutcome.Failure).failedField)

        // 3. 脂質が文字列
        val stringFat = """{"isFood":true,"dishName":"カレー","recognizedItems":["カレー"],"calories":700,"protein":20,"fat":"15g","carbs":80}"""
        val strFatOutcome = MealAiHelper.parseMealAnalysisResponse(stringFat)
        assertTrue(strFatOutcome is MealAiHelper.ParseOutcome.Failure)
        assertEquals("fat", (strFatOutcome as MealAiHelper.ParseOutcome.Failure).failedField)

        // 4. 負のカロリー（クランプせずエラーにすること）
        val negativeCalories = """{"isFood":true,"dishName":"カレー","recognizedItems":["カレー"],"calories":-10,"protein":20,"fat":15,"carbs":80}"""
        val negOutcome = MealAiHelper.parseMealAnalysisResponse(negativeCalories)
        assertTrue(negOutcome is MealAiHelper.ParseOutcome.Failure)
        assertEquals("OUT_OF_RANGE", (negOutcome as MealAiHelper.ParseOutcome.Failure).errorCode)
        assertEquals("calories", negOutcome.failedField)

        // 5. 上限超過のカロリー（10000超をクランプせずエラーにすること）
        val excessiveCalories = """{"isFood":true,"dishName":"カレー","recognizedItems":["カレー"],"calories":15000,"protein":20,"fat":15,"carbs":80}"""
        val excOutcome = MealAiHelper.parseMealAnalysisResponse(excessiveCalories)
        assertTrue(excOutcome is MealAiHelper.ParseOutcome.Failure)
        assertEquals("OUT_OF_RANGE", (excOutcome as MealAiHelper.ParseOutcome.Failure).errorCode)

        // 6. 上限超過の炭水化物（1000g超をクランプせずエラーにすること）
        val excessiveCarbs = """{"isFood":true,"dishName":"カレー","recognizedItems":["カレー"],"calories":700,"protein":20,"fat":15,"carbs":1200}"""
        val carbsOutcome = MealAiHelper.parseMealAnalysisResponse(excessiveCarbs)
        assertTrue(carbsOutcome is MealAiHelper.ParseOutcome.Failure)
        assertEquals("OUT_OF_RANGE", (carbsOutcome as MealAiHelper.ParseOutcome.Failure).errorCode)
        assertEquals("carbs", carbsOutcome.failedField)

        // 7. dishName が空文字
        val emptyDishName = """{"isFood":true,"dishName":"   ","recognizedItems":["カレー"],"calories":700,"protein":20,"fat":15,"carbs":80}"""
        val dishOutcome = MealAiHelper.parseMealAnalysisResponse(emptyDishName)
        assertTrue(dishOutcome is MealAiHelper.ParseOutcome.Failure)
        assertEquals("INVALID_DISH_NAME", (dishOutcome as MealAiHelper.ParseOutcome.Failure).errorCode)
        assertEquals("dishName", dishOutcome.failedField)

        // 8. recognizedItems が配列でない
        val invalidItems = """{"isFood":true,"dishName":"カレー","recognizedItems":"カレーライス","calories":700,"protein":20,"fat":15,"carbs":80}"""
        val itemsOutcome = MealAiHelper.parseMealAnalysisResponse(invalidItems)
        assertTrue(itemsOutcome is MealAiHelper.ParseOutcome.Failure)
        assertEquals("INVALID_FIELD_TYPE", (itemsOutcome as MealAiHelper.ParseOutcome.Failure).errorCode)
        assertEquals("recognizedItems", itemsOutcome.failedField)

        // 9. JSONとして不正
        assertTrue(MealAiHelper.parseMealAnalysisResponse("Not a JSON response") is MealAiHelper.ParseOutcome.Failure)
        assertTrue(MealAiHelper.parseMealAnalysisResponse("") is MealAiHelper.ParseOutcome.Failure)
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
}
