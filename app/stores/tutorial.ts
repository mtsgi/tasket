/**
 * Piniaストア: チュートリアル管理
 * チュートリアルの表示状態と進行状況を管理します。
 */
import { defineStore } from 'pinia'
import { getAppSettings, saveAppSettings } from '~/utils/db'

export interface TutorialState {
  hasSeenTutorial: boolean // チュートリアルを見たことがあるか
  currentStep: number // 現在のステップ（0から開始）
  isActive: boolean // チュートリアルが現在アクティブか
}

export const useTutorialStore = defineStore('tutorial', {
  /**
   * ストアの状態
   */
  state: (): TutorialState => ({
    hasSeenTutorial: false,
    currentStep: 0,
    isActive: false,
  }),

  /**
   * アクション
   */
  actions: {
    /**
     * チュートリアル状態をIndexedDBから読み込む
     */
    async loadTutorialState() {
      try {
        const settings = await getAppSettings()
        if (settings) {
          this.hasSeenTutorial = settings.hasSeenTutorial ?? false
        }
      }
      catch (e) {
        console.error('チュートリアル状態の読み込みに失敗しました:', e)
      }
    },

    /**
     * チュートリアル状態をIndexedDBに保存
     */
    async saveTutorialState() {
      try {
        // 既存の設定を取得
        const existingSettings = await getAppSettings()

        // チュートリアル状態のみ更新（reactive proxyを plain objectに変換）
        const settingsToSave = {
          ...(existingSettings || {
            id: 'app-settings',
            lockEnabled: false,
            pinHash: null,
            biometricEnabled: false,
            biometricCredentialId: null,
            maxAttempts: 5,
            lockTimeout: 0,
            darkMode: false,
            backgroundImage: 'none',
            dateChangeLine: 0,
            calendarDisplay: {
              showExpense: true,
              showIncome: true,
              showMainTask: true,
              showTaskCount: true,
            },
          }),
          hasSeenTutorial: this.hasSeenTutorial,
          updated_at: new Date(),
        }

        // calendarDisplayがreactive proxyの場合は plain objectに変換
        if (settingsToSave.calendarDisplay && typeof settingsToSave.calendarDisplay === 'object') {
          settingsToSave.calendarDisplay = { ...settingsToSave.calendarDisplay }
        }

        await saveAppSettings(settingsToSave)
      }
      catch (e) {
        console.error('チュートリアル状態の保存に失敗しました:', e)
      }
    },

    /**
     * チュートリアルを開始
     */
    startTutorial() {
      this.isActive = true
      this.currentStep = 0
    },

    /**
     * チュートリアルを終了
     */
    async endTutorial() {
      this.isActive = false
      this.hasSeenTutorial = true
      this.currentStep = 0
      await this.saveTutorialState()
    },

    /**
     * 次のステップに進む
     */
    nextStep() {
      this.currentStep++
    },

    /**
     * 前のステップに戻る
     */
    previousStep() {
      if (this.currentStep > 0) {
        this.currentStep--
      }
    },

    /**
     * 特定のステップに移動
     */
    goToStep(step: number) {
      this.currentStep = step
    },

    /**
     * チュートリアルをスキップ
     */
    async skipTutorial() {
      await this.endTutorial()
    },

    /**
     * 初回起動かどうかを確認し、必要ならチュートリアルを開始
     */
    async checkFirstLaunch() {
      await this.loadTutorialState()
      if (!this.hasSeenTutorial) {
        // 少し遅延させてからチュートリアルを表示
        setTimeout(() => {
          this.startTutorial()
        }, 500)
      }
    },
  },
})
