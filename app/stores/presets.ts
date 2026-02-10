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

    /**
     * 種別でフィルタリングし、時刻順にソートされたプリセットを取得
     * 日付変更線を考慮してソート（日付変更線以降の時刻から順に並べる）
     * @param type - アイテム種別
     * @param dateChangeLine - 日付変更線の時刻（0-23時）
     * @returns 指定された種別のプリセットリスト（時刻順）
     */
    getPresetsByTypesSorted: (state) => {
      return (type: ItemType, dateChangeLine: number) => {
        const filtered = state.presets.filter(preset => preset.type === type)

        // 時刻順にソート（日付変更線を考慮）
        return filtered.sort((a, b) => {
          // 時刻文字列（HH:mm）を時間数値に変換
          const [aHour, aMinute] = a.time.split(':').map(Number)
          const [bHour, bMinute] = b.time.split(':').map(Number)

          // 日付変更線からの相対位置を計算
          // 日付変更線より前の時刻は、24時間を加算して後ろに配置
          const getRelativeMinutes = (hour: number, minute: number) => {
            if (hour < dateChangeLine) {
              // 日付変更線より前の時刻は翌日扱い
              return (hour + 24) * 60 + minute
            }
            return hour * 60 + minute
          }

          const aRelative = getRelativeMinutes(aHour, aMinute)
          const bRelative = getRelativeMinutes(bHour, bMinute)

          return aRelative - bRelative
        })
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
        const updatedPreset = { ...this.presets[index], ...data } as Preset
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
