/**
 * Gemini Nano（ML Kit GenAI Prompt API）オンデバイス食事写真解析ユーティリティ
 * Capacitorネイティブプラグインの呼び出し、AI出力の厳格バリデーション（クランプ禁止）、
 * および食事ログ入力フォームへの一括反映機能を提供します。
 */
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { isAndroidNativeApp } from '~/utils/healthConnect'
import type { MealLogRefs } from '~/utils/mealLog'

/**
 * Gemini Nanoモデルの準備状態
 */
export type MealAiFeatureStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable'

/**
 * カロリー・三大栄養素の有効範囲定数（クランプせず範囲外はエラーとして扱う）
 */
export const MEAL_AI_MIN_CALORIES = 0
export const MEAL_AI_MAX_CALORIES = 10000
export const MEAL_AI_MIN_MACRO_GRAMS = 0
export const MEAL_AI_MAX_MACRO_GRAMS = 1000
export const MEAL_AI_MAX_DISH_NAME_LENGTH = 200
export const MEAL_AI_MAX_HINT_LENGTH = 200
export const MEAL_AI_MAX_BASE64_LENGTH = 20 * 1024 * 1024

/**
 * Gemini Nano利用可否・ステータス確認結果
 */
export interface MealAiAvailabilityResult {
  available: boolean
  status: MealAiFeatureStatus
  featureStatus?: number
  platform: string
  structuredOutputAvailable?: boolean
  errorCode?: string
  retryable?: boolean
}

/**
 * モデルダウンロード進捗イベント
 */
export interface MealAiDownloadProgressEvent {
  status: 'started' | 'progress' | 'completed'
  bytesToDownload: number
  totalBytesDownloaded: number
}

/**
 * モデルダウンロード完了結果
 */
export interface MealAiDownloadResult {
  status: MealAiFeatureStatus
  downloaded: boolean
}

/**
 * 実際に使用した推論方式
 */
export type MealAiInferenceMode = 'typed' | 'freeform' | 'typed_then_freeform' | 'none'

/**
 * 必須出力フィールド一覧（診断用、順序固定）
 */
export const MEAL_AI_REQUIRED_FIELDS = [
  'isFood',
  'dishName',
  'recognizedItems',
  'calories',
  'protein',
  'fat',
  'carbs',
] as const

/**
 * ルートJSONオブジェクトに混入し得るJSON Schema定義用キー一覧
 */
export const MEAL_AI_SCHEMA_DEFINITION_KEYS = [
  'properties',
  'required',
  'type',
  '$schema',
] as const

/**
 * 個人情報を含まないオンデバイスAI推論診断メタデータ
 * （写真・料理名・食事メモ・プロンプト・AI生テキストは一切含めない）
 */
export interface MealAiDiagnostics {
  errorCode?: string
  stage: string
  elapsedMs?: number
  attemptCount?: number
  responseLength?: number
  finishReason?: string
  failedField?: string
  structuredOutputAvailable?: boolean
  inferenceMode?: MealAiInferenceMode | string
  validationReason?: string
  fieldPresence?: string
  hasSchemaKeys?: boolean
}

/**
 * ネイティブプラグインから返却される生レスポンス型
 */
export interface MealAiRawResponse {
  isFood?: unknown
  dishName?: unknown
  recognizedItems?: unknown
  calories?: unknown
  protein?: unknown
  fat?: unknown
  carbs?: unknown
  elapsedMs?: unknown
  diagnostics?: unknown
}

/**
 * 厳格バリデーション通過後の栄養素推定データ
 */
export interface MealAiNutritionEstimation {
  dishName: string
  recognizedItems: string[]
  calories: number
  protein: number
  fat: number
  carbs: number
  elapsedMs?: number
}

/**
 * 食事写真解析の結果判別共用体型
 */
