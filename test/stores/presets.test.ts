/**
 * presets ストアのユニットテスト
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePresetsStore } from '~/stores/presets'
import { createPreset, resetIdCounter } from '../helpers/factories'

// uuid のモック
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-preset-uuid'),
}))

describe('usePresetsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetIdCounter()
    vi.clearAllMocks()
  })

  describe('初期状態', () => {
    it('初期状態が正しい', () => {
      const store = usePresetsStore()
      expect(store.presets).toEqual([])
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })
  })

  describe('getters', () => {
    describe('getPresetsByType', () => {
      it('指定タイプのプリセットのみ返す', () => {
        const store = usePresetsStore()
        store.presets = [
          createPreset({ type: 'todo' }),
          createPreset({ type: 'expense' }),
          createPreset({ type: 'todo' }),
          createPreset({ type: 'income' }),
        ]

        expect(store.getPresetsByType('todo')).toHaveLength(2)
        expect(store.getPresetsByType('expense')).toHaveLength(1)
        expect(store.getPresetsByType('income')).toHaveLength(1)
      })
    })

    describe('getPresetsByTypeSorted', () => {
      it('日付変更線0時で時刻順にソートする', () => {
        const store = usePresetsStore()
        store.presets = [
          createPreset({ type: 'todo', time: '14:00' }),
          createPreset({ type: 'todo', time: '09:00' }),
          createPreset({ type: 'todo', time: '22:00' }),
        ]

        const result = store.getPresetsByTypeSorted('todo', 0)
        expect(result[0]!.time).toBe('09:00')
        expect(result[1]!.time).toBe('14:00')
        expect(result[2]!.time).toBe('22:00')
      })

      it('日付変更線4時で、0-3時台は後ろに配置する', () => {
        const store = usePresetsStore()
        store.presets = [
          createPreset({ type: 'todo', time: '02:00' }),
          createPreset({ type: 'todo', time: '10:00' }),
          createPreset({ type: 'todo', time: '04:00' }),
        ]

        const result = store.getPresetsByTypeSorted('todo', 4)
        // 4:00 → 10:00 → 2:00 (翌日扱い)
        expect(result[0]!.time).toBe('04:00')
        expect(result[1]!.time).toBe('10:00')
        expect(result[2]!.time).toBe('02:00')
      })
    })
  })

  describe('actions', () => {
    describe('fetchPresets', () => {
      it('DBからプリセットを取得する', async () => {
        const { getAllPresets } = await import('~/utils/db')
        const mockPresets = [createPreset()]
        vi.mocked(getAllPresets).mockResolvedValue(mockPresets)

        const store = usePresetsStore()
        await store.fetchPresets()

        expect(store.presets).toEqual(mockPresets)
      })
    })

    describe('createPreset', () => {
      it('新しいプリセットを作成する', async () => {
        const { addPreset } = await import('~/utils/db')

        const store = usePresetsStore()
        const result = await store.createPreset({
          title: '昼食代',
          time: '12:00',
          type: 'expense',
          amount: 1000,
        })

        expect(addPreset).toHaveBeenCalledOnce()
        expect(result.title).toBe('昼食代')
        expect(result.type).toBe('expense')
        expect(result.amount).toBe(1000)
        // unshift で先頭に追加される
        expect(store.presets[0]!.title).toBe('昼食代')
      })
    })

    describe('updatePresetById', () => {
      it('プリセットを更新する', async () => {
        const { updatePreset } = await import('~/utils/db')

        const store = usePresetsStore()
        store.presets = [createPreset({ id: 'p1', title: '古い名前' })]

        const result = await store.updatePresetById('p1', { title: '新しい名前' })

        expect(updatePreset).toHaveBeenCalledOnce()
        expect(result!.title).toBe('新しい名前')
      })

      it('存在しないIDの場合nullを返す', async () => {
        const store = usePresetsStore()
        const result = await store.updatePresetById('non-existent', { title: '更新' })
        expect(result).toBeNull()
      })
    })

    describe('deletePresetById', () => {
      it('プリセットを削除する', async () => {
        const { deletePreset } = await import('~/utils/db')

        const store = usePresetsStore()
        store.presets = [createPreset({ id: 'p1' }), createPreset({ id: 'p2' })]

        await store.deletePresetById('p1')

        expect(deletePreset).toHaveBeenCalledWith('p1')
        expect(store.presets).toHaveLength(1)
        expect(store.presets[0]!.id).toBe('p2')
      })
    })
  })
})
