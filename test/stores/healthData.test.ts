/**
 * healthData ストアのユニットテスト
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useHealthDataStore } from '~/stores/healthData'
import { createHealthData, resetIdCounter } from '../helpers/factories'

// uuid のモック
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-health-uuid'),
}))

describe('useHealthDataStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetIdCounter()
    vi.clearAllMocks()
  })

  describe('初期状態', () => {
    it('初期状態が正しい', () => {
      const store = useHealthDataStore()
      expect(store.healthDataList).toEqual([])
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })
  })

  describe('getters', () => {
    describe('getHealthDataByDateString', () => {
      it('指定日の健康データを返す', () => {
        const store = useHealthDataStore()
        const data = createHealthData({ date: '2025-12-15', weight: 70 })
        store.healthDataList = [data]

        const result = store.getHealthDataByDateString('2025-12-15')
        expect(result).toBeDefined()
        expect(result!.weight).toBe(70)
      })

      it('存在しない日付はundefinedを返す', () => {
        const store = useHealthDataStore()
        const result = store.getHealthDataByDateString('2025-12-20')
        expect(result).toBeUndefined()
      })
    })

    describe('getHealthDataByMonth', () => {
      it('指定月のデータを日付順で返す', () => {
        const store = useHealthDataStore()
        store.healthDataList = [
          createHealthData({ date: '2025-12-20' }),
          createHealthData({ date: '2025-12-05' }),
          createHealthData({ date: '2025-12-15' }),
          createHealthData({ date: '2025-11-30' }), // 前月
        ]

        const result = store.getHealthDataByMonth('2025-12')
        expect(result).toHaveLength(3)
        expect(result[0]!.date).toBe('2025-12-05')
        expect(result[2]!.date).toBe('2025-12-20')
      })
    })

    describe('getMonthlyHealthSummary', () => {
      it('データがない月は空のサマリーを返す', () => {
        const store = useHealthDataStore()
        const result = store.getMonthlyHealthSummary('2025-12')
        expect(result.yearMonth).toBe('2025-12')
        expect(result.recordCount).toBe(0)
      })

      it('平均値を正しく計算する', () => {
        const store = useHealthDataStore()
        store.healthDataList = [
          createHealthData({ date: '2025-12-10', weight: 68, bodyFatPercentage: 18 }),
          createHealthData({ date: '2025-12-20', weight: 72, bodyFatPercentage: 22 }),
        ]

        const result = store.getMonthlyHealthSummary('2025-12')
        expect(result.recordCount).toBe(2)
        expect(result.avgWeight).toBe(70) // (68 + 72) / 2
        expect(result.avgBodyFatPercentage).toBe(20) // (18 + 22) / 2
      })

      it('合計値を正しく計算する', () => {
        const store = useHealthDataStore()
        store.healthDataList = [
          createHealthData({ date: '2025-12-10', steps: 8000, exerciseMinutes: 30 }),
          createHealthData({ date: '2025-12-20', steps: 10000, exerciseMinutes: 45 }),
        ]

        const result = store.getMonthlyHealthSummary('2025-12')
        expect(result.totalSteps).toBe(18000)
        expect(result.totalExerciseMinutes).toBe(75)
      })

      it('前月との比較を正しく計算する', () => {
        const store = useHealthDataStore()
        store.healthDataList = [
          // 11月のデータ（前月）
          createHealthData({ date: '2025-11-15', weight: 72 }),
          // 12月のデータ（当月）
          createHealthData({ date: '2025-12-15', weight: 70 }),
        ]

        const result = store.getMonthlyHealthSummary('2025-12')
        expect(result.weightChange).toBe(-2) // 70 - 72 = -2
      })
    })
  })

  describe('actions', () => {
    describe('fetchHealthData', () => {
      it('DBから全健康データを取得する', async () => {
        const { getAllHealthData } = await import('~/utils/db')
        const mockData = [createHealthData()]
        vi.mocked(getAllHealthData).mockResolvedValue(mockData)

        const store = useHealthDataStore()
        await store.fetchHealthData()

        expect(store.healthDataList).toEqual(mockData)
        expect(store.isLoading).toBe(false)
      })
    })

    describe('saveHealthDataItem', () => {
      it('新しい健康データを保存する', async () => {
        const { getHealthDataByDate, saveHealthData } = await import('~/utils/db')
        vi.mocked(getHealthDataByDate).mockResolvedValue(undefined)

        const store = useHealthDataStore()
        const result = await store.saveHealthDataItem({
          date: '2025-12-15',
          weight: 70,
        })

        expect(saveHealthData).toHaveBeenCalledOnce()
        expect(result.date).toBe('2025-12-15')
        expect(result.weight).toBe(70)
        expect(store.healthDataList).toHaveLength(1)
      })

      it('既存データを更新する', async () => {
        const { getHealthDataByDate, saveHealthData } = await import('~/utils/db')
        const existing = createHealthData({ id: 'existing-id', date: '2025-12-15', weight: 68 })
        vi.mocked(getHealthDataByDate).mockResolvedValue(existing)

        const store = useHealthDataStore()
        store.healthDataList = [existing]

        const result = await store.saveHealthDataItem({
          date: '2025-12-15',
          weight: 70,
        })

        expect(saveHealthData).toHaveBeenCalledOnce()
        expect(result.id).toBe('existing-id')
        expect(result.weight).toBe(70)
      })
    })

    describe('deleteHealthDataItem', () => {
      it('健康データを削除する', async () => {
        const { deleteHealthData } = await import('~/utils/db')

        const store = useHealthDataStore()
        store.healthDataList = [
          createHealthData({ id: 'health-1' }),
          createHealthData({ id: 'health-2' }),
        ]

        await store.deleteHealthDataItem('health-1')

        expect(deleteHealthData).toHaveBeenCalledWith('health-1')
        expect(store.healthDataList).toHaveLength(1)
        expect(store.healthDataList[0]!.id).toBe('health-2')
      })
    })
  })
})