export type MealAiAnalysisOutcome
  = | {
    ok: true
    isFood: true
    estimation: MealAiNutritionEstimation
    diagnostics?: MealAiDiagnostics
  }
  | {
    ok: true
    isFood: false
    elapsedMs?: number
    diagnostics?: MealAiDiagnostics
  }
  | {
    ok: false
    errorCode: string
    message: string
    diagnostics: MealAiDiagnostics
  }

/**
 * Capacitorネイティブプラグインのインターフェース定義
 */
export interface MealAiPluginInterface {
  checkStatus(): Promise<MealAiAvailabilityResult>
  downloadModel(): Promise<MealAiDownloadResult>
  analyzeMealPhoto(options: {
    photoBase64: string
    hintText?: string
    locale?: string
  }): Promise<MealAiRawResponse>
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (event: MealAiDownloadProgressEvent) => void,
  ): Promise<PluginListenerHandle>
}

export const MealAiPlugin = registerPlugin<MealAiPluginInterface>('MealAi')

/**
 * 現在の実行環境がオンデバイスAI食事解析の対象プラットフォーム（Androidネイティブ）か判定
 */
export function isMealAiSupportedPlatform(): boolean {
  return isAndroidNativeApp()
}

/**
 * タイトルや食事メモからオンデバイス推論用の補助ヒント文字列を組み立てる
 */
export function buildMealAiHintText(title?: string, mealMemo?: string): string | undefined {
  const parts = [title?.trim(), mealMemo?.trim()].filter((part): part is string => !!part && part.length > 0)
  if (parts.length === 0) {
    return undefined
  }
  const combined = parts.join(' / ').replace(/\s+/g, ' ').trim()
  if (!combined) {
    return undefined
  }
  return combined.length > MEAL_AI_MAX_HINT_LENGTH
    ? combined.slice(0, MEAL_AI_MAX_HINT_LENGTH).trim()
    : combined
}

/**
 * 小数第1位に四捨五入する
 */
export function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * オブジェクト内の必須7フィールドの存在状況および値の型を個人情報を含まない診断文字列として返す
 */
export function inspectMealAiRawFieldPresence(record: Record<string, unknown>): string {
  return MEAL_AI_REQUIRED_FIELDS.map((key) => {
    if (!(key in record) || record[key] === undefined) {
      return `${key}:missing`
    }
    const val = record[key]
    if (val === null) {
      return `${key}:null`
    }
    if (typeof val === 'boolean') {
      return `${key}:bool`
    }
    if (typeof val === 'number') {
      return `${key}:num`
    }
    if (typeof val === 'string') {
      return `${key}:str`
    }
    if (Array.isArray(val)) {
      return `${key}:arr`
    }
    if (typeof val === 'object') {
      return `${key}:obj`
    }
    return `${key}:other`
  }).join(',')
}

/**
 * ルートオブジェクトに properties, required, type, $schema などのスキーマ定義用キーが存在するか判定する
 */
export function detectMealAiRawSchemaKeys(record: Record<string, unknown>): boolean {
  return MEAL_AI_SCHEMA_DEFINITION_KEYS.some(key => key in record && record[key] !== undefined && record[key] !== null)
}

/**
 * プラグインレスポンスまたは例外データから個人情報を含まない診断メタデータを安全に抽出する
 */
