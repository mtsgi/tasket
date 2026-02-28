/**
 * mealLog.ts のユニットテスト
 */
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { clearMealLogRefs } from '../../app/utils/mealLog'
import type { MealLogRefs } from '../../app/utils/mealLog'

/** テスト用のMealLogRefsを生成 */
function createTestRefs(): MealLogRefs {
  return {
    showMealLog: ref(true),
    mealCalories: ref<number | undefined>(500),
    mealProtein: ref<number | undefined>(20),
    mealCarbs: ref<number | undefined>(60),
    mealFat: ref<number | undefined>(15),
    mealPhoto: ref<string | undefined>('photo-data'),
    mealMemo: ref('テストメモ'),
  }
}

describe('clearMealLogRefs', () => {
  it('すべてのrefをクリアする', () => {
    const refs = createTestRefs()

    clearMealLogRefs(refs)

    expect(refs.showMealLog.value).toBe(false)
    expect(refs.mealCalories.value).toBeUndefined()
    expect(refs.mealProtein.value).toBeUndefined()
    expect(refs.mealCarbs.value).toBeUndefined()
    expect(refs.mealFat.value).toBeUndefined()
    expect(refs.mealPhoto.value).toBeUndefined()
    expect(refs.mealMemo.value).toBe('')
  })

  it('すでにクリア済みの状態でも安全に呼べる', () => {
    const refs: MealLogRefs = {
      showMealLog: ref(false),
      mealCalories: ref<number | undefined>(undefined),
      mealProtein: ref<number | undefined>(undefined),
      mealCarbs: ref<number | undefined>(undefined),
      mealFat: ref<number | undefined>(undefined),
      mealPhoto: ref<string | undefined>(undefined),
      mealMemo: ref(''),
    }

    clearMealLogRefs(refs)

    expect(refs.showMealLog.value).toBe(false)
    expect(refs.mealMemo.value).toBe('')
  })
})
