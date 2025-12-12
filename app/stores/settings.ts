/**
 * Piniaストア: アプリ設定管理
 * ダークモード、背景画像などのユーザー設定を管理します。
 */
import { defineStore } from 'pinia'

export interface Settings {
  darkMode: boolean // ダークモードの有効/無効
  backgroundImage: string // 背景画像のパス（'none'の場合は背景画像なし）
  dateChangeLine: number // 日付変更線の時刻（0-23時）。この時刻より前は前日として扱う
}

export const useSettingsStore = defineStore('settings', {
  /**
   * ストアの状態
   */
  state: () => ({
    darkMode: false,
    backgroundImage: 'none' as string,
    dateChangeLine: 0, // デフォルトは0時（通常の日付変更）
  }),

  /**
   * アクション
   */
  actions: {
    /**
     * 設定をローカルストレージから読み込む
     */
    loadSettings() {
      if (typeof window === 'undefined') return

      const savedSettings = localStorage.getItem('tasket-settings')
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings) as Settings
          this.darkMode = settings.darkMode ?? false
          this.backgroundImage = settings.backgroundImage ?? 'none'
          this.dateChangeLine = settings.dateChangeLine ?? 0
        }
        catch (e) {
          console.error('設定の読み込みに失敗しました:', e)
        }
      }
    },

    /**
     * 設定をローカルストレージに保存
     */
    saveSettings() {
      if (typeof window === 'undefined') return

      const settings: Settings = {
        darkMode: this.darkMode,
        backgroundImage: this.backgroundImage,
        dateChangeLine: this.dateChangeLine,
      }
      localStorage.setItem('tasket-settings', JSON.stringify(settings))
    },

    /**
     * ダークモードの切り替え
     */
    toggleDarkMode() {
      this.darkMode = !this.darkMode
      this.saveSettings()
    },

    /**
     * 背景画像の設定
     * @param imagePath - 背景画像のパス（'none'の場合は背景画像なし）
     */
    setBackgroundImage(imagePath: string) {
      this.backgroundImage = imagePath
      this.saveSettings()
    },

    /**
     * 日付変更線の設定
     * @param hour - 日付変更線の時刻（0-23時）
     */
    setDateChangeLine(hour: number) {
      // 0-23の範囲内に制限
      this.dateChangeLine = Math.max(0, Math.min(23, hour))
      this.saveSettings()
    },
  },
})