export function extractMealAiDiagnostics(
  raw: unknown,
  fallback: Partial<MealAiDiagnostics> = {},
): MealAiDiagnostics {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const stage = typeof obj.stage === 'string' && obj.stage.trim().length > 0
    ? obj.stage.trim()
    : (fallback.stage || 'unknown')
  const errorCode = typeof obj.errorCode === 'string' && obj.errorCode.trim().length > 0
    ? obj.errorCode.trim().toUpperCase()
    : fallback.errorCode
  const elapsedMs = typeof obj.elapsedMs === 'number' && Number.isFinite(obj.elapsedMs) && obj.elapsedMs >= 0
    ? Math.round(obj.elapsedMs)
    : fallback.elapsedMs
  const attemptCount = typeof obj.attemptCount === 'number' && Number.isFinite(obj.attemptCount) && obj.attemptCount >= 0
    ? Math.round(obj.attemptCount)
    : fallback.attemptCount
  const responseLength = typeof obj.responseLength === 'number' && Number.isFinite(obj.responseLength) && obj.responseLength >= 0
    ? Math.round(obj.responseLength)
    : fallback.responseLength
  const finishReason = typeof obj.finishReason === 'string' && obj.finishReason.trim().length > 0
    ? obj.finishReason.trim()
    : fallback.finishReason
  const failedField = typeof obj.failedField === 'string' && obj.failedField.trim().length > 0
    ? obj.failedField.trim()
    : fallback.failedField
  const structuredOutputAvailable = typeof obj.structuredOutputAvailable === 'boolean'
    ? obj.structuredOutputAvailable
    : fallback.structuredOutputAvailable
  const inferenceMode = typeof obj.inferenceMode === 'string' && obj.inferenceMode.trim().length > 0
    ? obj.inferenceMode.trim()
    : fallback.inferenceMode
  const validationReason = typeof obj.validationReason === 'string' && obj.validationReason.trim().length > 0
    ? obj.validationReason.trim()
    : fallback.validationReason
  const fieldPresence = typeof obj.fieldPresence === 'string' && obj.fieldPresence.trim().length > 0
    ? obj.fieldPresence.trim()
    : fallback.fieldPresence
  const hasSchemaKeys = typeof obj.hasSchemaKeys === 'boolean'
    ? obj.hasSchemaKeys
    : fallback.hasSchemaKeys

  const diagnostics: MealAiDiagnostics = { stage }
  if (errorCode !== undefined) diagnostics.errorCode = errorCode
  if (elapsedMs !== undefined) diagnostics.elapsedMs = elapsedMs
  if (attemptCount !== undefined) diagnostics.attemptCount = attemptCount
  if (responseLength !== undefined) diagnostics.responseLength = responseLength
  if (finishReason !== undefined) diagnostics.finishReason = finishReason
  if (failedField !== undefined) diagnostics.failedField = failedField
  if (structuredOutputAvailable !== undefined) diagnostics.structuredOutputAvailable = structuredOutputAvailable
  if (inferenceMode !== undefined) diagnostics.inferenceMode = inferenceMode
  if (validationReason !== undefined) diagnostics.validationReason = validationReason
  if (fieldPresence !== undefined) diagnostics.fieldPresence = fieldPresence
  if (hasSchemaKeys !== undefined) diagnostics.hasSchemaKeys = hasSchemaKeys
  return diagnostics
}

/**
 * 画面表示用の個人情報を含まない診断サマリ文字列を生成する
 */
export function formatMealAiDiagnosticsSummary(
  errorCode: string,
  diagnostics?: MealAiDiagnostics,
): string {
  const normalizedCode = (errorCode || diagnostics?.errorCode || 'UNKNOWN').trim().toUpperCase()
  const parts: string[] = [`CODE: ${normalizedCode}`]
  if (diagnostics) {
    if (diagnostics.inferenceMode) {
      parts.push(`mode: ${diagnostics.inferenceMode}`)
    }
    if (typeof diagnostics.structuredOutputAvailable === 'boolean') {
      parts.push(`structured: ${diagnostics.structuredOutputAvailable}`)
    }
    if (diagnostics.stage) {
      parts.push(`stage: ${diagnostics.stage}`)
    }
    if (diagnostics.failedField) {
      parts.push(`field: ${diagnostics.failedField}`)
    }
    if (diagnostics.validationReason) {
      parts.push(`reason: ${diagnostics.validationReason}`)
    }
    if (typeof diagnostics.hasSchemaKeys === 'boolean') {
      parts.push(`schemaKeys: ${diagnostics.hasSchemaKeys}`)
    }
    if (diagnostics.fieldPresence) {
      parts.push(`fields: ${diagnostics.fieldPresence}`)
    }
    if (typeof diagnostics.attemptCount === 'number') {
      parts.push(`attempts: ${diagnostics.attemptCount}`)
    }
    if (typeof diagnostics.responseLength === 'number') {
      parts.push(`len: ${diagnostics.responseLength}`)
    }
    if (diagnostics.finishReason) {
      parts.push(`finish: ${diagnostics.finishReason}`)
    }
    if (typeof diagnostics.elapsedMs === 'number') {
      parts.push(`time: ${diagnostics.elapsedMs}ms`)
    }
  }
  return parts.join(' | ')
}

