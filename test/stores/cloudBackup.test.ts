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
  beforeEach(() => {
    setActivePinia(createPinia())
    resetIdCounter()
    vi.clearAllMocks()
  })

  describe('restore', () => {
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
  })
})
