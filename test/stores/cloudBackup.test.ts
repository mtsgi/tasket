/**
 * cloudBackup ストアのユニットテスト
 * 主にrestore機能でTodoアイテムの完了状態が正しく復元されることをテストする
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCloudBackupStore } from '~/stores/cloudBackup'
import type { CloudBackupConfig } from '~/types/cloudBackup'
import type { BaseCloudAdapter } from '~/utils/cloudAdapters/BaseCloudAdapter'
import { resetIdCounter } from '../helpers/factories'

// 依存ストアのモック
vi.mock('~/stores/items', () => ({
  useItemsStore: vi.fn(() => ({
    items: [],
    fetchItems: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('~/stores/dayTitles', () => ({
  useDayTitlesStore: vi.fn(() => ({
    saveDayTitle: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('~/stores/settings', () => ({
  useSettingsStore: vi.fn(() => ({
    loadSettings: vi.fn().mockResolvedValue(undefined),
    dateChangeLine: 0,
  })),
}))

vi.mock('~/stores/lock', () => ({
  useLockStore: vi.fn(() => ({
    loadSettings: vi.fn().mockResolvedValue(undefined),
    checkTimeout: vi.fn(),
    isLockConfigured: false,
    isLocked: false,
  })),
}))

vi.mock('~/stores/tutorial', () => ({
  useTutorialStore: vi.fn(() => ({
    loadTutorialState: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('~/stores/healthData', () => ({
  useHealthDataStore: vi.fn(() => ({
    fetchHealthData: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('~/stores/routines', () => ({
  useRoutinesStore: vi.fn(() => ({
    fetchAllRoutines: vi.fn().mockResolvedValue(undefined),
    fetchAllRoutineLogs: vi.fn().mockResolvedValue(undefined),
  })),
}))

/** テスト用のクラウドバックアップ設定を生成 */
function createMockConfig(overrides: Partial<CloudBackupConfig> = {}): CloudBackupConfig {
  return {
    id: 'config-1',
    provider: 's3-compatible',
    name: 'テスト設定',
    isEnabled: true,
    autoBackup: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }
}

/** テスト用のクラウドアダプターモックを生成 */
function createMockAdapter(downloadData: unknown): BaseCloudAdapter {
  return {
    download: vi.fn().mockResolvedValue(downloadData),
    upload: vi.fn(),
    testConnection: vi.fn(),
  } as unknown as BaseCloudAdapter
}

/** テスト用バックアップデータを生成 */
function createBackupData(itemOverrides: Record<string, unknown> = {}) {
  return {
    version: 7,
    exportedAt: '2025-12-15T10:00:00.000Z',
    items: [
      {
        id: 'item-1',
        title: '完了済みTodo',
        amount: 0,
        type: 'todo',
        is_completed: true,
        is_important: false,
        scheduled_at: '2025-12-15T10:00:00.000Z',
        executed_at: '2025-12-15T10:30:00.000Z',
        created_at: '2025-12-15T09:00:00.000Z',
        notes: '',
        ...itemOverrides,
      },
    ],
    routines: [],
    routineLogs: [],
  }
}

