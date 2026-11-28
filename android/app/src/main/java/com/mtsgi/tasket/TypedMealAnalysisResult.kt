package com.mtsgi.tasket

import com.google.mlkit.genai.schema.annotations.Generable
import com.google.mlkit.genai.schema.annotations.Guide

/**
 * ML Kit GenAI Prompt API（Structured Output API）用の型付き食事写真解析レスポンス定義。
 * KSP（com.google.mlkit:genai-schema-compiler）によりコンパイル時に GenerableProvider が自動生成される。
 */
@Generable(description = "Nutrition estimation result for a meal photo")
data class TypedMealAnalysisResult(
    @Guide(description = "True if the photo shows food or drink, false otherwise")
    val isFood: Boolean = false,
    @Guide(description = "Name of the dish or meal shown in the photo, or empty string if isFood is false")
    val dishName: String = "",
    @Guide(
        description = "Recognized food or drink items in the meal (empty list if isFood is false)",
        maxItems = 8,
    )
    val recognizedItems: List<String> = emptyList(),
    @Guide(
        description = "Estimated total calories in kcal for the entire meal (0 if isFood is false)",
        minimum = 0.0,
        maximum = 10000.0,
    )
    val calories: Double = 0.0,
    @Guide(
        description = "Estimated total protein in grams for the entire meal (0 if isFood is false)",
        minimum = 0.0,
        maximum = 1000.0,
    )
    val protein: Double = 0.0,
    @Guide(
        description = "Estimated total fat in grams for the entire meal (0 if isFood is false)",
        minimum = 0.0,
        maximum = 1000.0,
    )
    val fat: Double = 0.0,
    @Guide(
        description = "Estimated total carbohydrates in grams for the entire meal (0 if isFood is false)",
        minimum = 0.0,
        maximum = 1000.0,
    )
    val carbs: Double = 0.0,
)
