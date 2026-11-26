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

vi.mock('~/utils/healthConnect', async () => {
  const actual = await vi.importActual<typeof import('~/utils/healthConnect')>('~/utils/healthConnect')
  return {
    ...actual,
    readHealthConnectDailyData: vi.fn(),
    readHealthConnectDateRangeData: vi.fn(),
    writeHealthConnectDailyData: vi.fn(),
  }
})

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

    describe('getPreviousHealthDataByDateString', () => {
      it('指定日より前の直近データを返す', () => {
        const store = useHealthDataStore()
        const older = createHealthData({ date: '2025-12-10', weight: 68 })
        const recent = createHealthData({ date: '2025-12-14', weight: 70 })
        const sameDay = createHealthData({ date: '2025-12-15', weight: 72 })
        store.healthDataList = [older, recent, sameDay]

        const result = store.getPreviousHealthDataByDateString('2025-12-15')
        expect(result).toBeDefined()
        expect(result!.date).toBe('2025-12-14')
      })

      it('前回データがない場合はundefinedを返す', () => {
        const store = useHealthDataStore()
        store.healthDataList = [createHealthData({ date: '2025-12-15', weight: 72 })]

        const result = store.getPreviousHealthDataByDateString('2025-12-15')
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

      it('睡眠セッション（sleepSessions）が指定された場合に正規化してsleepHoursを自動計算する', async () => {
        const { getHealthDataByDate, saveHealthData } = await import('~/utils/db')
        vi.mocked(getHealthDataByDate).mockResolvedValue(undefined)

        const store = useHealthDataStore()
        const result = await store.saveHealthDataItem({
          date: '2025-12-15',
          sleepSessions: [
            { startTime: '23:30', endTime: '07:00' },
          ],
        })

        expect(saveHealthData).toHaveBeenCalledOnce()
        expect(result.sleepHours).toBe(7.5)
        expect(result.sleepSessions).toHaveLength(1)
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

    describe('fetchHealthData 重複排除と世代管理', () => {
      it('同時呼び出し時は in-flight Promise を共有し DB 取得を 1 回に集約する', async () => {
        const { getAllHealthData } = await import('~/utils/db')
        let resolveFetch!: (list: ReturnType<typeof createHealthData>[]) => void
        vi.mocked(getAllHealthData).mockImplementationOnce(() => new Promise((resolve) => {
          resolveFetch = resolve
        }))

        const store = useHealthDataStore()
        const p1 = store.fetchHealthData()
        const p2 = store.fetchHealthData()
        const p3 = store.fetchHealthData()
        const fetched = [createHealthData({ id: 'health-shared', date: '2026-10-07', weight: 65 })]
        resolveFetch(fetched)
        await Promise.all([p1, p2, p3])

        expect(getAllHealthData).toHaveBeenCalledTimes(1)
        expect(store.healthDataList).toEqual(fetched)
      })

      it('復元・インポート前の in-flight 取得結果が force 再取得後のストアを上書きしない', async () => {
        const { getAllHealthData } = await import('~/utils/db')
        let resolveStale!: (list: ReturnType<typeof createHealthData>[]) => void
        vi.mocked(getAllHealthData)
          .mockImplementationOnce(() => new Promise((resolve) => {
            resolveStale = resolve
          }))
          .mockResolvedValueOnce([createHealthData({ id: 'health-restored', date: '2026-10-07', weight: 61 })])

        const store = useHealthDataStore()
        const staleFetch = store.fetchHealthData()
        await store.fetchHealthData({ force: true })
        expect(store.healthDataList[0]!.id).toBe('health-restored')

        // 古い取得が後から解決しても上書きされない
        resolveStale([createHealthData({ id: 'health-stale', date: '2026-10-01', weight: 70 })])
        await staleFetch
        expect(store.healthDataList).toHaveLength(1)
        expect(store.healthDataList[0]!.id).toBe('health-restored')
        expect(store.isLoading).toBe(false)
      })
    })

    describe('Health Connect 双方向同期アクション', () => {
      it('syncDateFromHealthConnect: 部分失敗時は成功した項目のみ保存し、dirtyMetrics指定項目は保護する', async () => {
        const { getHealthDataByDate, saveHealthData } = await import('~/utils/db')
        const { readHealthConnectDailyData } = await import('~/utils/healthConnect')

        const existing = createHealthData({
          id: 'hc-1',
          date: '2025-12-15',
          weight: 66.0,
          steps: 4000,
          waterIntake: 1000,
          healthConnectSync: {
            weight: 66.0,
            steps: 4000,
            waterIntake: 1000,
          },
        })
        vi.mocked(getHealthDataByDate).mockResolvedValue(existing)
        vi.mocked(readHealthConnectDailyData).mockResolvedValue({
          date: '2025-12-15',
          steps: 9500,
          waterIntake: 1600,
          readFields: ['steps', 'waterIntake'],
          failedFields: ['weight'],
          fieldErrors: { weight: 'Read error' },
        })

        const store = useHealthDataStore()
        // waterIntake はフォームで未保存編集中として dirtyMetrics に指定
        const result = await store.syncDateFromHealthConnect('2025-12-15', {
          dirtyMetrics: ['waterIntake'],
        })

        expect(result.allFailed).toBe(false)
        expect(result.updatedFields).toEqual(['steps'])
        expect(result.skippedManualFields).toContain('waterIntake')
        expect(result.failedFields).toEqual(['weight'])
        expect(result.data?.steps).toBe(9500)
        expect(result.data?.waterIntake).toBe(1000)
        expect(result.data?.weight).toBe(66.0)
        expect(saveHealthData).toHaveBeenCalledOnce()
      })

      it('syncDateFromHealthConnect: 全項目失敗時（allFailed）は保存せずエラー状態を設定する', async () => {
        const { getHealthDataByDate, saveHealthData } = await import('~/utils/db')
        const { readHealthConnectDailyData } = await import('~/utils/healthConnect')

        vi.mocked(getHealthDataByDate).mockResolvedValue(undefined)
        vi.mocked(readHealthConnectDailyData).mockResolvedValue({
          date: '2025-12-15',
          readFields: [],
          emptyFields: [],
          failedFields: ['steps', 'sleep', 'heartRate', 'weight', 'bodyFatPercentage', 'waterIntake', 'exerciseMinutes'],
        })

        const store = useHealthDataStore()
        const result = await store.syncDateFromHealthConnect('2025-12-15')

        expect(result.allFailed).toBe(true)
        expect(store.error).toBeTruthy()
        expect(saveHealthData).not.toHaveBeenCalled()
      })

      it('writeDateToHealthConnect: 同一レコードの初回書き込み・再編集・再書き込みとバージョン更新を行う', async () => {
        const { getHealthDataByDate, saveHealthData } = await import('~/utils/db')
        const { writeHealthConnectDailyData } = await import('~/utils/healthConnect')

        const dbState: { current?: ReturnType<typeof createHealthData> } = {}
        vi.mocked(getHealthDataByDate).mockImplementation(async () => dbState.current)
        vi.mocked(saveHealthData).mockImplementation(async (saved) => {
          dbState.current = saved
        })

        const store = useHealthDataStore()

        // 1. 初回書き込み
        vi.mocked(writeHealthConnectDailyData).mockResolvedValueOnce({
          writtenFields: ['weight', 'waterIntake'],
          skippedPermissionFields: [],
          externalValues: { waterIntake: 1000 },
          tasketValues: { weight: 65.0, waterIntake: 200 },
          clientRecordVersions: { weight: 1001, waterIntake: 1001 },
        })

        const write1 = await store.writeDateToHealthConnect({
          date: '2025-12-15',
          weight: 65.0,
          waterIntake: 1200,
        })

        expect(write1.nothingToWrite).toBe(false)
        expect(write1.writtenFields).toEqual(['weight', 'waterIntake'])
        expect(write1.data.healthConnectSync?.clientRecordVersions?.weight).toBe(1001)
        expect(write1.data.healthConnectSync?.tasketValues?.waterIntake).toBe(200)

        // 2. 再編集して再書き込み（weight を 65.0 -> 64.8 に変更、waterIntake は 1200 のまま）
        vi.mocked(writeHealthConnectDailyData).mockResolvedValueOnce({
          writtenFields: ['weight'],
          skippedPermissionFields: [],
          tasketValues: { weight: 64.8 },
          clientRecordVersions: { weight: 1002 },
        })

        const write2 = await store.writeDateToHealthConnect({
          ...dbState.current,
          date: '2025-12-15',
          weight: 64.8,
          waterIntake: 1200,
        })

        expect(writeHealthConnectDailyData).toHaveBeenLastCalledWith(
          '2025-12-15',
          expect.objectContaining({
            weight: 64.8,
            clientRecordVersions: expect.objectContaining({ weight: 1001 }),
          }),
        )
        expect(write2.data.healthConnectSync?.clientRecordVersions?.weight).toBe(1002)
      })
    })
  })
})