/**
 * 栄養素フィールド1項目を厳格に検証し、失敗時は具体的な理由（missing_key / null_value / string_type / type_mismatch / non_finite_number / out_of_range）を返す
 */
function validateStrictNutritionField(
  record: Record<string, unknown>,
  key: 'calories' | 'protein' | 'fat' | 'carbs',
  min: number,
  max: number,
  baseDiag: MealAiDiagnostics,
): { ok: true, value: number } | { ok: false, outcome: MealAiAnalysisOutcome } {
  if (!(key in record) || record[key] === undefined) {
    return {
      ok: false,
      outcome: {
        ok: false,
        errorCode: 'INVALID_NUTRITION_VALUE',
        message: `${key} is missing`,
        diagnostics: {
          ...baseDiag,
          errorCode: 'INVALID_NUTRITION_VALUE',
          stage: 'frontend_validation',
          failedField: key,
          validationReason: 'missing_key',
        },
      },
    }
  }
  const rawVal = record[key]
  if (rawVal === null) {
    return {
      ok: false,
      outcome: {
        ok: false,
        errorCode: 'INVALID_NUTRITION_VALUE',
        message: `${key} is null`,
        diagnostics: {
          ...baseDiag,
          errorCode: 'INVALID_NUTRITION_VALUE',
          stage: 'frontend_validation',
          failedField: key,
          validationReason: 'null_value',
        },
      },
    }
  }
  if (typeof rawVal === 'string') {
    return {
      ok: false,
      outcome: {
        ok: false,
        errorCode: 'INVALID_NUTRITION_VALUE',
        message: `${key} must be a number, not a string`,
        diagnostics: {
          ...baseDiag,
          errorCode: 'INVALID_NUTRITION_VALUE',
          stage: 'frontend_validation',
          failedField: key,
          validationReason: 'string_type',
        },
      },
    }
  }
  if (typeof rawVal !== 'number') {
    return {
      ok: false,
      outcome: {
        ok: false,
        errorCode: 'INVALID_NUTRITION_VALUE',
        message: `${key} must be a number`,
        diagnostics: {
          ...baseDiag,
          errorCode: 'INVALID_NUTRITION_VALUE',
          stage: 'frontend_validation',
          failedField: key,
          validationReason: 'type_mismatch',
        },
      },
    }
  }
  if (!Number.isFinite(rawVal)) {
    return {
      ok: false,
      outcome: {
        ok: false,
        errorCode: 'INVALID_NUTRITION_VALUE',
        message: `${key} must be a finite number`,
        diagnostics: {
          ...baseDiag,
          errorCode: 'INVALID_NUTRITION_VALUE',
          stage: 'frontend_validation',
          failedField: key,
          validationReason: 'non_finite_number',
        },
      },
    }
  }
  if (rawVal < min || rawVal > max) {
    return {
      ok: false,
      outcome: {
        ok: false,
        errorCode: 'OUT_OF_RANGE',
        message: `${key} is out of valid range`,
        diagnostics: {
          ...baseDiag,
          errorCode: 'OUT_OF_RANGE',
          stage: 'frontend_validation',
          failedField: key,
          validationReason: 'out_of_range',
        },
      },
    }
  }
  return { ok: true, value: rawVal }
}

/**
 * AI解析レスポンスの全項目を厳格にバリデーションする。
 * 不正値・欠損値・型不一致・範囲外の値はクランプによって正常値へ変換せず、推論失敗（ok: false）として返す。
 */
