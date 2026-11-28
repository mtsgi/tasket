/**
 * mealAi ユーティリティのユニットテスト
 * - AI出力の厳格バリデーション（欠損値・型不正・負数・上限超過をクランプせずエラーとして扱う）
 * - カロリー（整数）・PFC（小数第1位）の丸め
 * - 食事ログRefへのアトミック（全項目検証後一括）反映と失敗時の既存値保護
 * - 補助ヒント構築・文字数制限
 * - Web/PWA版とAndroid版のプラットフォーム判定・プラグイン呼び出し・進捗リスナー解除
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import {
  MealAiPlugin,
  analyzeMealPhotoWithAi,
  applyMealAiEstimationToRefs,
  buildMealAiHintText,
  checkMealAiAvailability,
  downloadMealAiModel,
  extractMealAiDiagnostics,
  extractMealAiErrorCode,
  formatMealAiDiagnosticsSummary,
  validateMealAiRawResponse,
} from '~/utils/mealAi'
import { isAndroidNativeApp } from '~/utils/healthConnect'

vi.mock('@capacitor/core', async () => {
  const actual = await vi.importActual<typeof import('@capacitor/core')>('@capacitor/core')
  return {
    ...actual,
    registerPlugin: vi.fn(() => ({
      checkStatus: vi.fn(),
      downloadModel: vi.fn(),
      analyzeMealPhoto: vi.fn(),
      addListener: vi.fn(),
    })),
  }
})

vi.mock('~/utils/healthConnect', async () => {
  const actual = await vi.importActual<typeof import('~/utils/healthConnect')>('~/utils/healthConnect')
  return {
    ...actual,
    isAndroidNativeApp: vi.fn(() => false),
  }
})

describe('mealAi utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isAndroidNativeApp).mockReturnValue(false)
  })

  describe('buildMealAiHintText', () => {
    it('タイトルと食事メモが存在する場合は結合して補助ヒントを生成する', () => {
      expect(buildMealAiHintText('鮭定食', 'ご飯少なめ')).toBe('鮭定食 / ご飯少なめ')
      expect(buildMealAiHintText('  カレーライス  ', '')).toBe('カレーライス')
      expect(buildMealAiHintText('', '  サラダ追加  ')).toBe('サラダ追加')
      expect(buildMealAiHintText('   ', '   ')).toBeUndefined()
      expect(buildMealAiHintText(undefined, undefined)).toBeUndefined()
    })

    it('200文字を超える場合は上限で切り詰める', () => {
      const longMemo = 'あ'.repeat(250)
      const hint = buildMealAiHintText('昼食', longMemo)
      expect(hint).toBeDefined()
      expect(hint!.length).toBeLessThanOrEqual(200)
    })
  })

  describe('validateMealAiRawResponse', () => {
    it('正常なAI出力を検証し、カロリーを整数・PFCを小数第1位に丸める', () => {
      const outcome = validateMealAiRawResponse({
        isFood: true,
        dishName: '  鶏むね肉とブロッコリーのサラダ  ',
        recognizedItems: ['鶏むね肉', 'ブロッコリー', 'ゆで卵'],
        calories: 384.6,
        protein: 42.34,
        fat: 11.26,
        carbs: 14.05,
        elapsedMs: 1245.8,
      })

      expect(outcome.ok).toBe(true)
      if (outcome.ok && outcome.isFood) {
        expect(outcome.estimation.dishName).toBe('鶏むね肉とブロッコリーのサラダ')
        expect(outcome.estimation.recognizedItems).toEqual(['鶏むね肉', 'ブロッコリー', 'ゆで卵'])
        expect(outcome.estimation.calories).toBe(385)
        expect(outcome.estimation.protein).toBe(42.3)
        expect(outcome.estimation.fat).toBe(11.3)
        expect(outcome.estimation.carbs).toBe(14.1)
        expect(outcome.estimation.elapsedMs).toBe(1246)
      }
    })

    it('isFood が false の場合は非食品として ok: true, isFood: false を返す', () => {
      const outcome = validateMealAiRawResponse({
        isFood: false,
        dishName: '',
        recognizedItems: [],
        elapsedMs: 650,
      })

      expect(outcome).toMatchObject({
        ok: true,
        isFood: false,
        elapsedMs: 650,
      })
    })

    it('欠損値・null・非数値・NaN・範囲外の値をクランプせずエラーとして拒否する', () => {
      // 1. カロリー欠損
      expect(
        validateMealAiRawResponse({
          isFood: true,
          dishName: 'ラーメン',
          recognizedItems: ['ラーメン'],
          protein: 25,
          fat: 20,
          carbs: 75,
        }).ok,
      ).toBe(false)

      // 2. タンパク質が負数（クランプせず OUT_OF_RANGE）
      const negProtein = validateMealAiRawResponse({
        isFood: true,
        dishName: 'ラーメン',
        recognizedItems: ['ラーメン'],
        calories: 650,
        protein: -0.1,
        fat: 20,
        carbs: 75,
      })
      expect(negProtein.ok).toBe(false)
      if (!negProtein.ok) {
        expect(negProtein.errorCode).toBe('OUT_OF_RANGE')
      }

      // 3. カロリーが上限超過（10000超をクランプせず OUT_OF_RANGE）
      const highCalories = validateMealAiRawResponse({
        isFood: true,
        dishName: 'ラーメン',
        recognizedItems: ['ラーメン'],
        calories: 10001,
        protein: 25,
        fat: 20,
        carbs: 75,
      })
      expect(highCalories.ok).toBe(false)
      if (!highCalories.ok) {
        expect(highCalories.errorCode).toBe('OUT_OF_RANGE')
      }

      // 4. 炭水化物が上限超過（1000g超をクランプせず OUT_OF_RANGE）
      const highCarbs = validateMealAiRawResponse({
        isFood: true,
        dishName: 'ラーメン',
        recognizedItems: ['ラーメン'],
        calories: 650,
        protein: 25,
        fat: 20,
        carbs: 1000.1,
      })
      expect(highCarbs.ok).toBe(false)
      if (!highCarbs.ok) {
        expect(highCarbs.errorCode).toBe('OUT_OF_RANGE')
      }

      // 5. NaN や文字列の混入
      expect(
        validateMealAiRawResponse({
          isFood: true,
          dishName: 'ラーメン',
          calories: Number.NaN,
          protein: 25,
          fat: 20,
          carbs: 75,
        }).ok,
      ).toBe(false)

      expect(
        validateMealAiRawResponse({
          isFood: true,
          dishName: 'ラーメン',
          calories: '650',
          protein: 25,
          fat: 20,
          carbs: 75,
        }).ok,
      ).toBe(false)

      // 6. 空の料理名
      const emptyDish = validateMealAiRawResponse({
        isFood: true,
        dishName: '   ',
        calories: 650,
        protein: 25,
        fat: 20,
        carbs: 75,
      })
      expect(emptyDish.ok).toBe(false)
      if (!emptyDish.ok) {
        expect(emptyDish.errorCode).toBe('INVALID_DISH_NAME')
      }

      // 7. recognizedItems の型不正
      const badItems = validateMealAiRawResponse({
        isFood: true,
        dishName: 'ラーメン',
        recognizedItems: [123],
        calories: 650,
        protein: 25,
        fat: 20,
        carbs: 75,
      })
      expect(badItems.ok).toBe(false)
      if (!badItems.ok) {
        expect(badItems.errorCode).toBe('INVALID_FIELD_TYPE')
      }

      // 8. JSON Schema そのものが出力された場合（SCHEMA_ECHO）
      const schemaEcho = validateMealAiRawResponse({
        type: 'object',
        properties: {
          isFood: { type: 'boolean' },
          dishName: { type: 'string' },
          calories: { type: 'number' },
        },
        required: ['isFood', 'dishName', 'calories'],
      })
      expect(schemaEcho.ok).toBe(false)
      if (!schemaEcho.ok) {
        expect(schemaEcho.errorCode).toBe('SCHEMA_ECHO')
        expect(schemaEcho.diagnostics?.validationReason).toBe('schema_echo')
        expect(schemaEcho.diagnostics?.hasSchemaKeys).toBe(true)
      }

      // 9. isFood の欠落・null・文字列型での validationReason と fieldPresence
      const missingIsFood = validateMealAiRawResponse({
        dishName: 'ラーメン',
        recognizedItems: ['ラーメン'],
        calories: 650,
        protein: 25,
        fat: 20,
        carbs: 75,
      })
      expect(missingIsFood.ok).toBe(false)
      if (!missingIsFood.ok) {
        expect(missingIsFood.errorCode).toBe('MISSING_FIELD')
        expect(missingIsFood.diagnostics?.failedField).toBe('isFood')
        expect(missingIsFood.diagnostics?.validationReason).toBe('missing_key')
        expect(missingIsFood.diagnostics?.fieldPresence).toBe(
          'isFood:missing,dishName:str,recognizedItems:arr,calories:num,protein:num,fat:num,carbs:num',
        )
      }

      const nullIsFood = validateMealAiRawResponse({
        isFood: null,
        dishName: 'ラーメン',
      })
      expect(nullIsFood.ok).toBe(false)
      if (!nullIsFood.ok) {
        expect(nullIsFood.errorCode).toBe('MISSING_FIELD')
        expect(nullIsFood.diagnostics?.validationReason).toBe('null_value')
      }

      const strIsFood = validateMealAiRawResponse({
        isFood: 'true',
        dishName: 'ラーメン',
      })
      expect(strIsFood.ok).toBe(false)
      if (!strIsFood.ok) {
        expect(strIsFood.errorCode).toBe('INVALID_FIELD_TYPE')
        expect(strIsFood.diagnostics?.validationReason).toBe('string_type')
      }

      // 10. calories/protein/fat/carbs の欠落・null・文字列型・非数値での validationReason
      const missingCalories = validateMealAiRawResponse({
        isFood: true,
        dishName: 'ラーメン',
        recognizedItems: ['ラーメン'],
        protein: 25,
        fat: 20,
        carbs: 75,
      })
      expect(missingCalories.ok).toBe(false)
      if (!missingCalories.ok) {
        expect(missingCalories.errorCode).toBe('INVALID_NUTRITION_VALUE')
        expect(missingCalories.diagnostics?.failedField).toBe('calories')
        expect(missingCalories.diagnostics?.validationReason).toBe('missing_key')
      }

      const nullCalories = validateMealAiRawResponse({
        isFood: true,
        dishName: 'ラーメン',
        recognizedItems: ['ラーメン'],
        calories: null,
        protein: 25,
        fat: 20,
        carbs: 75,
      })
      expect(nullCalories.ok).toBe(false)
      if (!nullCalories.ok) {
        expect(nullCalories.errorCode).toBe('INVALID_NUTRITION_VALUE')
        expect(nullCalories.diagnostics?.failedField).toBe('calories')
        expect(nullCalories.diagnostics?.validationReason).toBe('null_value')
      }

      const stringCalories = validateMealAiRawResponse({
        isFood: true,
        dishName: 'ラーメン',
        recognizedItems: ['ラーメン'],
        calories: '650kcal',
        protein: 25,
        fat: 20,
        carbs: 75,
      })
      expect(stringCalories.ok).toBe(false)
      if (!stringCalories.ok) {
        expect(stringCalories.errorCode).toBe('INVALID_NUTRITION_VALUE')
        expect(stringCalories.diagnostics?.failedField).toBe('calories')
        expect(stringCalories.diagnostics?.validationReason).toBe('string_type')
      }
    })
  })

  describe('applyMealAiEstimationToRefs', () => {
    it('全項目が有効な場合は4つの栄養素Refへ一括反映する', () => {
      const mealCalories = ref<number | undefined>(100)
      const mealProtein = ref<number | undefined>(5)
      const mealFat = ref<number | undefined>(2)
      const mealCarbs = ref<number | undefined>(10)

      const applied = applyMealAiEstimationToRefs(
        {
          dishName: '牛丼',
          recognizedItems: ['牛丼'],
          calories: 720,
          protein: 22.4,
          fat: 24.8,
          carbs: 98.5,
        },
        { mealCalories, mealProtein, mealFat, mealCarbs },
      )

      expect(applied).toBe(true)
      expect(mealCalories.value).toBe(720)
      expect(mealProtein.value).toBe(22.4)
      expect(mealFat.value).toBe(24.8)
      expect(mealCarbs.value).toBe(98.5)
    })

    it('1項目でも不正・範囲外がある場合は既存のRefを一切変更しない（部分反映の防止）', () => {
      const mealCalories = ref<number | undefined>(450)
      const mealProtein = ref<number | undefined>(18.0)
      const mealFat = ref<number | undefined>(12.0)
      const mealCarbs = ref<number | undefined>(55.0)

      const applied = applyMealAiEstimationToRefs(
        {
          dishName: '牛丼',
          recognizedItems: ['牛丼'],
          calories: 720,
          protein: 22.4,
          fat: -5.0, // 不正な負数
          carbs: 98.5,
        },
        { mealCalories, mealProtein, mealFat, mealCarbs },
      )

      expect(applied).toBe(false)
      expect(mealCalories.value).toBe(450)
      expect(mealProtein.value).toBe(18.0)
      expect(mealFat.value).toBe(12.0)
      expect(mealCarbs.value).toBe(55.0)
    })
  })

  describe('Capacitor plugin calls (checkMealAiAvailability / downloadMealAiModel / analyzeMealPhotoWithAi)', () => {
    it('Web/PWA環境ではネイティブプラグインを呼ばずに unavailable を返す', async () => {
      vi.mocked(isAndroidNativeApp).mockReturnValue(false)
      const status = await checkMealAiAvailability()
      expect(status).toEqual({
        available: false,
        status: 'unavailable',
        platform: 'web',
        retryable: false,
      })

      const analysis = await analyzeMealPhotoWithAi({
        photoBase64: 'data:image/jpeg;base64,aGVsbG8=',
      })
      expect(analysis.ok).toBe(false)
      if (!analysis.ok) {
        expect(analysis.errorCode).toBe('MODEL_UNAVAILABLE')
      }
    })

    it('Android環境で checkStatus・downloadModel・analyzeMealPhoto を呼び出し、進捗リスナーを確実に解除する', async () => {
      vi.mocked(isAndroidNativeApp).mockReturnValue(true)

      const checkSpy = vi.spyOn(MealAiPlugin, 'checkStatus').mockResolvedValue({
        available: true,
        status: 'available',
        featureStatus: 3,
        platform: 'android',
      })

      const availability = await checkMealAiAvailability()
      expect(checkSpy).toHaveBeenCalledOnce()
      expect(availability.available).toBe(true)
      expect(availability.status).toBe('available')

      const removeListenerMock = vi.fn().mockResolvedValue(undefined)
      const addListenerSpy = vi.spyOn(MealAiPlugin, 'addListener').mockImplementation(async (_event, cb) => {
        cb({ status: 'progress', bytesToDownload: 1000, totalBytesDownloaded: 500 })
        return { remove: removeListenerMock }
      })
      const downloadSpy = vi.spyOn(MealAiPlugin, 'downloadModel').mockResolvedValue({
        status: 'available',
        downloaded: true,
      })

      const progressEvents: number[] = []
      const downloadRes = await downloadMealAiModel((ev) => {
        progressEvents.push(ev.totalBytesDownloaded)
      })
      expect(addListenerSpy).toHaveBeenCalledOnce()
      expect(downloadSpy).toHaveBeenCalledOnce()
      expect(progressEvents).toEqual([500])
      expect(downloadRes.downloaded).toBe(true)
      expect(removeListenerMock).toHaveBeenCalledOnce()

      const analyzeSpy = vi.spyOn(MealAiPlugin, 'analyzeMealPhoto').mockResolvedValue({
        isFood: true,
        dishName: '親子丼',
        recognizedItems: ['親子丼', '味噌汁'],
        calories: 680,
        protein: 29.2,
        fat: 16.5,
        carbs: 94.0,
        elapsedMs: 920,
      })

      const outcome = await analyzeMealPhotoWithAi({
        photoBase64: 'data:image/jpeg;base64,aGVsbG8=',
        hintText: '親子丼セット',
        locale: 'ja',
      })
      expect(analyzeSpy).toHaveBeenCalledWith({
        photoBase64: 'data:image/jpeg;base64,aGVsbG8=',
        hintText: '親子丼セット',
        locale: 'ja',
      })
      expect(outcome.ok).toBe(true)
      if (outcome.ok && outcome.isFood) {
        expect(outcome.estimation.dishName).toBe('親子丼')
        expect(outcome.estimation.calories).toBe(680)
      }
    })

    it('extractMealAiErrorCode・extractMealAiDiagnostics・formatMealAiDiagnosticsSummary が診断情報を正しく抽出・整形し、PIIを含まない', async () => {
      expect(extractMealAiErrorCode({ code: 'model_download_required' })).toBe('MODEL_DOWNLOAD_REQUIRED')
      expect(extractMealAiErrorCode({ message: 'Failed', data: { errorCode: 'output_truncated' } })).toBe('OUTPUT_TRUNCATED')
      expect(extractMealAiErrorCode(new Error('Failed: QUOTA_EXCEEDED'))).toBe('QUOTA_EXCEEDED')
      expect(extractMealAiErrorCode(new Error('Unknown error'), 'CUSTOM_FALLBACK')).toBe('CUSTOM_FALLBACK')

      const diag = extractMealAiDiagnostics({
        errorCode: 'invalid_nutrition_value',
        stage: 'schema_validation',
        elapsedMs: 1420.4,
        attemptCount: 2,
        responseLength: 84,
        finishReason: 'STOP',
        failedField: 'calories',
        validationReason: 'string_type',
        fieldPresence: 'isFood:bool,dishName:str,recognizedItems:arr,calories:str,protein:num,fat:num,carbs:num',
        hasSchemaKeys: false,
        inferenceMode: 'typed_then_freeform',
        structuredOutputAvailable: true,
        // 以下のような個人情報フィールドが万一オブジェクトに含まれていても抽出されないこと
        dishName: '秘密の特製ラーメン',
        hintText: '自宅キッチン',
      })
      expect(diag).toEqual({
        errorCode: 'INVALID_NUTRITION_VALUE',
        stage: 'schema_validation',
        elapsedMs: 1420,
        attemptCount: 2,
        responseLength: 84,
        finishReason: 'STOP',
        failedField: 'calories',
        validationReason: 'string_type',
        fieldPresence: 'isFood:bool,dishName:str,recognizedItems:arr,calories:str,protein:num,fat:num,carbs:num',
        hasSchemaKeys: false,
        inferenceMode: 'typed_then_freeform',
        structuredOutputAvailable: true,
      })

      const summary = formatMealAiDiagnosticsSummary('INVALID_NUTRITION_VALUE', diag)
      expect(summary).toBe(
        'CODE: INVALID_NUTRITION_VALUE | mode: typed_then_freeform | structured: true | stage: schema_validation | field: calories | reason: string_type | schemaKeys: false | fields: isFood:bool,dishName:str,recognizedItems:arr,calories:str,protein:num,fat:num,carbs:num | attempts: 2 | len: 84 | finish: STOP | time: 1420ms',
      )
      expect(summary).not.toContain('秘密の特製ラーメン')
      expect(summary).not.toContain('自宅キッチン')

      // プラグインが diagnostics data 付きで reject した際に analyzeMealPhotoWithAi が診断情報を保持すること
      vi.mocked(isAndroidNativeApp).mockReturnValue(true)
      vi.spyOn(MealAiPlugin, 'analyzeMealPhoto').mockRejectedValueOnce({
        code: 'SCHEMA_ECHO',
        message: 'Model echoed JSON Schema definition instead of meal analysis data',
        data: {
          errorCode: 'SCHEMA_ECHO',
          stage: 'schema_validation',
          failedField: 'isFood',
          validationReason: 'schema_echo',
          fieldPresence: 'isFood:missing,dishName:missing,recognizedItems:missing,calories:missing,protein:missing,fat:missing,carbs:missing',
          hasSchemaKeys: true,
          inferenceMode: 'freeform',
          structuredOutputAvailable: false,
          attemptCount: 2,
          responseLength: 1415,
          finishReason: 'STOP',
          elapsedMs: 14341,
        },
      })

      const failedOutcome = await analyzeMealPhotoWithAi({
        photoBase64: 'data:image/jpeg;base64,aGVsbG8=',
      })
      expect(failedOutcome.ok).toBe(false)
      if (!failedOutcome.ok) {
        expect(failedOutcome.errorCode).toBe('SCHEMA_ECHO')
        expect(failedOutcome.diagnostics).toEqual({
          errorCode: 'SCHEMA_ECHO',
          stage: 'schema_validation',
          failedField: 'isFood',
          validationReason: 'schema_echo',
          fieldPresence: 'isFood:missing,dishName:missing,recognizedItems:missing,calories:missing,protein:missing,fat:missing,carbs:missing',
          hasSchemaKeys: true,
          inferenceMode: 'freeform',
          structuredOutputAvailable: false,
          attemptCount: 2,
          responseLength: 1415,
          finishReason: 'STOP',
          elapsedMs: 14341,
        })
      }
    })
  })
})
