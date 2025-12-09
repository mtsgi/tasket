/**
 * Piniaストア: アプリ設定管理
 * ダークモード、背景画像などのユーザー設定を管理します。
 */
import { defineStore } from 'pinia'

export interface Settings {
  darkMode: boolean // ダークモードの有効/無効
  backgroundImage: string // 背景画像のパス（'none'の場合は背景画像なし）
}

export const useSettingsStore = defineStore('settings', {
  /**
   * ストアの状態
   */
  state: () => ({
    darkMode: false,
    backgroundImage: 'none' as string,
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
  },
})
