/**
 * dayTitles ストアのユニットテスト
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDayTitlesStore } from '~/stores/dayTitles'
import { createDayTitle, resetIdCounter } from '../helpers/factories'

// uuid のモック
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-daytitle-uuid'),
}))

describe('useDayTitlesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetIdCounter()
    vi.clearAllMocks()
  })

  describe('初期状態', () => {
    it('初期状態が正しい', () => {
      const store = useDayTitlesStore()
      expect(store.dayTitles).toEqual({})
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })
  })

  describe('getters', () => {
    describe('getDayTitle', () => {
      it('指定日のタイトルを返す', () => {
        const store = useDayTitlesStore()
        const dayTitle = createDayTitle({ date: '2025-12-15', title: '今日のタスク' })
        store.dayTitles = { '2025-12-15': dayTitle }

        const result = store.getDayTitle('2025-12-15')
        expect(result).toBeDefined()
        expect(result!.title).toBe('今日のタスク')
      })

      it('存在しない日はundefinedを返す', () => {
        const store = useDayTitlesStore()
        expect(store.getDayTitle('2025-12-20')).toBeUndefined()
      })
    })
  })

  describe('actions', () => {
    describe('fetchDayTitle', () => {
      it('DBから日タイトルを取得してstateに設定する', async () => {
        const { getDayTitleByDate } = await import('~/utils/db')
        const mockTitle = createDayTitle({ date: '2025-12-15', title: 'テスト' })
        vi.mocked(getDayTitleByDate).mockResolvedValue(mockTitle)

        const store = useDayTitlesStore()
        await store.fetchDayTitle('2025-12-15')

        expect(store.dayTitles['2025-12-15']).toBeDefined()
        expect(store.dayTitles['2025-12-15']!.title).toBe('テスト')
      })

      it('タイトルが存在しない場合はキャッシュから削除する', async () => {
        const { getDayTitleByDate } = await import('~/utils/db')
        vi.mocked(getDayTitleByDate).mockResolvedValue(undefined)

        const store = useDayTitlesStore()
        store.dayTitles = { '2025-12-15': createDayTitle() }

        await store.fetchDayTitle('2025-12-15')

        expect(store.dayTitles['2025-12-15']).toBeUndefined()
      })
    })

    describe('saveDayTitle', () => {
      it('新しいタイトルを保存する', async () => {
        const { saveDayTitle } = await import('~/utils/db')

        const store = useDayTitlesStore()
        await store.saveDayTitle('2025-12-15', 'プロジェクト完成')

        expect(saveDayTitle).toHaveBeenCalledOnce()
        expect(store.dayTitles['2025-12-15']!.title).toBe('プロジェクト完成')
      })

      it('既存のタイトルを更新する', async () => {
        const { saveDayTitle } = await import('~/utils/db')
        const existing = createDayTitle({ id: 'dt-1', date: '2025-12-15', title: '古いタイトル' })

        const store = useDayTitlesStore()
        store.dayTitles = { '2025-12-15': existing }

        await store.saveDayTitle('2025-12-15', '新しいタイトル')

        expect(saveDayTitle).toHaveBeenCalledOnce()
        // 既存のIDを維持
        expect(store.dayTitles['2025-12-15']!.id).toBe('dt-1')
        expect(store.dayTitles['2025-12-15']!.title).toBe('新しいタイトル')
      })
    })

    describe('removeDayTitle', () => {
      it('タイトルを削除する', async () => {
        const { deleteDayTitle } = await import('~/utils/db')
        const existing = createDayTitle({ id: 'dt-1', date: '2025-12-15' })

        const store = useDayTitlesStore()
        store.dayTitles = { '2025-12-15': existing }

        await store.removeDayTitle('2025-12-15')

        expect(deleteDayTitle).toHaveBeenCalledWith('dt-1')
        expect(store.dayTitles['2025-12-15']).toBeUndefined()
      })

      it('存在しないタイトルの削除は何もしない', async () => {
        const { deleteDayTitle } = await import('~/utils/db')

        const store = useDayTitlesStore()
        await store.removeDayTitle('2025-12-20')

        expect(deleteDayTitle).not.toHaveBeenCalled()
      })
    })
  })
})
