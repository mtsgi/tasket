/**
 * routines ストアのユニットテスト
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRoutinesStore } from '~/stores/routines'
import { createRoutine, createRoutineLog, resetIdCounter } from '../helpers/factories'

// uuid のモック
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-routine-uuid'),
}))

describe('useRoutinesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetIdCounter()
    vi.clearAllMocks()
  })

  describe('初期状態', () => {
    it('初期状態が正しい', () => {
      const store = useRoutinesStore()
      expect(store.routines).toEqual([])
      expect(store.routineLogs).toEqual({})
      expect(store.isLoading).toBe(false)
    })
  })

  describe('getters', () => {
    describe('getLogsByDate', () => {
      it('指定日のログを返す', () => {
        const store = useRoutinesStore()
        const log = createRoutineLog({ date: '2025-12-15' })
        store.routineLogs = { '2025-12-15': [log] }

        const result = store.getLogsByDate('2025-12-15')
        expect(result).toHaveLength(1)
      })

      it('ログがない日は空配列を返す', () => {
        const store = useRoutinesStore()
        const result = store.getLogsByDate('2025-12-20')
        expect(result).toEqual([])
      })
    })

    describe('getRoutineStatus', () => {
      it('ログがある場合はそのステータスを返す', () => {
        const store = useRoutinesStore()
        store.routineLogs = {
          '2025-12-15': [
            createRoutineLog({ routineId: 'r1', date: '2025-12-15', status: 'achieved' }),
          ],
        }

        expect(store.getRoutineStatus('r1', '2025-12-15')).toBe('achieved')
      })

      it('ログがない場合はunconfirmedを返す', () => {
        const store = useRoutinesStore()
        expect(store.getRoutineStatus('r1', '2025-12-15')).toBe('unconfirmed')
      })
    })

    describe('isRoutineCompleted', () => {
      it('achievedの場合trueを返す', () => {
        const store = useRoutinesStore()
        store.routineLogs = {
          '2025-12-15': [
            createRoutineLog({ routineId: 'r1', date: '2025-12-15', status: 'achieved' }),
          ],
        }

        expect(store.isRoutineCompleted('r1', '2025-12-15')).toBe(true)
      })

      it('not_achievedの場合falseを返す', () => {
        const store = useRoutinesStore()
        store.routineLogs = {
          '2025-12-15': [
            createRoutineLog({ routineId: 'r1', date: '2025-12-15', status: 'not_achieved' }),
          ],
        }

        expect(store.isRoutineCompleted('r1', '2025-12-15')).toBe(false)
      })
    })
  })

  describe('actions', () => {
    describe('fetchRoutines', () => {
      it('指定月の日課を取得する', async () => {
        const { getRoutinesByYearMonth } = await import('~/utils/db')
        const mockRoutines = [createRoutine({ yearMonth: '2025-12' })]
        vi.mocked(getRoutinesByYearMonth).mockResolvedValue(mockRoutines)

        const store = useRoutinesStore()
        await store.fetchRoutines('2025-12')

        expect(store.routines).toEqual(mockRoutines)
      })
    })

    describe('createRoutine', () => {
      it('新しい日課を作成する', async () => {
        const { addRoutine } = await import('~/utils/db')

        const store = useRoutinesStore()
        const result = await store.createRoutine({
          title: '毎朝の運動',
          yearMonth: '2025-12',
        })

        expect(addRoutine).toHaveBeenCalledOnce()
        expect(result.title).toBe('毎朝の運動')
        expect(result.yearMonth).toBe('2025-12')
        expect(store.routines).toHaveLength(1)
      })
    })

    describe('deleteRoutineById', () => {
      it('日課を削除する', async () => {
        const { deleteRoutine } = await import('~/utils/db')

        const store = useRoutinesStore()
        store.routines = [
          createRoutine({ id: 'r1' }),
          createRoutine({ id: 'r2' }),
        ]

        await store.deleteRoutineById('r1')

        expect(deleteRoutine).toHaveBeenCalledWith('r1')
        expect(store.routines).toHaveLength(1)
        expect(store.routines[0]!.id).toBe('r2')
      })
    })

    describe('cycleRoutineStatus', () => {
      it('未確認 → 達成に変更する', async () => {
        const { getRoutineLog, saveRoutineLog } = await import('~/utils/db')
        vi.mocked(getRoutineLog).mockResolvedValue(undefined)

        const store = useRoutinesStore()
        await store.cycleRoutineStatus('r1', '2025-12-15')

        expect(saveRoutineLog).toHaveBeenCalledOnce()
        const savedLog = vi.mocked(saveRoutineLog).mock.calls[0]![0]
        expect(savedLog.status).toBe('achieved')
      })

      it('達成 → 未達成に変更する', async () => {
        const { getRoutineLog, saveRoutineLog } = await import('~/utils/db')
        vi.mocked(getRoutineLog).mockResolvedValue(
          createRoutineLog({ routineId: 'r1', date: '2025-12-15', status: 'achieved' }),
        )

        const store = useRoutinesStore()
        await store.cycleRoutineStatus('r1', '2025-12-15')

        const savedLog = vi.mocked(saveRoutineLog).mock.calls[0]![0]
        expect(savedLog.status).toBe('not_achieved')
      })

      it('未達成 → 未確認に変更する', async () => {
        const { getRoutineLog, saveRoutineLog } = await import('~/utils/db')
        vi.mocked(getRoutineLog).mockResolvedValue(
          createRoutineLog({ routineId: 'r1', date: '2025-12-15', status: 'not_achieved' }),
        )

        const store = useRoutinesStore()
        await store.cycleRoutineStatus('r1', '2025-12-15')

        const savedLog = vi.mocked(saveRoutineLog).mock.calls[0]![0]
        expect(savedLog.status).toBe('unconfirmed')
      })
    })
  })
})
