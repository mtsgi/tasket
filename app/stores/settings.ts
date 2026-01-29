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

export interface HealthGraphSettings {
  spanGaps: boolean // データの欠けた日を補完する（線をつなげる）
  chartHeight: 'small' | 'medium' | 'large' // グラフの高さ
  showGridLines: boolean // グリッド線の表示/非表示
  lineTension: 'straight' | 'smooth' // 折れ線の形状（直線/なめらか）
  pointRadius: 'small' | 'medium' | 'large' // データポイントのサイズ
  fillArea: boolean // グラフエリアの塗りつぶし
}

export interface Settings {
  darkMode: boolean // ダークモードの有効/無効
  backgroundImage: string | File // 背景画像（パス、Base64、またはFileオブジェクト）
  dateChangeLine: number // 日付変更線の時刻（0-23時）。この時刻より前は前日として扱う
  calendarDisplay: CalendarDisplaySettings // カレンダー表示設定
  healthGraphSettings: HealthGraphSettings // 健康グラフ表示設定
  height?: number // 身長（cm）- BMI計算に使用
}

export const useSettingsStore = defineStore('settings', {
  /**
   * ストアの状態
   */
  state: () => ({
    darkMode: false,
    backgroundImage: 'none' as string | File,
    dateChangeLine: 0, // デフォルトは0時（通常の日付変更）
    language: 'ja' as 'ja' | 'en', // デフォルトは日本語
    calendarDisplay: {
      showExpense: true,
      showIncome: true,
      showMainTask: true,
      showTaskCount: true,
    } as CalendarDisplaySettings,
    healthGraphSettings: {
      spanGaps: false, // デフォルトは補完しない
      chartHeight: 'medium', // デフォルトは中サイズ
      showGridLines: true, // デフォルトはグリッド線表示
      lineTension: 'smooth', // デフォルトはなめらかな線
      pointRadius: 'medium', // デフォルトは中サイズのポイント
      fillArea: false, // デフォルトは塗りつぶしなし
    } as HealthGraphSettings,
    height: undefined as number | undefined, // 身長（cm）- BMI計算に使用
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
          this.language = settings.language ?? 'ja'
          this.calendarDisplay = settings.calendarDisplay ?? {
            showExpense: true,
            showIncome: true,
            showMainTask: true,
            showTaskCount: true,
          }
          // デフォルト値と既存設定をマージ
          const defaultHealthGraphSettings = {
            spanGaps: false,
            chartHeight: 'medium' as const,
            showGridLines: true,
            lineTension: 'smooth' as const,
            pointRadius: 'medium' as const,
            fillArea: false,
          }
          this.healthGraphSettings = {
            ...defaultHealthGraphSettings,
            ...settings.healthGraphSettings,
          }
          this.height = settings.height

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

        // 表示設定のみ更新（reactive proxyを plain objectに変換）
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
          language: this.language,
          calendarDisplay: { ...this.calendarDisplay }, // reactive proxyをplain objectに変換
          healthGraphSettings: { ...this.healthGraphSettings }, // reactive proxyをplain objectに変換
          height: this.height,
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

    /**
     * 言語設定の更新
     * @param lang - 言語コード（'ja' | 'en'）
     */
    async setLanguage(lang: 'ja' | 'en') {
      this.language = lang
      await this.saveSettings()
    },

    /**
     * 健康グラフ表示設定の更新
     * @param settings - 健康グラフ表示設定
     */
    async updateHealthGraphSettings(settings: Partial<HealthGraphSettings>) {
      try {
        this.healthGraphSettings = { ...this.healthGraphSettings, ...settings }
        await this.saveSettings()
      }
      catch (e) {
        console.error('健康グラフ表示設定の保存に失敗しました:', e)
      }
    },

    /**
     * 身長の設定
     * @param height - 身長（cm）
     */
    async setHeight(height: number | undefined) {
      this.height = height
      await this.saveSettings()
    },
  },
})
