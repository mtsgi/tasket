/**
 * Piniaストア: クラウドバックアップ管理
 * クラウドストレージへのバックアップ・復元を管理します。
 */
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import type { CloudBackupConfig, BackupHistory, CloudProvider } from '~/types/cloudBackup'
import {
  getAllCloudBackupConfigs,
  getCloudBackupConfigById,
  saveCloudBackupConfig,
  deleteCloudBackupConfig,
  getAllBackupHistory,
  addBackupHistory,
  updateBackupHistory,
} from '~/utils/db'
import { encrypt } from '~/utils/encryption'
import { S3CompatibleAdapter } from '~/utils/cloudAdapters/S3CompatibleAdapter'
import { WebDAVAdapter } from '~/utils/cloudAdapters/WebDAVAdapter'
import type { BaseCloudAdapter } from '~/utils/cloudAdapters/BaseCloudAdapter'

// バックアップデータのバージョン（データベースバージョンと一致させる）
const BACKUP_DATA_VERSION = 7

export const useCloudBackupStore = defineStore('cloudBackup', {
  /**
   * ストアの状態
   */
  state: () => ({
    configs: [] as CloudBackupConfig[],
    histories: [] as BackupHistory[],
    isLoading: false,
    error: null as string | null,
  }),

  /**
   * ゲッター
   */
  getters: {
    /**
     * 有効な設定を取得
     */
    enabledConfigs(): CloudBackupConfig[] {
      return this.configs.filter(config => config.isEnabled)
    },

    /**
     * デフォルトの設定を取得（最初の有効な設定）
     */
    defaultConfig(): CloudBackupConfig | undefined {
      return this.enabledConfigs[0]
    },
  },

  /**
   * アクション
   */
  actions: {
    /**
     * すべての設定を読み込み
     */
    async fetchConfigs() {
      try {
        this.isLoading = true
        this.configs = await getAllCloudBackupConfigs()
      }
      catch (e) {
        this.error = e instanceof Error ? e.message : 'クラウドバックアップ設定の読み込みに失敗しました'
        console.error('クラウドバックアップ設定の読み込みに失敗しました:', e)
      }
      finally {
        this.isLoading = false
      }
    },

    /**
     * すべてのバックアップ履歴を読み込み
     */
    async fetchHistories() {
      try {
        this.isLoading = true
        this.histories = await getAllBackupHistory()
      }
      catch (e) {
        this.error = e instanceof Error ? e.message : 'バックアップ履歴の読み込みに失敗しました'
        console.error('バックアップ履歴の読み込みに失敗しました:', e)
      }
      finally {
        this.isLoading = false
      }
    },

    /**
     * 設定を作成
     */
    async createConfig(params: {
      provider: CloudProvider
      name: string
      endpoint?: string
      region?: string
      bucket?: string
      accessKeyId?: string
      secretAccessKey?: string
      isEnabled?: boolean
      autoBackup?: boolean
      autoBackupInterval?: number
    }): Promise<CloudBackupConfig> {
      try {
        this.isLoading = true

        // 認証情報を暗号化
        const accessKeyId = params.accessKeyId ? await encrypt(params.accessKeyId) : undefined
        const secretAccessKey = params.secretAccessKey ? await encrypt(params.secretAccessKey) : undefined

        const config: CloudBackupConfig = {
          id: uuidv4(),
          provider: params.provider,
          name: params.name,
          endpoint: params.endpoint,
          region: params.region,
          bucket: params.bucket,
          accessKeyId,
          secretAccessKey,
          isEnabled: params.isEnabled ?? true,
          autoBackup: params.autoBackup ?? false,
          autoBackupInterval: params.autoBackupInterval,
          created_at: new Date(),
          updated_at: new Date(),
        }

        await saveCloudBackupConfig(config)
        await this.fetchConfigs()

        return config
      }
      catch (e) {
        this.error = e instanceof Error ? e.message : 'クラウドバックアップ設定の作成に失敗しました'
        console.error('クラウドバックアップ設定の作成に失敗しました:', e)
        throw e
      }
      finally {
        this.isLoading = false
      }
    },

    /**
     * 設定を更新
     */
    async updateConfig(
      id: string,
      params: Partial<{
        name: string
        endpoint: string
        region: string
        bucket: string
        accessKeyId: string
        secretAccessKey: string
        isEnabled: boolean
        autoBackup: boolean
        autoBackupInterval: number
        last_backup_at: Date
      }>,
    ): Promise<void> {
      try {
        this.isLoading = true

        const existingConfig = await getCloudBackupConfigById(id)
        if (!existingConfig) {
          throw new Error('設定が見つかりません')
        }

        // 認証情報が更新される場合は暗号化
        const accessKeyId = params.accessKeyId
          ? await encrypt(params.accessKeyId)
          : existingConfig.accessKeyId
        const secretAccessKey = params.secretAccessKey
          ? await encrypt(params.secretAccessKey)
          : existingConfig.secretAccessKey

        const updatedConfig: CloudBackupConfig = {
          ...existingConfig,
          name: params.name ?? existingConfig.name,
          endpoint: params.endpoint ?? existingConfig.endpoint,
          region: params.region ?? existingConfig.region,
          bucket: params.bucket ?? existingConfig.bucket,
          accessKeyId,
          secretAccessKey,
          isEnabled: params.isEnabled ?? existingConfig.isEnabled,
          autoBackup: params.autoBackup ?? existingConfig.autoBackup,
          autoBackupInterval: params.autoBackupInterval ?? existingConfig.autoBackupInterval,
          last_backup_at: params.last_backup_at ?? existingConfig.last_backup_at,
          updated_at: new Date(),
        }

        await saveCloudBackupConfig(updatedConfig)
        await this.fetchConfigs()
      }
      catch (e) {
        this.error = e instanceof Error ? e.message : 'クラウドバックアップ設定の更新に失敗しました'
        console.error('クラウドバックアップ設定の更新に失敗しました:', e)
        throw e
      }
      finally {
        this.isLoading = false
      }
    },

    /**
     * 設定を削除
     */
    async deleteConfig(id: string): Promise<void> {
      try {
        this.isLoading = true
        await deleteCloudBackupConfig(id)
        await this.fetchConfigs()
      }
      catch (e) {
        this.error = e instanceof Error ? e.message : 'クラウドバックアップ設定の削除に失敗しました'
        console.error('クラウドバックアップ設定の削除に失敗しました:', e)
        throw e
      }
      finally {
        this.isLoading = false
      }
    },

    /**
     * クラウドアダプターを取得
     */
    getAdapter(config: CloudBackupConfig): BaseCloudAdapter {
      switch (config.provider) {
        case 's3-compatible':
          return new S3CompatibleAdapter(config)
        case 'webdav':
          return new WebDAVAdapter(config)
        default:
          throw new Error(`サポートされていないプロバイダー: ${config.provider}`)
      }
    },

    /**
     * 接続テスト
     */
    async testConnection(configId: string): Promise<boolean> {
      try {
        const config = await getCloudBackupConfigById(configId)
        if (!config) {
          throw new Error('設定が見つかりません')
        }

        const adapter = this.getAdapter(config)
        return await adapter.testConnection()
      }
      catch (e) {
        this.error = e instanceof Error ? e.message : '接続テストに失敗しました'
        console.error('接続テストに失敗しました:', e)
        return false
      }
    },

    /**
     * データをバックアップ
     */
    async backup(configId: string, type: 'manual' | 'auto' = 'manual'): Promise<BackupHistory> {
      try {
        this.isLoading = true

        const config = await getCloudBackupConfigById(configId)
        if (!config) {
          throw new Error('設定が見つかりません')
        }

        // バックアップ履歴を作成
        const history: BackupHistory = {
          id: uuidv4(),
          configId,
          status: 'in-progress',
          type,
          created_at: new Date(),
        }
        await addBackupHistory(history)
        await this.fetchHistories()

        try {
          // データをエクスポート形式で取得
          const itemsStore = useItemsStore()
          await itemsStore.fetchItems()

          const { getAllRoutines, getAllRoutineLogs, getAllDayTitles, getAllAppSettings, getAllHealthData } = await import('~/utils/db')
          const routines = await getAllRoutines()
          const routineLogs = await getAllRoutineLogs()
          const dayTitles = await getAllDayTitles()
          const appSettings = await getAllAppSettings()
          const healthData = await getAllHealthData()

          const backupData = {
            version: BACKUP_DATA_VERSION,
            exportedAt: new Date().toISOString(),
            items: itemsStore.items.map(item => ({
              ...item,
              scheduled_at: item.scheduled_at.toISOString(),
              executed_at: item.executed_at ? item.executed_at.toISOString() : null,
              created_at: item.created_at.toISOString(),
              mealLog: item.mealLog,
            })),
            routines: routines.map(routine => ({
              ...routine,
              created_at: routine.created_at.toISOString(),
            })),
            routineLogs: routineLogs.map(log => ({
              ...log,
              completed_at: log.completed_at ? log.completed_at.toISOString() : null,
            })),
            dayTitles: dayTitles.map(dt => ({
              ...dt,
              created_at: dt.created_at.toISOString(),
            })),
            appSettings: appSettings.map(settings => ({
              ...settings,
              updated_at: settings.updated_at.toISOString(),
            })),
            healthData: healthData.map(data => ({
              ...data,
              created_at: data.created_at.toISOString(),
              updated_at: data.updated_at.toISOString(),
            })),
          }

          // クラウドにアップロード
          const adapter = this.getAdapter(config)
          const filename = `tasket-backup-${new Date().toISOString().split('T')[0]}-${Date.now()}.json`
          const remotePath = await adapter.upload(backupData, filename)

          // バックアップサイズを計算
          const size = new Blob([JSON.stringify(backupData)]).size

          // 履歴を更新
          history.status = 'success'
          history.size = size
          history.itemCount = itemsStore.items.length
          history.remotePath = remotePath
          await updateBackupHistory(history)

          // 設定の最終バックアップ日時を更新
          await this.updateConfig(configId, {
            last_backup_at: new Date(),
          })

          await this.fetchHistories()
          return history
        }
        catch (error) {
          // エラー時は履歴を更新
          history.status = 'failed'
          history.error = error instanceof Error ? error.message : 'バックアップに失敗しました'
          await updateBackupHistory(history)
          await this.fetchHistories()
          throw error
        }
      }
      catch (e) {
        this.error = e instanceof Error ? e.message : 'バックアップに失敗しました'
        console.error('バックアップに失敗しました:', e)
        throw e
      }
      finally {
        this.isLoading = false
      }
    },

    /**
     * データを復元
     */
    async restore(configId: string, remotePath: string): Promise<void> {
      try {
        this.isLoading = true

        const config = await getCloudBackupConfigById(configId)
        if (!config) {
          throw new Error('設定が見つかりません')
        }

        // クラウドからダウンロード
        const adapter = this.getAdapter(config)
        const data = await adapter.download(remotePath)

        // データをインポート
        const itemsStore = useItemsStore()
        const routinesStore = useRoutinesStore()
        const dayTitlesStore = useDayTitlesStore()
        const settingsStore = useSettingsStore()
        const lockStore = useLockStore()
        const tutorialStore = useTutorialStore()

        // アイテムをインポート
        for (const itemData of data.items) {
          await itemsStore.createItem({
            title: itemData.title,
            amount: itemData.amount,
            type: itemData.type,
            scheduled_at: new Date(itemData.scheduled_at),
            notes: itemData.notes || '',
            mealLog: itemData.mealLog,
          })
        }

        // 日課をインポート
        if (data.routines) {
          for (const routineData of data.routines) {
            await routinesStore.createRoutine({
              title: routineData.title,
              yearMonth: routineData.yearMonth,
            })
          }
        }

        // 日課ログをインポート
        if (data.routineLogs) {
          const { saveRoutineLog } = await import('~/utils/db')
          for (const logData of data.routineLogs) {
            await saveRoutineLog({
              id: logData.id,
              routineId: logData.routineId,
              date: logData.date,
              status: logData.status || 'unconfirmed',
              completed_at: logData.completed_at ? new Date(logData.completed_at) : null,
            })
          }
        }

        // 日タイトルをインポート
        if (data.dayTitles) {
          for (const dayTitleData of data.dayTitles) {
            await dayTitlesStore.saveDayTitle(dayTitleData.date, dayTitleData.title)
          }
        }

        // アプリ設定をインポート
        if (data.appSettings && data.appSettings.length > 0) {
          const { saveAppSettings } = await import('~/utils/db')
          for (const settingsData of data.appSettings) {
            await saveAppSettings({
              ...settingsData,
              updated_at: new Date(settingsData.updated_at),
            })
          }
          await settingsStore.loadSettings()
          await lockStore.loadSettings()
          await tutorialStore.loadTutorialState()
        }

        // 健康データをインポート
        if (data.healthData) {
          const { saveHealthData } = await import('~/utils/db')
          for (const healthDataItem of data.healthData) {
            await saveHealthData({
              ...healthDataItem,
              created_at: new Date(healthDataItem.created_at),
              updated_at: new Date(healthDataItem.updated_at),
            })
          }
        }

        await itemsStore.fetchItems()
      }
      catch (e) {
        this.error = e instanceof Error ? e.message : 'データの復元に失敗しました'
        console.error('データの復元に失敗しました:', e)
        throw e
      }
      finally {
        this.isLoading = false
      }
    },

    /**
     * バックアップファイルのリストを取得
     */
    async listBackupFiles(configId: string): Promise<Array<{ path: string, size: number, lastModified: Date }>> {
      try {
        const config = await getCloudBackupConfigById(configId)
        if (!config) {
          throw new Error('設定が見つかりません')
        }

        const adapter = this.getAdapter(config)
        return await adapter.list()
      }
      catch (e) {
        this.error = e instanceof Error ? e.message : 'バックアップファイルのリスト取得に失敗しました'
        console.error('バックアップファイルのリスト取得に失敗しました:', e)
        throw e
      }
    },
  },
})
