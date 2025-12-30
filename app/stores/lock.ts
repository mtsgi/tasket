/**
 * Piniaストア: アプリロック管理
 * PINコード認証と生体認証によるアプリのロック機能を管理します。
 */
import { defineStore } from 'pinia'
import { getAppSettings, saveAppSettings } from '~/utils/db'

/**
 * PINコードをSHA-256でハッシュ化
 */
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export interface LockSettings {
  enabled: boolean // ロック機能の有効/無効
  pinHash: string | null // PINコードのハッシュ値
  biometricEnabled: boolean // 生体認証の有効/無効
  biometricCredentialId: string | null // 生体認証のクレデンシャルID（Base64エンコード）
  maxAttempts: number // 最大試行回数
  lockTimeout: number // ロック解除後の再ロックタイムアウト（ミリ秒、0の場合は無効）
}

export const useLockStore = defineStore('lock', {
  /**
   * ストアの状態
   */
  state: () => ({
    // ロック設定
    enabled: false,
    pinHash: null as string | null,
    biometricEnabled: false,
    biometricCredentialId: null as string | null,
    maxAttempts: 5,
    lockTimeout: 0, // デフォルトは即座にロック

    // 実行時状態
    isLocked: true, // ロック状態（初期状態はロック）
    failedAttempts: 0, // 認証失敗回数
    lastUnlockTime: null as number | null, // 最後にロック解除した時刻
  }),

  /**
   * ゲッター
   */
  getters: {
    /**
     * ロック機能が有効かつPINが設定されているか
     */
    isLockConfigured(): boolean {
      return this.enabled && this.pinHash !== null
    },

    /**
     * 認証試行が残っているか
     */
    canAttempt(): boolean {
      return this.failedAttempts < this.maxAttempts
    },

    /**
     * ロックが必要か（タイムアウトをチェック）
     */
    shouldBeLocked(): boolean {
      if (!this.isLockConfigured) return false
      if (this.isLocked) return true

      // タイムアウトが設定されている場合
      if (this.lockTimeout > 0 && this.lastUnlockTime !== null) {
        const elapsed = Date.now() - this.lastUnlockTime
        return elapsed >= this.lockTimeout
      }

      return false
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
          this.enabled = settings.lockEnabled ?? false
          this.pinHash = settings.pinHash ?? null
          this.biometricEnabled = settings.biometricEnabled ?? false
          this.biometricCredentialId = settings.biometricCredentialId ?? null
          this.maxAttempts = settings.maxAttempts ?? 5
          this.lockTimeout = settings.lockTimeout ?? 0

          // ロック機能が有効な場合は初期状態をロックにする
          this.isLocked = this.isLockConfigured
        }
      }
      catch (e) {
        console.error('ロック設定の読み込みに失敗しました:', e)
      }
    },

    /**
     * 設定をIndexedDBに保存
     */
    async saveSettings() {
      try {
        // 既存の設定を取得
        const existingSettings = await getAppSettings()
        
        // ロック設定のみ更新
        await saveAppSettings({
          ...(existingSettings || {
            id: 'app-settings',
            hasSeenTutorial: false,
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
          lockEnabled: this.enabled,
          pinHash: this.pinHash,
          biometricEnabled: this.biometricEnabled,
          biometricCredentialId: this.biometricCredentialId,
          maxAttempts: this.maxAttempts,
          lockTimeout: this.lockTimeout,
          updated_at: new Date(),
        })
      }
      catch (e) {
        console.error('ロック設定の保存に失敗しました:', e)
      }
    },

    /**
     * PINコードを設定
     * @param pin - 設定するPINコード
     */
    async setPin(pin: string): Promise<void> {
      if (!pin || pin.length < 4) {
        throw new Error('PINコードは4桁以上である必要があります')
      }

      this.pinHash = await hashPin(pin)
      await this.saveSettings()
    },

    /**
     * PINコードを検証
     * @param pin - 検証するPINコード
     * @returns 検証結果
     */
    async verifyPin(pin: string): Promise<boolean> {
      if (!this.pinHash) return false

      const inputHash = await hashPin(pin)
      const isValid = inputHash === this.pinHash

      if (isValid) {
        this.failedAttempts = 0
        this.unlock()
        return true
      }
      else {
        this.failedAttempts++
        return false
      }
    },

    /**
     * ロックを解除
     */
    unlock() {
      this.isLocked = false
      this.failedAttempts = 0
      this.lastUnlockTime = Date.now()
    },

    /**
     * ロックする
     */
    lock() {
      if (this.isLockConfigured) {
        this.isLocked = true
        this.failedAttempts = 0
      }
    },

    /**
     * ロック機能を有効化
     */
    async enableLock() {
      this.enabled = true
      await this.saveSettings()
      this.lock()
    },

    /**
     * ロック機能を無効化
     */
    async disableLock() {
      this.enabled = false
      this.isLocked = false
      await this.saveSettings()
    },

    /**
     * 生体認証の有効/無効を切り替え
     */
    async toggleBiometric(enabled: boolean) {
      this.biometricEnabled = enabled
      await this.saveSettings()
    },

    /**
     * 生体認証のクレデンシャルIDを保存
     */
    async setBiometricCredential(credentialId: string) {
      this.biometricCredentialId = credentialId
      await this.saveSettings()
    },

    /**
     * 生体認証の登録を解除
     */
    async clearBiometricCredential() {
      this.biometricCredentialId = null
      this.biometricEnabled = false
      await this.saveSettings()
    },

    /**
     * PINコードをリセット（ロック機能を無効化）
     */
    async resetPin() {
      this.pinHash = null
      this.enabled = false
      this.isLocked = false
      this.failedAttempts = 0
      await this.saveSettings()
    },

    /**
     * タイムアウトチェック（定期的に呼び出す）
     */
    checkTimeout() {
      if (this.shouldBeLocked && !this.isLocked) {
        this.lock()
      }
    },
  },
})
