/**
 * 食事ログ管理用のユーティリティ関数
 * 食事ログデータの操作を提供
 */
import type { Ref } from 'vue'

/**
 * 食事ログの状態を管理するための型定義
 */
export interface MealLogRefs {
  showMealLog: Ref<boolean>
  mealCalories: Ref<number | undefined>
  mealProtein: Ref<number | undefined>
  mealCarbs: Ref<number | undefined>
  mealFat: Ref<number | undefined>
  mealPhoto: Ref<string | undefined>
  mealMemo: Ref<string>
}

/**
 * 食事ログを削除
 * すべての食事ログデータをクリアし、セクションを閉じる
 * @param refs - 食事ログの状態を管理するrefオブジェクト群
 */
export function clearMealLogRefs(refs: MealLogRefs): void {
  refs.mealCalories.value = undefined
  refs.mealProtein.value = undefined
  refs.mealCarbs.value = undefined
  refs.mealFat.value = undefined
  refs.mealPhoto.value = undefined
  refs.mealMemo.value = ''
  refs.showMealLog.value = false
}
