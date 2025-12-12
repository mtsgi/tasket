/**
 * Piniaストア: プリセット管理
 * よく使うタスク設定をプリセットとして保存・管理します。
 */
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import type { Preset, ItemType } from '~/types/item'
import { getAllPresets, addPreset, updatePreset, deletePreset } from '~/utils/db'

export const usePresetsStore = defineStore('presets', {
  /**
   * ストアの状態
   */
  state: () => ({
    presets: [] as Preset[], // すべてのプリセット
    isLoading: false, // 読み込み中フラグ
    error: null as string | null, // エラーメッセージ
  }),

  /**
   * ゲッター（算出プロパティ）
   */
  getters: {
    /**
     * 種別でフィルタリングされたプリセットを取得
     * @param type - アイテム種別
     * @returns 指定された種別のプリセットリスト
     */
    getPresetsByType: (state) => {
      return (type: ItemType) => {
        return state.presets.filter(preset => preset.type === type)
      }
    },
  },

  /**
   * アクション（操作メソッド）
   */
  actions: {
    /**
     * データベースからすべてのプリセットを取得
     */
    async fetchPresets() {
      this.isLoading = true
      this.error = null
      try {
        this.presets = await getAllPresets()
      }
      catch (e) {
        this.error = e instanceof Error ? e.message : 'プリセットの取得に失敗しました'
      }
      finally {
        this.isLoading = false
      }
    },

    /**
     * 新しいプリセットを作成
     * @param data - プリセットデータ（ID、作成日時は自動生成）
     * @returns 作成されたプリセット
     */
    async createPreset(data: {
      title: string
      time: string
      type: ItemType
      amount?: number
      notes?: string
    }) {
      const newPreset: Preset = {
        id: uuidv4(),
        title: data.title,
        time: data.time,
        type: data.type,
        amount: data.amount || 0,
        notes: data.notes || '',
        created_at: new Date(),
      }
      await addPreset(newPreset)
      this.presets.unshift(newPreset) // 先頭に追加（新しい順）
      return newPreset
    },

    /**
     * プリセットを更新
     * @param id - プリセットID
     * @param data - 更新するデータ
     * @returns 更新されたプリセット、または見つからない場合はnull
     */
    async updatePresetById(id: string, data: Partial<Omit<Preset, 'id' | 'created_at'>>) {
      const index = this.presets.findIndex(preset => preset.id === id)
      if (index !== -1) {
        const updatedPreset = { ...this.presets[index], ...data }
        await updatePreset(updatedPreset)
        this.presets[index] = updatedPreset
        return updatedPreset
      }
      return null
    },

    /**
     * プリセットを削除
     * @param id - 削除するプリセットのID
     */
    async deletePresetById(id: string) {
      await deletePreset(id)
      const index = this.presets.findIndex(preset => preset.id === id)
      if (index !== -1) {
        this.presets.splice(index, 1)
      }
    },
  },
})
