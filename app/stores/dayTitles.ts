/**
 * Piniaストア: 日タイトル管理
 * 各日の「今日やること」タイトルの管理を提供します。
 */
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import type { DayTitle } from '~/types/item'
import { getDayTitleByDate, saveDayTitle, deleteDayTitle } from '~/utils/db'

export const useDayTitlesStore = defineStore('dayTitles', {
  /**
   * ストアの状態
   */
  state: () => ({
    dayTitles: {} as Record<string, DayTitle>, // 日付をキーとした日タイトルマップ
    isLoading: false, // 読み込み中フラグ
    error: null as string | null, // エラーメッセージ
  }),

  /**
   * ゲッター（算出プロパティ）
   */
  getters: {
    /**
     * 特定の日のタイトルを取得
     * @param date - 日付文字列（YYYY-MM-DD）
     * @returns その日のタイトル、またはundefined
     */
    getDayTitle: (state) => {
      return (date: string): DayTitle | undefined => {
        return state.dayTitles[date]
      }
    },
  },

  /**
   * アクション（操作メソッド）
   */
  actions: {
    /**
     * 特定の日のタイトルをデータベースから取得
     * @param date - 日付文字列（YYYY-MM-DD）
     */
    async fetchDayTitle(date: string) {
      this.isLoading = true
      this.error = null
      try {
        const dayTitle = await getDayTitleByDate(date)
        if (dayTitle) {
          this.dayTitles[date] = dayTitle
        }
        else {
          // 存在しない場合はキャッシュから削除
          delete this.dayTitles[date]
        }
      }
      catch (e) {
        this.error = e instanceof Error ? e.message : '日タイトルの取得に失敗しました'
      }
      finally {
        this.isLoading = false
      }
    },

    /**
     * 日タイトルを保存（新規作成または更新）
     * @param date - 日付文字列（YYYY-MM-DD）
     * @param title - タイトル
     */
    async saveDayTitle(date: string, title: string) {
      const existingTitle = this.dayTitles[date]

      const dayTitle: DayTitle = existingTitle
        ? { ...existingTitle, title }
        : {
            id: uuidv4(),
            date,
            title,
            created_at: new Date(),
          }

      await saveDayTitle(dayTitle)
      this.dayTitles[date] = dayTitle
    },

    /**
     * 日タイトルを削除
     * @param date - 日付文字列（YYYY-MM-DD）
     */
    async removeDayTitle(date: string) {
      const existingTitle = this.dayTitles[date]
      if (existingTitle) {
        await deleteDayTitle(existingTitle.id)
        delete this.dayTitles[date]
      }
    },
  },
})
