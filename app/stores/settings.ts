/**
 * Piniaストア: アプリ設定管理
 * ダークモード、背景画像などのユーザー設定を管理します。
 */
import { defineStore } from 'pinia'
import { getAppSettings, saveAppSettings } from '~/utils/db'

export interface CalendarDisplaySettings {
  showExpense: boolean // 支出合計の表示/非表示
  showIncome: boolean // 収入合計の表示/非表示
  showMainTask: boolean // その日のメインタスクの表示/非表示
  showTaskCount: boolean // タスクの合計数の表示/非表示
}

export interface Settings {
  darkMode: boolean // ダークモードの有効/無効
  backgroundImage: string | File // 背景画像（パス、Base64、またはFileオブジェクト）
  dateChangeLine: number // 日付変更線の時刻（0-23時）。この時刻より前は前日として扱う
  calendarDisplay: CalendarDisplaySettings // カレンダー表示設定
}

export const useSettingsStore = defineStore('settings', {
  /**
   * ストアの状態
   */
  state: () => ({
    darkMode: false,
    backgroundImage: 'none' as string | File,
    dateChangeLine: 0, // デフォルトは0時（通常の日付変更）
    calendarDisplay: {
      showExpense: true,
      showIncome: true,
      showMainTask: true,
      showTaskCount: true,
    } as CalendarDisplaySettings,
    backgroundImageUrl: null as string | null, // Fileオブジェクトから生成されたURL
  }),

  /**
   * ゲッター
   */
  getters: {
    /**
     * 背景画像のURLを取得（FileオブジェクトをObject URLに変換）
     */
    backgroundImageDisplay(): string {
      if (typeof this.backgroundImage === 'string') {
        return this.backgroundImage
      }
      else if (this.backgroundImage instanceof File) {
        return this.backgroundImageUrl || 'none'
      }
      return 'none'
    },
  },

  /**
   * アクション
   */
  actions: {
    /**
     * 設定をIndexedDBから読み込む
     */
    async loadSettings() {
      try {
        const settings = await getAppSettings()
        if (settings) {
          this.darkMode = settings.darkMode ?? false
          this.backgroundImage = settings.backgroundImage ?? 'none'
          this.dateChangeLine = settings.dateChangeLine ?? 0
          this.calendarDisplay = settings.calendarDisplay ?? {
            showExpense: true,
            showIncome: true,
            showMainTask: true,
            showTaskCount: true,
          }

          // Fileオブジェクトの場合はObject URLを生成
          if (this.backgroundImage instanceof File) {
            this.backgroundImageUrl = URL.createObjectURL(this.backgroundImage)
          }
        }
      }
      catch (e) {
        console.error('設定の読み込みに失敗しました:', e)
      }
    },

    /**
     * 設定をIndexedDBに保存
     */
    async saveSettings() {
      try {
        // 既存の設定を取得
        const existingSettings = await getAppSettings()

        // 表示設定のみ更新
        await saveAppSettings({
          ...(existingSettings || {
            id: 'app-settings',
            hasSeenTutorial: false,
            lockEnabled: false,
            pinHash: null,
            biometricEnabled: false,
            biometricCredentialId: null,
            maxAttempts: 5,
            lockTimeout: 0,
          }),
          darkMode: this.darkMode,
          backgroundImage: this.backgroundImage,
          dateChangeLine: this.dateChangeLine,
          calendarDisplay: this.calendarDisplay,
          updated_at: new Date(),
        })
      }
      catch (e) {
        console.error('設定の保存に失敗しました:', e)
      }
    },

    /**
     * ダークモードの切り替え
     */
    async toggleDarkMode() {
      this.darkMode = !this.darkMode
      await this.saveSettings()
    },

    /**
     * 背景画像の設定
     * @param imagePathOrFile - 背景画像（パス、Base64、またはFileオブジェクト）
     */
    async setBackgroundImage(imagePathOrFile: string | File) {
      // 古いObject URLがある場合は解放
      if (this.backgroundImageUrl && this.backgroundImage instanceof File) {
        URL.revokeObjectURL(this.backgroundImageUrl)
        this.backgroundImageUrl = null
      }

      this.backgroundImage = imagePathOrFile

      // Fileオブジェクトの場合はObject URLを生成
      if (imagePathOrFile instanceof File) {
        this.backgroundImageUrl = URL.createObjectURL(imagePathOrFile)
      }

      await this.saveSettings()
    },

    /**
     * 日付変更線の設定
     * @param hour - 日付変更線の時刻（0-23時）
     */
    async setDateChangeLine(hour: number) {
      // 0-23の範囲内に制限
      this.dateChangeLine = Math.max(0, Math.min(23, hour))
      await this.saveSettings()
    },

    /**
     * カレンダー表示設定の更新
     * @param settings - カレンダー表示設定
     */
    async updateCalendarDisplay(settings: Partial<CalendarDisplaySettings>) {
      try {
        this.calendarDisplay = { ...this.calendarDisplay, ...settings }
        await this.saveSettings()
      }
      catch (e) {
        console.error('カレンダー表示設定の保存に失敗しました:', e)
      }
    },
  },
})
