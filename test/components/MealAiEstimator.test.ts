/**
 * MealAiEstimator コンポーネントのユニットテスト
 * - Web/PWA版での非表示動作
 * - Android版での各モデルステータス（available / downloadable / unavailable）の表示とダウンロード〜推定フロー
 * - 推論結果のフォーム一括反映、AI推定バナー表示、「タイトルに反映」「食事メモに追記」ワンタップ操作
 * - 競合条件の回帰テスト：
 *   - 推論実行中に写真が差し替えまたは削除された場合、後から返却された古い推論結果を破棄して反映しないこと
 *   - 推論実行中に reset() が呼ばれた場合やコンポーネントがアンマウントされた場合、古い推論結果を破棄すること
 *   - 推論実行中は busy-change イベントを発火し二重実行を防止すること
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import MealAiEstimator from '~/components/shared/MealAiEstimator.vue'
import {
  analyzeMealPhotoWithAi,
  checkMealAiAvailability,
  downloadMealAiModel,
  isMealAiSupportedPlatform,
  type MealAiAnalysisOutcome,
} from '~/utils/mealAi'

vi.mock('~/utils/mealAi', async () => {
  const actual = await vi.importActual<typeof import('~/utils/mealAi')>('~/utils/mealAi')
  return {
    ...actual,
    isMealAiSupportedPlatform: vi.fn(() => true),
    checkMealAiAvailability: vi.fn(),
    downloadMealAiModel: vi.fn(),
    analyzeMealPhotoWithAi: vi.fn(),
  }
})

describe('MealAiEstimator.vue', () => {
  const samplePhotoA = 'data:image/jpeg;base64,cGhvdG9B'
  const samplePhotoB = 'data:image/jpeg;base64,cGhvdG9C'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isMealAiSupportedPlatform).mockReturnValue(true)
    vi.mocked(checkMealAiAvailability).mockResolvedValue({
      available: true,
      status: 'available',
      platform: 'android',
    })
  })

  it('Web/PWA版（非対応プラットフォーム）では何も描画しない', async () => {
    vi.mocked(isMealAiSupportedPlatform).mockReturnValue(false)

    const wrapper = await mountSuspended(MealAiEstimator, {
      props: {
        photo: samplePhotoA,
      },
    })
    await flushPromises()

    expect(wrapper.find('.meal-ai-estimator').exists()).toBe(false)
    expect(checkMealAiAvailability).not.toHaveBeenCalled()
  })

  it('Android版でモデルが準備完了（available）のとき、推定を実行して結果バナーを表示し、タイトル・食事メモ反映イベントを発火する', async () => {
    vi.mocked(analyzeMealPhotoWithAi).mockResolvedValue({
      ok: true,
      isFood: true,
      estimation: {
        dishName: '焼き鮭定食',
        recognizedItems: ['焼き鮭', 'ご飯', '味噌汁'],
        calories: 590,
        protein: 31.2,
        fat: 14.5,
        carbs: 79.8,
        elapsedMs: 850,
      },
    })

    const wrapper = await mountSuspended(MealAiEstimator, {
      props: {
        photo: samplePhotoA,
        title: '昼食',
        mealMemo: '定食屋',
      },
    })
    await flushPromises()

    const estimateBtn = wrapper.find('.meal-ai-estimate-btn')
    expect(estimateBtn.exists()).toBe(true)

    await estimateBtn.trigger('click')
    await flushPromises()

    expect(analyzeMealPhotoWithAi).toHaveBeenCalledWith({
      photoBase64: samplePhotoA,
      hintText: '昼食 / 定食屋',
      locale: 'ja',
    })

    // apply-estimation イベントが一括発火されていること
    const applyEvents = wrapper.emitted('apply-estimation')
    expect(applyEvents).toBeTruthy()
    expect(applyEvents![0]![0]).toEqual({
      dishName: '焼き鮭定食',
      recognizedItems: ['焼き鮭', 'ご飯', '味噌汁'],
      calories: 590,
      protein: 31.2,
      fat: 14.5,
      carbs: 79.8,
      elapsedMs: 850,
    })

    // AI推定結果バナーが表示されていること
    const banner = wrapper.find('.meal-ai-result-banner')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('焼き鮭定食')
    expect(banner.text()).toContain('590kcal')

    // 「タイトルに反映」「食事メモに追記」ボタンが動作すること
    const quickBtns = banner.findAll('.quick-action-btn')
    expect(quickBtns.length).toBe(2)

    await quickBtns[0]!.trigger('click')
    expect(wrapper.emitted('apply-title')?.[0]).toEqual(['焼き鮭定食'])

    await quickBtns[1]!.trigger('click')
    expect(wrapper.emitted('append-memo')?.[0]).toEqual(['焼き鮭定食（焼き鮭、ご飯、味噌汁）'])
  })

  it('推論実行中に写真が差し替えられた場合、後から完了した古い推論結果を破棄して反映しない', async () => {
    let resolveFirstAnalysis!: (value: MealAiAnalysisOutcome) => void
    const firstPromise = new Promise<MealAiAnalysisOutcome>((resolve) => {
      resolveFirstAnalysis = resolve
    })
    vi.mocked(analyzeMealPhotoWithAi).mockReturnValueOnce(firstPromise)

    const wrapper = await mountSuspended(MealAiEstimator, {
      props: {
        photo: samplePhotoA,
      },
    })
    await flushPromises()

    // 1枚目の写真で推論を開始
    await wrapper.find('.meal-ai-estimate-btn').trigger('click')
    expect(wrapper.emitted('busy-change')?.at(-1)).toEqual([true])

    // 推論完了前に写真を2枚目へ差し替え
    await wrapper.setProps({ photo: samplePhotoB })
    await flushPromises()

    // 差し替え時点で busy が解除されること
    expect(wrapper.emitted('busy-change')?.at(-1)).toEqual([false])

    // 後から1枚目の推論結果が返却されても無視されること
    resolveFirstAnalysis({
      ok: true,
      isFood: true,
      estimation: {
        dishName: '古い写真の結果',
        recognizedItems: ['古い写真の結果'],
        calories: 999,
        protein: 50,
        fat: 50,
        carbs: 50,
      },
    })
    await flushPromises()

    expect(wrapper.emitted('apply-estimation')).toBeUndefined()
    expect(wrapper.find('.meal-ai-result-banner').exists()).toBe(false)
  })

  it('推論実行中に reset() が呼ばれた場合、後から返却された古い推論結果を破棄する', async () => {
    let resolveAnalysis!: (value: MealAiAnalysisOutcome) => void
    vi.mocked(analyzeMealPhotoWithAi).mockReturnValueOnce(
      new Promise<MealAiAnalysisOutcome>((resolve) => {
        resolveAnalysis = resolve
      }),
    )

    const wrapper = await mountSuspended(MealAiEstimator, {
      props: {
        photo: samplePhotoA,
      },
    })
    await flushPromises()

    await wrapper.find('.meal-ai-estimate-btn').trigger('click')

    // 親フォームから reset() を呼び出す
    ;(wrapper.vm as { reset: () => void }).reset()
    await flushPromises()

    resolveAnalysis({
      ok: true,
      isFood: true,
      estimation: {
        dishName: 'リセット前の結果',
        recognizedItems: ['リセット前の結果'],
        calories: 500,
        protein: 20,
        fat: 15,
        carbs: 60,
      },
    })
    await flushPromises()

    expect(wrapper.emitted('apply-estimation')).toBeUndefined()
    expect(wrapper.find('.meal-ai-result-banner').exists()).toBe(false)
  })

  it('モデルが要ダウンロード（downloadable）の場合、「AIモデルをダウンロードして推定」からダウンロードと推論を連続実行できる', async () => {
    vi.mocked(checkMealAiAvailability).mockResolvedValue({
      available: false,
      status: 'downloadable',
      platform: 'android',
      retryable: true,
    })
    vi.mocked(downloadMealAiModel).mockImplementation(async (onProgress) => {
      onProgress?.({ status: 'progress', bytesToDownload: 1000, totalBytesDownloaded: 600 })
      return { status: 'available', downloaded: true }
    })
    vi.mocked(analyzeMealPhotoWithAi).mockResolvedValue({
      ok: true,
      isFood: true,
      estimation: {
        dishName: 'トーストと目玉焼き',
        recognizedItems: ['トースト', '目玉焼き'],
        calories: 410,
        protein: 16.5,
        fat: 18.2,
        carbs: 44.0,
      },
    })

    const wrapper = await mountSuspended(MealAiEstimator, {
      props: {
        photo: samplePhotoA,
      },
    })
    await flushPromises()

    const downloadBtn = wrapper.find('.meal-ai-download-btn')
    expect(downloadBtn.exists()).toBe(true)

    await downloadBtn.trigger('click')
    await flushPromises()

    expect(downloadMealAiModel).toHaveBeenCalledOnce()
    expect(analyzeMealPhotoWithAi).toHaveBeenCalledOnce()
    expect(wrapper.emitted('apply-estimation')?.[0]?.[0]).toMatchObject({
      dishName: 'トーストと目玉焼き',
      calories: 410,
    })
  })

  it('非食品画像（isFood: false）やバリデーション・途中切断エラー時は apply-estimation を発火せず、エラーメッセージと診断情報（エラーコード・段階・文字数・処理時間等）を画面に表示する', async () => {
    vi.mocked(analyzeMealPhotoWithAi).mockResolvedValueOnce({
      ok: true,
      isFood: false,
      diagnostics: {
        stage: 'completed',
        attemptCount: 1,
        responseLength: 82,
        finishReason: 'STOP',
        elapsedMs: 610,
      },
    })

    const wrapper = await mountSuspended(MealAiEstimator, {
      props: {
        photo: samplePhotoA,
      },
    })
    await flushPromises()

    await wrapper.find('.meal-ai-estimate-btn').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('apply-estimation')).toBeUndefined()
    expect(wrapper.find('.meal-ai-error-banner').exists()).toBe(true)
    expect(wrapper.find('.meal-ai-error-banner').text()).toContain('食事・食品を認識できませんでした')
    expect(wrapper.find('.meal-ai-error-diagnostics').text()).toContain('CODE: NOT_FOOD')
    expect(wrapper.find('.meal-ai-error-diagnostics').text()).toContain('len: 82')

    // 次にAI出力バリデーションエラー・フォールバック後の診断情報表示のケース
    vi.mocked(analyzeMealPhotoWithAi).mockResolvedValueOnce({
      ok: false,
      errorCode: 'INVALID_NUTRITION_VALUE',
      message: 'Invalid nutrition value for calories',
      diagnostics: {
        errorCode: 'INVALID_NUTRITION_VALUE',
        stage: 'schema_validation',
        failedField: 'calories',
        validationReason: 'string_type',
        fieldPresence: 'isFood:bool,dishName:str,recognizedItems:arr,calories:str,protein:num,fat:num,carbs:num',
        hasSchemaKeys: false,
        inferenceMode: 'typed_then_freeform',
        structuredOutputAvailable: true,
        attemptCount: 2,
        responseLength: 84,
        finishReason: 'STOP',
        elapsedMs: 8547,
      },
    })

    await wrapper.find('.meal-ai-estimate-btn').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('apply-estimation')).toBeUndefined()
    expect(wrapper.find('.meal-ai-error-banner').text()).toContain('不正な形式だったため反映を中止しました')
    const diagText = wrapper.find('.meal-ai-error-diagnostics').text()
    expect(diagText).toContain('CODE: INVALID_NUTRITION_VALUE')
    expect(diagText).toContain('mode: typed_then_freeform')
    expect(diagText).toContain('structured: true')
    expect(diagText).toContain('stage: schema_validation')
    expect(diagText).toContain('field: calories')
    expect(diagText).toContain('reason: string_type')
    expect(diagText).toContain('attempts: 2')
    expect(diagText).toContain('len: 84')
    expect(diagText).toContain('finish: STOP')
    expect(diagText).toContain('time: 8547ms')
    expect(diagText).toContain('fields: isFood:bool,dishName:str,recognizedItems:arr,calories:str,protein:num,fat:num,carbs:num')
  })
})
