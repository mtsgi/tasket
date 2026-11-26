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

  it('日付変更線付近で非同期チェックインが競合しても当日分を取りこぼさない', async () => {
    useSettingsStore().dateChangeLine = 4
    let resolveFirst!: (value: boolean) => void
    const firstDeferred = new Promise<boolean>((resolve) => {
      resolveFirst = resolve
    })
    vi.mocked(recordDailyActivity)
      .mockImplementationOnce(() => firstDeferred)
      .mockResolvedValueOnce(true)

    const store = useStreakStore()
    const beforeBoundary = store.checkIn(new Date(2026, 9, 7, 3, 59, 59))
    const afterBoundary = store.checkIn(new Date(2026, 9, 7, 4, 0, 1))

    resolveFirst(false)
    expect(await beforeBoundary).toBe(false)
    expect(await afterBoundary).toBe(true)
    expect(recordDailyActivity).toHaveBeenCalledTimes(2)
    expect(recordDailyActivity).toHaveBeenNthCalledWith(1, expect.objectContaining({ date: '2026-10-06' }))
    expect(recordDailyActivity).toHaveBeenNthCalledWith(2, expect.objectContaining({ date: '2026-10-07' }))
    expect(store.showDailyModal).toBe(true)
  })

  it('非同期チェックインの開始前後で実効日付が変化した場合、その場で新しい実効日付を再判定する', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 9, 7, 3, 59, 59, 900))
      useSettingsStore().dateChangeLine = 4
      let resolveFirst!: (value: boolean) => void
      const firstDeferred = new Promise<boolean>((resolve) => {
        resolveFirst = resolve
      })
      vi.mocked(recordDailyActivity)
        .mockImplementationOnce(() => firstDeferred)
        .mockResolvedValueOnce(true)

      const store = useStreakStore()
      const checkInPromise = store.checkIn()

      // DB待機中に日付変更線（4:00）を跨ぐ
      vi.advanceTimersByTime(200)
      resolveFirst(false)

      expect(await checkInPromise).toBe(true)
      expect(recordDailyActivity).toHaveBeenCalledTimes(2)
      expect(recordDailyActivity).toHaveBeenNthCalledWith(1, expect.objectContaining({ date: '2026-10-06' }))
      expect(recordDailyActivity).toHaveBeenNthCalledWith(2, expect.objectContaining({ date: '2026-10-07' }))
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('保留中のチェックインが抑止または新日付で破棄されても Promise が必ず解決する', async () => {
    useSettingsStore().dateChangeLine = 4
    let resolveFirst!: (value: boolean) => void
    const firstDeferred = new Promise<boolean>((resolve) => {
      resolveFirst = resolve
    })
    vi.mocked(recordDailyActivity)
      .mockImplementationOnce(() => firstDeferred)
      .mockResolvedValue(true)

    const store = useStreakStore()
    const first = store.checkIn(new Date(2026, 9, 7, 3, 59))
    const pendingDay2 = store.checkIn(new Date(2026, 9, 7, 4, 0))
    // さらに別の日付で上書きされた場合、旧保留Promiseは即座に false で解決する
    const pendingDay3 = store.checkIn(new Date(2026, 9, 8, 4, 0))
    expect(await pendingDay2).toBe(false)

    // 復元等の排他抑止が開始された場合も、保留中 Promise は永久待機せず false で解決する
    const suspended = store.runWithAutoCheckInSuspended(async () => {
      expect(await store.checkIn(new Date(2026, 9, 9, 4, 0))).toBe(false)
    }, { reevaluateAfter: false })
    expect(await pendingDay3).toBe(false)

    resolveFirst(false)
    await first
    await suspended
  })

  it('runWithAutoCheckInSuspended は進行中チェックイン完了を待ち、排他直列化と完了後の履歴再取得・サイレント再判定を行う', async () => {
    const order: string[] = []
    let resolveInFlight!: (value: boolean) => void
    const inFlightDeferred = new Promise<boolean>((resolve) => {
      resolveInFlight = resolve
    })
    vi.mocked(recordDailyActivity)
      .mockImplementationOnce(async () => {
        const res = await inFlightDeferred
        order.push('inFlight:done')
        return res
      })
      .mockImplementation(async () => {
        order.push('postSync:checkIn')
        return true
      })

    const store = useStreakStore()
    const firstCheckIn = store.checkIn()

    // 復元とインポートが同時起動されても直列化される
    let releaseTask1!: () => void
    const task1Gate = new Promise<void>((resolve) => {
      releaseTask1 = resolve
    })
    const task1 = store.runWithAutoCheckInSuspended(async () => {
      order.push('task1:start')
      expect(await store.checkIn()).toBe(false)
      await task1Gate
      order.push('task1:end')
    })
    const task2 = store.runWithAutoCheckInSuspended(async () => {
      order.push('task2:start')
      expect(await store.checkIn()).toBe(false)
      order.push('task2:end')
    })

    resolveInFlight(false)
    await firstCheckIn
    await vi.waitFor(() => expect(order).toContain('task1:start'))
    expect(order).not.toContain('task2:start')

    releaseTask1()
    await Promise.all([task1, task2])

    expect(order).toEqual([
      'inFlight:done',
      'task1:start',
      'task1:end',
      'task2:start',
      'task2:end',
      'postSync:checkIn',
    ])
    // 復元・インポート後のサイレント再判定ではモーダルを自動表示しない
    expect(store.showDailyModal).toBe(false)
    expect(store.isAutoCheckInSuspended).toBe(false)
  })

  it('runWithAutoCheckInSuspended の後処理で例外が起きても本来の例外を上書きしない', async () => {
    const store = useStreakStore()
    vi.mocked(getAllDailyActivities).mockRejectedValueOnce(new Error('Post refresh error'))

    await expect(
      store.runWithAutoCheckInSuspended(async () => {
        throw new Error('Original restore error')
      }),
    ).rejects.toThrow('Original restore error')
    expect(store.isAutoCheckInSuspended).toBe(false)
    expect(recordDailyActivity).not.toHaveBeenCalled()
  })

  it('clearAllData 用の reevaluateAfter: false では完了後に履歴取得・チェックインを実行しない', async () => {
    const store = useStreakStore()
    await store.runWithAutoCheckInSuspended(async () => {
      expect(store.isAutoCheckInSuspended).toBe(true)
      expect(await store.checkIn()).toBe(false)
    }, { reevaluateAfter: false })

    expect(store.isAutoCheckInSuspended).toBe(false)
    expect(getAllDailyActivities).not.toHaveBeenCalled()
    expect(recordDailyActivity).not.toHaveBeenCalled()
  })
})
