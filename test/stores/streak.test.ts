import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useStreakStore } from '~/stores/streak'
import { useSettingsStore } from '~/stores/settings'
import { useLockStore } from '~/stores/lock'
import { useHealthDataStore } from '~/stores/healthData'
import { getAllDailyActivities, recordDailyActivity } from '~/utils/db'
import { createHealthData } from '../helpers/factories'

describe('useStreakStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(getAllDailyActivities).mockResolvedValue([])
    vi.mocked(recordDailyActivity).mockResolvedValue(false)
  })
  it('ロックされた起動では保存・通知せず、解除後にチェックインする', async () => {
    const lock = useLockStore()
    lock.enabled = true
    lock.pinHash = 'configured'
    const store = useStreakStore()
    expect(await store.checkIn()).toBe(false)
    expect(recordDailyActivity).not.toHaveBeenCalled()
    lock.unlock()
    vi.mocked(recordDailyActivity).mockResolvedValue(true)
    expect(await store.checkIn()).toBe(true)
    expect(store.showDailyModal).toBe(true)
  })
  it('4時の前後はそれぞれの実効日付に保存する', async () => {
    useSettingsStore().dateChangeLine = 4
    const store = useStreakStore()
    await store.checkIn(new Date(2026, 9, 7, 3, 59))
    expect(recordDailyActivity).toHaveBeenLastCalledWith({
      date: '2026-10-06', firstOpenedAt: new Date(2026, 9, 7, 3, 59), dateChangeLine: 4,
    })
    await store.checkIn(new Date(2026, 9, 7, 4))
    expect(recordDailyActivity).toHaveBeenLastCalledWith({
      date: '2026-10-07', firstOpenedAt: new Date(2026, 9, 7, 4), dateChangeLine: 4,
    })
  })
  it('解除後にタイムアウトしたロックでもチェックインしない', async () => {
    const lock = useLockStore()
    lock.enabled = true
    lock.pinHash = 'configured'
    lock.isLocked = false
    lock.lockTimeout = 1000
    lock.lastUnlockTime = Date.now() - 2000
    expect(await useStreakStore().checkIn()).toBe(false)
    expect(lock.isLocked).toBe(true)
    expect(recordDailyActivity).not.toHaveBeenCalled()
  })
  it('同日再訪では通知せず、履歴から現在・最長を計算する', async () => {
    vi.mocked(getAllDailyActivities).mockResolvedValue(['2026-10-05', '2026-10-06', '2026-10-07'].map(date => ({
      date, firstOpenedAt: new Date(date), dateChangeLine: 0,
    })))
    const store = useStreakStore()
    expect(await store.checkIn(new Date(2026, 9, 7, 12))).toBe(false)
    expect(store.showDailyModal).toBe(false)
    expect(store.usage).toMatchObject({ current: 3, longest: 3, monthCount: 3 })
  })
  it('同時に呼ばれてもDB操作は1回だけ', async () => {
    const store = useStreakStore()
    await Promise.all([store.checkIn(), store.checkIn(), store.checkIn()])
    expect(recordDailyActivity).toHaveBeenCalledTimes(1)
  })
  it('保存エラーでは通知せず、再試行できる', async () => {
    vi.mocked(recordDailyActivity).mockRejectedValueOnce(new Error('Storage unavailable'))
    const store = useStreakStore()
    expect(await store.checkIn()).toBe(false)
    expect(store.error).toBe('Storage unavailable')
    expect(store.showDailyModal).toBe(false)
    expect(store.isCheckingIn).toBe(false)
    vi.mocked(recordDailyActivity).mockResolvedValue(true)
    expect(await store.checkIn()).toBe(true)
    expect(store.error).toBeNull()
  })
  it('過去の健康データ追加・削除は利用履歴と独立して再計算される', () => {
    const store = useStreakStore()
    store.now = new Date(2026, 9, 7, 12)
    const health = useHealthDataStore()
    health.healthDataList = ['2026-10-05', '2026-10-07'].map(date => createHealthData({ date, weight: 60 }))
    expect(store.summaries.health?.current).toBe(1)
    health.healthDataList.push(createHealthData({ date: '2026-10-06', weight: 60 }))
    expect(store.summaries.health?.current).toBe(3)
    expect(store.summaries.weight?.current).toBe(3)
    health.healthDataList = health.healthDataList.filter(data => data.date !== '2026-10-06')
    expect(store.summaries.health?.current).toBe(1)
    expect(store.usage.current).toBe(0)
  })
})