export function validateMealAiRawResponse(raw: unknown): MealAiAnalysisOutcome {
  if (!raw || typeof raw !== 'object') {
    return {
      ok: false,
      errorCode: 'INVALID_RESPONSE',
      message: 'AI output is not a valid object',
      diagnostics: {
        errorCode: 'INVALID_RESPONSE',
        stage: 'frontend_validation',
        validationReason: 'type_mismatch',
      },
    }
  }

  const record = raw as MealAiRawResponse & Record<string, unknown>
  const elapsedMs = typeof record.elapsedMs === 'number' && Number.isFinite(record.elapsedMs) && record.elapsedMs >= 0
    ? Math.round(record.elapsedMs)
    : undefined
  const inspectedPresence = inspectMealAiRawFieldPresence(record)
  const detectedSchemaKeys = detectMealAiRawSchemaKeys(record)
  const baseDiag = extractMealAiDiagnostics(record.diagnostics, {
    stage: 'frontend_validation',
    elapsedMs,
    fieldPresence: inspectedPresence,
    hasSchemaKeys: detectedSchemaKeys,
  })

  // JSON Schema定義そのものが返却された場合
  const hasSchemaContainer = (record.properties && typeof record.properties === 'object') || Array.isArray(record.required)
  if (detectedSchemaKeys && hasSchemaContainer && typeof record.isFood !== 'boolean') {
    return {
      ok: false,
      errorCode: 'SCHEMA_ECHO',
      message: 'AI returned a JSON Schema definition instead of meal analysis data',
      diagnostics: {
        ...baseDiag,
        errorCode: 'SCHEMA_ECHO',
        stage: 'frontend_validation',
        failedField: 'isFood',
        validationReason: 'schema_echo',
        fieldPresence: inspectedPresence,
        hasSchemaKeys: true,
      },
    }
  }

  if (!('isFood' in record) || record.isFood === undefined) {
    return {
      ok: false,
      errorCode: 'MISSING_FIELD',
      message: 'isFood field is missing',
      diagnostics: {
        ...baseDiag,
        errorCode: 'MISSING_FIELD',
        stage: 'frontend_validation',
        failedField: 'isFood',
        validationReason: 'missing_key',
      },
    }
  }
  if (record.isFood === null) {
    return {
      ok: false,
      errorCode: 'MISSING_FIELD',
      message: 'isFood field is null',
      diagnostics: {
        ...baseDiag,
        errorCode: 'MISSING_FIELD',
        stage: 'frontend_validation',
        failedField: 'isFood',
        validationReason: 'null_value',
      },
    }
  }
  if (typeof record.isFood !== 'boolean') {
    return {
      ok: false,
      errorCode: 'INVALID_FIELD_TYPE',
      message: 'isFood field is not a boolean',
      diagnostics: {
        ...baseDiag,
        errorCode: 'INVALID_FIELD_TYPE',
        stage: 'frontend_validation',
        failedField: 'isFood',
        validationReason: typeof record.isFood === 'string' ? 'string_type' : 'type_mismatch',
      },
    }
  }

  if (!record.isFood) {
    return {
      ok: true,
      isFood: false,
      elapsedMs,
      diagnostics: {
        ...baseDiag,
        stage: baseDiag.stage === 'unknown' || baseDiag.stage === 'frontend_validation' ? 'completed' : baseDiag.stage,
      },
    }
  }

  // dishName の検証
  if (!('dishName' in record) || record.dishName === undefined) {
    return {
      ok: false,
      errorCode: 'INVALID_DISH_NAME',
      message: 'dishName is missing',
      diagnostics: {
        ...baseDiag,
        errorCode: 'INVALID_DISH_NAME',
        stage: 'frontend_validation',
        failedField: 'dishName',
        validationReason: 'missing_key',
      },
    }
  }
  if (record.dishName === null) {
    return {
      ok: false,
      errorCode: 'INVALID_DISH_NAME',
      message: 'dishName is null',
      diagnostics: {
        ...baseDiag,
        errorCode: 'INVALID_DISH_NAME',
        stage: 'frontend_validation',
        failedField: 'dishName',
        validationReason: 'null_value',
      },
    }
  }
  if (typeof record.dishName !== 'string') {
    return {
      ok: false,
      errorCode: 'INVALID_DISH_NAME',
      message: 'dishName is not a string',
      diagnostics: {
        ...baseDiag,
        errorCode: 'INVALID_DISH_NAME',
        stage: 'frontend_validation',
        failedField: 'dishName',
        validationReason: 'type_mismatch',
      },
    }
  }
  const dishName = record.dishName.trim()
  if (dishName.length === 0) {
    return {
      ok: false,
      errorCode: 'INVALID_DISH_NAME',
      message: 'dishName is empty',
      diagnostics: {
        ...baseDiag,
        errorCode: 'INVALID_DISH_NAME',
        stage: 'frontend_validation',
        failedField: 'dishName',
        validationReason: 'empty_string',
      },
    }
  }
  if (dishName.length > MEAL_AI_MAX_DISH_NAME_LENGTH) {
    return {
      ok: false,
      errorCode: 'INVALID_DISH_NAME',
      message: 'dishName exceeds maximum length',
      diagnostics: {
        ...baseDiag,
        errorCode: 'INVALID_DISH_NAME',
        stage: 'frontend_validation',
        failedField: 'dishName',
        validationReason: 'string_too_long',
      },
    }
  }

  // recognizedItems の検証
  const recognizedItems: string[] = []
  if (record.recognizedItems !== undefined && record.recognizedItems !== null) {
    if (!Array.isArray(record.recognizedItems)) {
      return {
        ok: false,
        errorCode: 'INVALID_FIELD_TYPE',
        message: 'recognizedItems must be an array',
        diagnostics: {
          ...baseDiag,
          errorCode: 'INVALID_FIELD_TYPE',
          stage: 'frontend_validation',
          failedField: 'recognizedItems',
          validationReason: typeof record.recognizedItems === 'string' ? 'string_type' : 'type_mismatch',
        },
      }
    }
    for (const item of record.recognizedItems) {
      if (item === null) {
        return {
          ok: false,
          errorCode: 'INVALID_FIELD_TYPE',
          message: 'recognizedItems elements must not be null',
          diagnostics: {
            ...baseDiag,
            errorCode: 'INVALID_FIELD_TYPE',
            stage: 'frontend_validation',
            failedField: 'recognizedItems',
            validationReason: 'null_value',
          },
        }
      }
      if (typeof item !== 'string') {
        return {
          ok: false,
          errorCode: 'INVALID_FIELD_TYPE',
          message: 'recognizedItems elements must be strings',
          diagnostics: {
            ...baseDiag,
            errorCode: 'INVALID_FIELD_TYPE',
            stage: 'frontend_validation',
            failedField: 'recognizedItems',
            validationReason: 'type_mismatch',
          },
        }
      }
      const trimmedItem = item.trim()
      if (trimmedItem.length > 0 && trimmedItem.length <= MEAL_AI_MAX_DISH_NAME_LENGTH && recognizedItems.length < 20) {
        recognizedItems.push(trimmedItem)
      }
    }
  }
  if (recognizedItems.length === 0) {
    recognizedItems.push(dishName)
  }

  // カロリー・三大栄養素の厳格検証（クランプ禁止・0補完禁止）
  const calCheck = validateStrictNutritionField(record, 'calories', MEAL_AI_MIN_CALORIES, MEAL_AI_MAX_CALORIES, baseDiag)
  if (!calCheck.ok) return calCheck.outcome

  const protCheck = validateStrictNutritionField(record, 'protein', MEAL_AI_MIN_MACRO_GRAMS, MEAL_AI_MAX_MACRO_GRAMS, baseDiag)
  if (!protCheck.ok) return protCheck.outcome

  const fatCheck = validateStrictNutritionField(record, 'fat', MEAL_AI_MIN_MACRO_GRAMS, MEAL_AI_MAX_MACRO_GRAMS, baseDiag)
  if (!fatCheck.ok) return fatCheck.outcome

  const carbsCheck = validateStrictNutritionField(record, 'carbs', MEAL_AI_MIN_MACRO_GRAMS, MEAL_AI_MAX_MACRO_GRAMS, baseDiag)
  if (!carbsCheck.ok) return carbsCheck.outcome

  return {
    ok: true,
    isFood: true,
    estimation: {
      dishName,
      recognizedItems,
      calories: Math.round(calCheck.value),
      protein: roundToOneDecimal(protCheck.value),
      fat: roundToOneDecimal(fatCheck.value),
      carbs: roundToOneDecimal(carbsCheck.value),
      elapsedMs,
    },
    diagnostics: {
      ...baseDiag,
      stage: baseDiag.stage === 'frontend_validation' ? 'completed' : baseDiag.stage,
    },
  }
}

