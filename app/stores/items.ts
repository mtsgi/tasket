/**
 * Piniaストア: アイテム管理
 * TODO、収入、支出のCRUD操作とフィルタリングを提供します。
 */
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import type { Item, ItemType } from '~/types/item'
import { getAllItems, addItem, updateItem, deleteItem } from '~/utils/db'
import { getStartOfMonth, getEndOfMonth, getStartOfEffectiveDay, getEndOfEffectiveDay } from '~/utils/dateHelpers'
import { useSettingsStore } from '~/stores/settings'

export const useItemsStore = defineStore('items', {
  /**
   * ストアの状態
   */
  state: () => ({
    items: [] as Item[], // すべてのアイテム
    isLoading: false, // 読み込み中フラグ
    error: null as string | null, // エラーメッセージ
  }),

  /**
   * ゲッター（算出プロパティ）
   */
  getters: {
    /**
     * 特定の日のアイテムを取得
     * 日付変更線の設定を考慮する
     * @param dateString - 日付文字列（YYYY-MM-DD）
     * @returns その日のアイテムリスト（時刻順）
     */
    getItemsByDate: (state) => {
      return (dateString: string) => {
        const settingsStore = useSettingsStore()
        const dateChangeLine = settingsStore.dateChangeLine

        // 日付変更線を考慮した開始・終了時刻を取得
        const startOfDay = getStartOfEffectiveDay(dateString, dateChangeLine)
        const endOfDay = getEndOfEffectiveDay(dateString, dateChangeLine)

        return state.items
          .filter((item) => {
            const scheduledAt = new Date(item.scheduled_at)
            return scheduledAt >= startOfDay && scheduledAt <= endOfDay
          })
          .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      }
    },

    /**
     * 特定の月のアイテムを取得
     * @param yearMonth - 年月文字列（YYYY-MM）
     * @returns その月のアイテムリスト（時刻順）
     */
    getItemsByMonth: (state) => {
      return (yearMonth: string) => {
        const startOfMonth = getStartOfMonth(yearMonth + '-01')
        const endOfMonth = getEndOfMonth(yearMonth + '-01')
        return state.items
          .filter((item) => {
            const scheduledAt = new Date(item.scheduled_at)
            return scheduledAt >= startOfMonth && scheduledAt <= endOfMonth
          })
          .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      }
    },
  },

  /**
   * アクション（操作メソッド）
   */
  actions: {
    /**
     * データベースからすべてのアイテムを取得
     */
    async fetchItems() {
      this.isLoading = true
      this.error = null
      try {
        this.items = await getAllItems()
      }
      catch (e) {
        this.error = e instanceof Error ? e.message : 'アイテムの取得に失敗しました'
      }
      finally {
        this.isLoading = false
      }
    },

    /**
     * 新しいアイテムを作成
     * @param data - アイテムデータ（ID、作成日時は自動生成）
     * @returns 作成されたアイテム
     */
    async createItem(data: {
      title: string
      amount: number
      type: ItemType
      scheduled_at: Date
      notes?: string
    }) {
      const newItem: Item = {
        id: uuidv4(),
        title: data.title,
        amount: data.amount,
        type: data.type,
        is_completed: false,
        scheduled_at: data.scheduled_at,
        executed_at: null,
        created_at: new Date(),
        notes: data.notes || '',
      }
      await addItem(newItem)
      this.items.push(newItem)
      return newItem
    },

    /**
     * アイテムを更新
     * @param id - アイテムID
     * @param data - 更新するデータ
     * @returns 更新されたアイテム、または見つからない場合はnull
     */
    async updateItemById(id: string, data: Partial<Omit<Item, 'id' | 'created_at'>>) {
      const index = this.items.findIndex(item => item.id === id)
      if (index !== -1) {
        const updatedItem = { ...this.items[index], ...data }
        await updateItem(updatedItem)
        this.items[index] = updatedItem
        return updatedItem
      }
      return null
    },

    /**
     * アイテムの完了状態を切り替え
     * 注：完了状態の切り替えでは実行日時を更新しない（手動で設定する）
     * @param id - アイテムID
     */
    async toggleComplete(id: string) {
      const item = this.items.find(item => item.id === id)
      if (item) {
        const isCompleted = !item.is_completed
        await this.updateItemById(id, {
          is_completed: isCompleted,
        })
      }
    },

    /**
     * アイテムを削除
     * @param id - 削除するアイテムのID
     */
    async deleteItemById(id: string) {
      await deleteItem(id)
      const index = this.items.findIndex(item => item.id === id)
      if (index !== -1) {
        this.items.splice(index, 1)
      }
    },
  },
})
