/**
 * items ストアのユニットテスト
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useItemsStore } from '~/stores/items'
import { createItem, createExpenseItem, createIncomeItem, createMealItem, resetIdCounter } from '../helpers/factories'

// uuid のモック
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-1'),
}))

// settings ストアのモック
vi.mock('~/stores/settings', () => ({
  useSettingsStore: vi.fn(() => ({
    dateChangeLine: 0,
  })),
}))

describe('useItemsStore', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    resetIdCounter()
    vi.clearAllMocks()
  })

  describe('初期状態', () => {
    it('初期状態が正しい', () => {
      const store = useItemsStore()
      expect(store.items).toEqual([])
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })
  })

  describe('getters', () => {
    describe('getItemsByDate', () => {
      it('指定日のアイテムを時刻順で返す', () => {
        const store = useItemsStore()
        store.items = [
          createItem({ scheduled_at: new Date('2025-12-15T14:00:00') }),
          createItem({ scheduled_at: new Date('2025-12-15T09:00:00') }),
          createItem({ scheduled_at: new Date('2025-12-16T10:00:00') }), // 別の日
        ]

        const result = store.getItemsByDate('2025-12-15')
        expect(result).toHaveLength(2)
        // 時刻順ソート確認
        expect(new Date(result[0]!.scheduled_at).getHours()).toBe(9)
        expect(new Date(result[1]!.scheduled_at).getHours()).toBe(14)
      })
    })

    describe('getItemsByMonth', () => {
      it('指定月のアイテムを返す', () => {
        const store = useItemsStore()
        store.items = [
          createItem({ scheduled_at: new Date('2025-12-01T10:00:00') }),
          createItem({ scheduled_at: new Date('2025-12-31T10:00:00') }),
          createItem({ scheduled_at: new Date('2025-11-30T10:00:00') }), // 前月
        ]

        const result = store.getItemsByMonth('2025-12')
        expect(result).toHaveLength(2)
      })
    })

    describe('getItemsByYear', () => {
      it('指定年のアイテムを返す', () => {
        const store = useItemsStore()
        store.items = [
          createItem({ scheduled_at: new Date('2025-01-01T10:00:00') }),
          createItem({ scheduled_at: new Date('2025-12-31T10:00:00') }),
          createItem({ scheduled_at: new Date('2024-12-31T10:00:00') }), // 前年
        ]

        const result = store.getItemsByYear('2025')
        expect(result).toHaveLength(2)
      })
    })

    describe('searchItems', () => {
      it('タイトルでキーワード検索する', () => {
        const store = useItemsStore()
        store.items = [
          createItem({ title: '昼食代' }),
          createItem({ title: '交通費' }),
          createItem({ title: '昼食のデザート' }),
        ]

        const result = store.searchItems('昼食')
        expect(result).toHaveLength(2)
      })

      it('備考でも検索する', () => {
        const store = useItemsStore()
        store.items = [
          createItem({ title: 'タスク', notes: '会議メモ' }),
          createItem({ title: '別のタスク', notes: '' }),
        ]

        const result = store.searchItems('メモ')
        expect(result).toHaveLength(1)
      })

      it('タイプフィルタで絞り込む', () => {
        const store = useItemsStore()
        store.items = [
          createExpenseItem({ title: '食費' }),
          createIncomeItem({ title: '食費返金' }),
        ]

        const result = store.searchItems('食費', 'expense')
        expect(result).toHaveLength(1)
        expect(result[0]!.type).toBe('expense')
      })
    })

    describe('getTotalCaloriesByDate', () => {
      it('指定日の摂取カロリー合計を計算する', () => {
        const store = useItemsStore()
        store.items = [
          createMealItem({ scheduled_at: new Date('2025-12-15T08:00:00') }, { calories: 400 }),
          createMealItem({ scheduled_at: new Date('2025-12-15T12:00:00') }, { calories: 600 }),
          createMealItem({ scheduled_at: new Date('2025-12-16T08:00:00') }, { calories: 300 }), // 別の日
        ]

        const result = store.getTotalCaloriesByDate('2025-12-15')
        expect(result).toBe(1000)
      })
    })

    describe('getMealItemsByDate', () => {
      it('指定日の食事ログ付きアイテムを返す', () => {
        const store = useItemsStore()
        store.items = [
          createMealItem({ scheduled_at: new Date('2025-12-15T12:00:00') }),
          createItem({ scheduled_at: new Date('2025-12-15T10:00:00') }), // 食事ログなし
        ]

        const result = store.getMealItemsByDate('2025-12-15')
        expect(result).toHaveLength(1)
        expect(result[0]!.mealLog).toBeDefined()
      })
    })
  })

  describe('actions', () => {
    describe('fetchItems', () => {
      it('DBからアイテムを取得してstateに設定する', async () => {
        const { getAllItems } = await import('~/utils/db')
        const mockItems = [createItem(), createExpenseItem()]
        vi.mocked(getAllItems).mockResolvedValue(mockItems)

        const store = useItemsStore()
        await store.fetchItems()

        expect(store.items).toEqual(mockItems)
        expect(store.isLoading).toBe(false)
        expect(store.error).toBeNull()
      })

      it('エラー時にerrorを設定する', async () => {
        const { getAllItems } = await import('~/utils/db')
        vi.mocked(getAllItems).mockRejectedValue(new Error('DB Error'))

        const store = useItemsStore()
        await store.fetchItems()

        expect(store.error).toBe('DB Error')
        expect(store.isLoading).toBe(false)
      })
    })

    describe('createItem', () => {
      it('新しいアイテムを作成してstateに追加する', async () => {
        const { addItem } = await import('~/utils/db')

        const store = useItemsStore()
        const newItem = await store.createItem({
          title: '新しいタスク',
          amount: 0,
          type: 'todo',
          scheduled_at: new Date('2025-12-15T10:00:00'),
        })

        expect(addItem).toHaveBeenCalledOnce()
        expect(newItem.title).toBe('新しいタスク')
        expect(newItem.id).toBe('mock-uuid-1')
        expect(store.items).toHaveLength(1)
      })
    })

    describe('updateItemById', () => {
      it('アイテムを更新する', async () => {
        const { updateItem } = await import('~/utils/db')

        const store = useItemsStore()
        const item = createItem({ id: 'item-1', title: '古いタイトル' })
        store.items = [item]

        const result = await store.updateItemById('item-1', { title: '新しいタイトル' })

        expect(updateItem).toHaveBeenCalledOnce()
        expect(result!.title).toBe('新しいタイトル')
        expect(store.items[0]!.title).toBe('新しいタイトル')
      })

      it('存在しないIDの場合nullを返す', async () => {
        const store = useItemsStore()
        store.items = [createItem({ id: 'item-1' })]

        const result = await store.updateItemById('non-existent', { title: '更新' })
        expect(result).toBeNull()
      })
    })

    describe('toggleComplete', () => {
      it('完了状態を切り替える', async () => {
        const store = useItemsStore()
        store.items = [createItem({ id: 'item-1', is_completed: false })]

        await store.toggleComplete('item-1')
        expect(store.items[0]!.is_completed).toBe(true)

        await store.toggleComplete('item-1')
        expect(store.items[0]!.is_completed).toBe(false)
      })
    })

    describe('toggleImportant', () => {
      it('重要フラグを切り替える', async () => {
        const store = useItemsStore()
        store.items = [createItem({ id: 'item-1', is_important: false })]

        await store.toggleImportant('item-1')
        expect(store.items[0]!.is_important).toBe(true)
      })
    })

    describe('deleteItemById', () => {
      it('アイテムを削除する', async () => {
        const { deleteItem } = await import('~/utils/db')

        const store = useItemsStore()
        store.items = [createItem({ id: 'item-1' }), createItem({ id: 'item-2' })]

        await store.deleteItemById('item-1')

        expect(deleteItem).toHaveBeenCalledWith('item-1')
        expect(store.items).toHaveLength(1)
        expect(store.items[0]!.id).toBe('item-2')
      })
    })
  })
})