/**
 * 検証済みの栄養素推定結果を食事ログフォームのRefへ一括（アトミック）反映する。
 * 万一いずれかの値が不正な場合は1項目も変更せず false を返す。
 */
export function applyMealAiEstimationToRefs(
  estimation: MealAiNutritionEstimation,
  refs: Pick<MealLogRefs, 'mealCalories' | 'mealProtein' | 'mealFat' | 'mealCarbs'>,
): boolean {
  const validated = validateMealAiRawResponse({
    isFood: true,
    dishName: estimation.dishName,
    recognizedItems: estimation.recognizedItems,
    calories: estimation.calories,
    protein: estimation.protein,
    fat: estimation.fat,
    carbs: estimation.carbs,
    elapsedMs: estimation.elapsedMs,
  })
  if (!validated.ok || !validated.isFood) {
    return false
  }

  refs.mealCalories.value = validated.estimation.calories
  refs.mealProtein.value = validated.estimation.protein
  refs.mealFat.value = validated.estimation.fat
  refs.mealCarbs.value = validated.estimation.carbs
  return true
}

/**
 * Capacitorプラグイン例外から安全なエラーコードを取り出す（個人情報は含めない）
 */
export function extractMealAiErrorCode(error: unknown, fallbackCode = 'INFERENCE_FAILED'): string {
  if (error && typeof error === 'object') {
    const errObj = error as { code?: unknown, message?: unknown, data?: unknown }
    if (typeof errObj.code === 'string' && errObj.code.trim().length > 0) {
      return errObj.code.trim().toUpperCase()
    }
    if (errObj.data && typeof errObj.data === 'object') {
      const dataCode = (errObj.data as { errorCode?: unknown }).errorCode
      if (typeof dataCode === 'string' && dataCode.trim().length > 0) {
        return dataCode.trim().toUpperCase()
      }
    }
    if (typeof errObj.message === 'string') {
      const msg = errObj.message.toUpperCase()
      if (msg.includes('MODEL_DOWNLOAD_REQUIRED')) return 'MODEL_DOWNLOAD_REQUIRED'
      if (msg.includes('MODEL_DOWNLOADING')) return 'MODEL_DOWNLOADING'
      if (msg.includes('MODEL_UNAVAILABLE')) return 'MODEL_UNAVAILABLE'
      if (msg.includes('INVALID_IMAGE')) return 'INVALID_IMAGE'
      if (msg.includes('NOT_ENOUGH_STORAGE')) return 'NOT_ENOUGH_STORAGE'
      if (msg.includes('QUOTA_EXCEEDED')) return 'QUOTA_EXCEEDED'
      if (msg.includes('SCHEMA_ECHO')) return 'SCHEMA_ECHO'
      if (msg.includes('OUTPUT_TRUNCATED')) return 'OUTPUT_TRUNCATED'
      if (msg.includes('INVALID_JSON')) return 'INVALID_JSON'
      if (msg.includes('EMPTY_RESPONSE')) return 'EMPTY_RESPONSE'
      if (msg.includes('OUT_OF_RANGE')) return 'OUT_OF_RANGE'
      if (msg.includes('TIMEOUT')) return 'TIMEOUT'
      if (msg.includes('BUSY')) return 'BUSY'
      if (msg.includes('CANCELLED')) return 'CANCELLED'
    }
  }
  return fallbackCode
}