describe('useCloudBackupStore', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    resetIdCounter()
    vi.clearAllMocks()
    const { useSettingsStore } = await import('~/stores/settings')
    const { useLockStore } = await import('~/stores/lock')
    vi.mocked(useSettingsStore).mockReturnValue({
      loadSettings: vi.fn().mockResolvedValue(undefined),
      dateChangeLine: 0,
    } as unknown as ReturnType<typeof useSettingsStore>)
    vi.mocked(useLockStore).mockReturnValue({
      loadSettings: vi.fn().mockResolvedValue(undefined),
      checkTimeout: vi.fn(),
      isLockConfigured: false,
      isLocked: false,
    } as unknown as ReturnType<typeof useLockStore>)
  })

  describe('restore', () => {
    it('利用履歴の日時を復元し、ストリークを再読み込みする', async () => {
      const { getCloudBackupConfigById, saveDailyActivity, getAllDailyActivities } = await import('~/utils/db')
      vi.mocked(getCloudBackupConfigById).mockResolvedValue(createMockConfig())
      const activity = { date: '2026-10-06', firstOpenedAt: '2026-10-06T12:00:00Z', dateChangeLine: 4 }
      const store = useCloudBackupStore()
      vi.spyOn(store, 'getAdapter').mockReturnValue(createMockAdapter({
        ...createBackupData(), version: 9, dailyActivities: [activity],
      }))
      await store.restore('config-1', '/backup/test.json')
      expect(saveDailyActivity).toHaveBeenCalledWith({ ...activity, firstOpenedAt: new Date(activity.firstOpenedAt) })
      expect(getAllDailyActivities).toHaveBeenCalled()
    })

    it('不正な利用履歴は既存データを消す前に i18n 対応エラーで拒否する', async () => {
      const { getCloudBackupConfigById, clearUserData } = await import('~/utils/db')
      const { DailyActivityParseError, DAILY_ACTIVITY_PARSE_ERROR_KEY } = await import('~/utils/streak')
      vi.mocked(getCloudBackupConfigById).mockResolvedValue(createMockConfig())
      const store = useCloudBackupStore()
      vi.spyOn(store, 'getAdapter').mockReturnValue(createMockAdapter({
        ...createBackupData(), dailyActivities: [{ date: 'invalid' }],
      }))
      await expect(store.restore('config-1', '/backup/test.json')).rejects.toThrow(DailyActivityParseError)
      expect(store.error).toBe(DAILY_ACTIVITY_PARSE_ERROR_KEY)
      expect(clearUserData).not.toHaveBeenCalled()
    })

    it('旧バックアップの復元では利用履歴と通知をクリアし、健康記録も再読み込みする', async () => {
      const { getCloudBackupConfigById, getAllDailyActivities } = await import('~/utils/db')
      const { useStreakStore } = await import('~/stores/streak')
      const { useHealthDataStore } = await import('~/stores/healthData')
      const health = useHealthDataStore()
      vi.mocked(useHealthDataStore).mockReturnValue(health)
      vi.mocked(getCloudBackupConfigById).mockResolvedValue(createMockConfig())
      vi.mocked(getAllDailyActivities).mockResolvedValue([])
      const streak = useStreakStore()
      streak.dailyActivities = [{ date: '2026-10-06', firstOpenedAt: new Date(), dateChangeLine: 4 }]
      streak.showDailyModal = true
      const store = useCloudBackupStore()
      vi.spyOn(store, 'getAdapter').mockReturnValue(createMockAdapter(createBackupData()))
      await store.restore('config-1', '/backup/test.json')
      expect(streak.dailyActivities).toEqual([])
      expect(streak.showDailyModal).toBe(false)
      expect(health.fetchHealthData).toHaveBeenCalledWith({ force: true })
    })

    it('復元中は自動チェックインを抑止し、完了後に履歴を再取得してモーダルなしでチェックインを再判定する', async () => {
      const { getCloudBackupConfigById, clearUserData, recordDailyActivity, getAllDailyActivities } = await import('~/utils/db')
      const { useStreakStore } = await import('~/stores/streak')
      const { useSettingsStore } = await import('~/stores/settings')
      const { useLockStore } = await import('~/stores/lock')

      vi.mocked(getCloudBackupConfigById).mockResolvedValue(createMockConfig())
      vi.mocked(recordDailyActivity).mockResolvedValue(true)
      vi.mocked(getAllDailyActivities).mockResolvedValue([])

      const streak = useStreakStore()
      const settingsState = {
        dateChangeLine: 0,
        loadSettings: vi.fn(async () => {
          settingsState.dateChangeLine = 4
          // 設定読み込み時の watcher 発火を模倣（復元中なので抑止されるべき）
          expect(await streak.checkIn()).toBe(false)
        }),
      }
      vi.mocked(useSettingsStore).mockReturnValue(settingsState as unknown as ReturnType<typeof useSettingsStore>)
      vi.mocked(useLockStore).mockReturnValue({
        loadSettings: vi.fn().mockResolvedValue(undefined),
        checkTimeout: vi.fn(),
        isLockConfigured: false,
        isLocked: false,
      } as unknown as ReturnType<typeof useLockStore>)

      let checkInDuringClear = true
      vi.mocked(clearUserData).mockImplementationOnce(async () => {
        checkInDuringClear = await streak.checkIn()
      })

      const store = useCloudBackupStore()
      vi.spyOn(store, 'getAdapter').mockReturnValue(createMockAdapter({
        ...createBackupData(),
        appSettings: [{ id: 'app-settings', dateChangeLine: 4, updated_at: '2026-10-06T00:00:00.000Z' }],
      }))

      await store.restore('config-1', '/backup/test.json')

      expect(checkInDuringClear).toBe(false)
      expect(recordDailyActivity).toHaveBeenCalledTimes(1)
      expect(recordDailyActivity).toHaveBeenCalledWith(expect.objectContaining({ dateChangeLine: 4 }))
      expect(streak.showDailyModal).toBe(false)
      expect(streak.isAutoCheckInSuspended).toBe(false)
    })

    it('復元後のロック設定が有効な場合は自動チェックインを再実行しない', async () => {
      const { getCloudBackupConfigById, recordDailyActivity } = await import('~/utils/db')
      const { useLockStore } = await import('~/stores/lock')

      vi.mocked(getCloudBackupConfigById).mockResolvedValue(createMockConfig())
      vi.mocked(useLockStore).mockReturnValue({
        loadSettings: vi.fn().mockResolvedValue(undefined),
        checkTimeout: vi.fn(),
        isLockConfigured: true,
        isLocked: true,
      } as unknown as ReturnType<typeof useLockStore>)

      const store = useCloudBackupStore()
      vi.spyOn(store, 'getAdapter').mockReturnValue(createMockAdapter(createBackupData()))
      await store.restore('config-1', '/backup/test.json')

      expect(recordDailyActivity).not.toHaveBeenCalled()
    })

    it('完了済みTodoアイテムの完了状態を正しく復元する', async () => {
      const { getCloudBackupConfigById, addItem } = await import('~/utils/db')
      vi.mocked(getCloudBackupConfigById).mockResolvedValue(createMockConfig())

      const store = useCloudBackupStore()
      vi.spyOn(store, 'getAdapter').mockReturnValue(
        createMockAdapter(createBackupData()),
      )

      await store.restore('config-1', '/backup/test.json')

      // addItem が呼ばれたことを確認
      expect(vi.mocked(addItem)).toHaveBeenCalledTimes(1)

      // addItem に渡された引数で is_completed が true であることを確認
      const calledWith = vi.mocked(addItem).mock.calls[0]![0]
      expect(calledWith.is_completed).toBe(true)
      expect(calledWith.id).toBe('item-1')
      expect(calledWith.title).toBe('完了済みTodo')
    })

    it('未完了のTodoアイテムの完了状態を正しく復元する', async () => {
      const { getCloudBackupConfigById, addItem } = await import('~/utils/db')
      vi.mocked(getCloudBackupConfigById).mockResolvedValue(createMockConfig())

      const store = useCloudBackupStore()
      vi.spyOn(store, 'getAdapter').mockReturnValue(
        createMockAdapter(createBackupData({ is_completed: false, executed_at: null })),
      )

      await store.restore('config-1', '/backup/test.json')

      const calledWith = vi.mocked(addItem).mock.calls[0]![0]
      expect(calledWith.is_completed).toBe(false)
      expect(calledWith.executed_at).toBeNull()
    })

    it('is_completedフィールドが欠落している場合はfalseをデフォルト値として使用する（後方互換性）', async () => {
      const { getCloudBackupConfigById, addItem } = await import('~/utils/db')
      vi.mocked(getCloudBackupConfigById).mockResolvedValue(createMockConfig())

      const store = useCloudBackupStore()

      // is_completed と is_important が存在しない旧形式のデータ
      const oldFormatData = {
        version: 1,
        exportedAt: '2025-12-15T10:00:00.000Z',
        items: [
          {
            id: 'item-old',
            title: '旧形式アイテム',
            amount: 0,
            type: 'todo',
            // is_completed、is_important フィールドなし
            scheduled_at: '2025-12-15T10:00:00.000Z',
            executed_at: null,
            created_at: '2025-12-15T09:00:00.000Z',
            notes: '',
          },
        ],
      }

      vi.spyOn(store, 'getAdapter').mockReturnValue(createMockAdapter(oldFormatData))

      await store.restore('config-1', '/backup/test.json')

      const calledWith = vi.mocked(addItem).mock.calls[0]![0]
      // 欠落フィールドはデフォルト値 false が使用されること
      expect(calledWith.is_completed).toBe(false)
      expect(calledWith.is_important).toBe(false)
    })

    it('executed_atが正しくDate型に変換されること', async () => {
      const { getCloudBackupConfigById, addItem } = await import('~/utils/db')
      vi.mocked(getCloudBackupConfigById).mockResolvedValue(createMockConfig())

      const executedAtStr = '2025-12-15T10:30:00.000Z'
      const store = useCloudBackupStore()
      vi.spyOn(store, 'getAdapter').mockReturnValue(
        createMockAdapter(createBackupData({ executed_at: executedAtStr })),
      )

      await store.restore('config-1', '/backup/test.json')

      const calledWith = vi.mocked(addItem).mock.calls[0]![0]
      expect(calledWith.executed_at).toBeInstanceOf(Date)
      expect(calledWith.executed_at).toEqual(new Date(executedAtStr))
    })

    it('IDが保持されて復元されること', async () => {
      const { getCloudBackupConfigById, addItem } = await import('~/utils/db')
      vi.mocked(getCloudBackupConfigById).mockResolvedValue(createMockConfig())

      const store = useCloudBackupStore()
      vi.spyOn(store, 'getAdapter').mockReturnValue(
        createMockAdapter(createBackupData()),
      )

      await store.restore('config-1', '/backup/test.json')

      const calledWith = vi.mocked(addItem).mock.calls[0]![0]
      // 元のIDが保持されていること（新規生成ではない）
      expect(calledWith.id).toBe('item-1')
    })

    it('復元前に既存データがクリアされること', async () => {
      const { getCloudBackupConfigById, clearUserData, addItem } = await import('~/utils/db')
      vi.mocked(getCloudBackupConfigById).mockResolvedValue(createMockConfig())

      const store = useCloudBackupStore()
      vi.spyOn(store, 'getAdapter').mockReturnValue(
        createMockAdapter(createBackupData()),
      )

      await store.restore('config-1', '/backup/test.json')

      // clearUserData が addItem より先に呼ばれること
      expect(vi.mocked(clearUserData)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(addItem)).toHaveBeenCalledTimes(1)
      const clearOrder = vi.mocked(clearUserData).mock.invocationCallOrder[0]
      const addOrder = vi.mocked(addItem).mock.invocationCallOrder[0]
      expect(clearOrder).toBeDefined()
      expect(addOrder).toBeDefined()
      expect(clearOrder!).toBeLessThan(addOrder!)
    })

    it('既存データがある状態でも復元が成功すること', async () => {
      const { getCloudBackupConfigById, clearUserData, addItem } = await import('~/utils/db')
      vi.mocked(getCloudBackupConfigById).mockResolvedValue(createMockConfig())
      // clearUserData は成功する（既存データを削除）
      vi.mocked(clearUserData).mockResolvedValue(undefined)
      // addItem も成功する（クリア後なので競合なし）
      vi.mocked(addItem).mockResolvedValue(undefined)

      const store = useCloudBackupStore()
      vi.spyOn(store, 'getAdapter').mockReturnValue(
        createMockAdapter(createBackupData()),
      )

      // 既存データがあっても例外が発生しないこと
      await expect(store.restore('config-1', '/backup/test.json')).resolves.toBeUndefined()
      expect(vi.mocked(clearUserData)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(addItem)).toHaveBeenCalledTimes(1)
    })

    it('routinesStoreのfetchAllRoutinesが復元後に呼ばれること', async () => {
      const { getCloudBackupConfigById } = await import('~/utils/db')
      vi.mocked(getCloudBackupConfigById).mockResolvedValue(createMockConfig())

      const { useRoutinesStore } = await import('~/stores/routines')
      const mockFetchAllRoutines = vi.fn().mockResolvedValue(undefined)
      vi.mocked(useRoutinesStore).mockReturnValue({
        fetchAllRoutines: mockFetchAllRoutines,
        fetchAllRoutineLogs: vi.fn().mockResolvedValue(undefined),
      } as unknown as ReturnType<typeof useRoutinesStore>)

      const store = useCloudBackupStore()
      vi.spyOn(store, 'getAdapter').mockReturnValue(
        createMockAdapter(createBackupData()),
      )

      await store.restore('config-1', '/backup/test.json')

      expect(mockFetchAllRoutines).toHaveBeenCalledTimes(1)
    })
  })

  it('クラウドバックアップに利用履歴をISO日時で含める', async () => {
    const { getCloudBackupConfigById, getAllDailyActivities } = await import('~/utils/db')
    vi.mocked(getCloudBackupConfigById).mockResolvedValue(createMockConfig())
    vi.mocked(getAllDailyActivities).mockResolvedValue([{
      date: '2026-10-06', firstOpenedAt: new Date('2026-10-06T12:00:00Z'), dateChangeLine: 4,
    }])
    const store = useCloudBackupStore()
    const adapter = createMockAdapter(createBackupData())
    vi.mocked(adapter.upload).mockResolvedValue('/backup/test.json')
    vi.spyOn(store, 'getAdapter').mockReturnValue(adapter)
    await store.backup('config-1')
    expect(adapter.upload).toHaveBeenCalledWith(expect.objectContaining({
      version: 9,
      dailyActivities: [{ date: '2026-10-06', firstOpenedAt: '2026-10-06T12:00:00.000Z', dateChangeLine: 4 }],
    }), expect.any(String))
  })
})