/**
 * Gemini Nanoの利用可否・モデル準備状態を確認する
 */
export async function checkMealAiAvailability(): Promise<MealAiAvailabilityResult> {
  if (!isAndroidNativeApp()) {
    return {
      available: false,
      status: 'unavailable',
      platform: 'web',
      retryable: false,
    }
  }
  try {
    const result = await MealAiPlugin.checkStatus()
    const validStatuses: MealAiFeatureStatus[] = ['available', 'downloadable', 'downloading', 'unavailable']
    const normalizedStatus: MealAiFeatureStatus = validStatuses.includes(result.status)
      ? result.status
      : 'unavailable'
    return {
      available: normalizedStatus === 'available' && Boolean(result.available),
      status: normalizedStatus,
      featureStatus: result.featureStatus,
      platform: result.platform || 'android',
      structuredOutputAvailable: typeof result.structuredOutputAvailable === 'boolean' ? result.structuredOutputAvailable : undefined,
      errorCode: result.errorCode,
      retryable: result.retryable,
    }
  }
  catch (error) {
    return {
      available: false,
      status: 'unavailable',
      platform: 'android',
      errorCode: extractMealAiErrorCode(error, 'STATUS_CHECK_FAILED'),
      retryable: true,
    }
  }
}

/**
 * Gemini Nanoモデルをダウンロードし、進捗コールバックを通知する
 */
export async function downloadMealAiModel(
  onProgress?: (event: MealAiDownloadProgressEvent) => void,
): Promise<MealAiDownloadResult> {
  if (!isAndroidNativeApp()) {
    throw new Error('MODEL_UNAVAILABLE')
  }

  let listenerHandle: PluginListenerHandle | null = null
  try {
    if (onProgress) {
      listenerHandle = await MealAiPlugin.addListener('downloadProgress', (event) => {
        onProgress(event)
      })
    }
    return await MealAiPlugin.downloadModel()
  }
  finally {
    if (listenerHandle) {
      try {
        await listenerHandle.remove()
      }
      catch {
        // リスナー解除失敗は無視
      }
    }
  }
}

/**
 * 食事写真をオンデバイスGemini Nanoで解析し、厳格バリデーション済みの結果を返す
 */
export async function analyzeMealPhotoWithAi(options: {
  photoBase64: string
  hintText?: string
  locale?: string
}): Promise<MealAiAnalysisOutcome> {
  if (!isAndroidNativeApp()) {
    return {
      ok: false,
      errorCode: 'MODEL_UNAVAILABLE',
      message: 'On-device AI meal analysis is only available on Android',
      diagnostics: {
        errorCode: 'MODEL_UNAVAILABLE',
        stage: 'platform_check',
      },
    }
  }

  const trimmedPhoto = options.photoBase64?.trim() || ''
  if (!trimmedPhoto || trimmedPhoto.length > MEAL_AI_MAX_BASE64_LENGTH) {
    return {
      ok: false,
      errorCode: 'INVALID_IMAGE',
      message: 'Meal photo is empty or exceeds maximum size limit',
      diagnostics: {
        errorCode: 'INVALID_IMAGE',
        stage: 'input_validation',
      },
    }
  }

  try {
    const rawResponse = await MealAiPlugin.analyzeMealPhoto({
      photoBase64: trimmedPhoto,
      hintText: options.hintText,
      locale: options.locale,
    })
    return validateMealAiRawResponse(rawResponse)
  }
  catch (error) {
    const errorCode = extractMealAiErrorCode(error, 'INFERENCE_FAILED')
    const rawErrorData = error && typeof error === 'object' ? (error as { data?: unknown }).data : undefined
    const diagnostics = extractMealAiDiagnostics(rawErrorData, {
      errorCode,
      stage: 'inference',
    })
    return {
      ok: false,
      errorCode,
      message: `Meal analysis failed (${errorCode})`,
      diagnostics,
    }
  }
}
