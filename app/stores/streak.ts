import { defineStore } from 'pinia'
import type { DailyActivity } from '~/types/item'
import { getAllDailyActivities, recordDailyActivity } from '~/utils/db'
import { getEffectiveDateForTime } from '~/utils/dateHelpers'
import { calculateStreak, collectRecordDates } from '~/utils/streak'
import type { StreakSummary } from '~/utils/streak'
import { useSettingsStore } from '~/stores/settings'
import { useLockStore } from '~/stores/lock'
import { useHealthDataStore } from '~/stores/healthData'
import { useRoutinesStore } from '~/stores/routines'
import { useItemsStore } from '~/stores/items'

interface PendingCheckIn {
  now?: Date
  targetDate: string
  showModal: boolean
  promise: Promise<boolean>
  resolvers: Array<(value: boolean) => void>
}

interface StreakRuntime {
  inFlightPromise: Promise<boolean> | null
  inFlightToken: object | null
  inFlightDate: string | null
  pending: PendingCheckIn | null
  suspendCount: number
  shouldReevaluateOnResume: boolean
  exclusiveQueue: Promise<void>
}

const runtimeMap = new WeakMap<object, StreakRuntime>()

function getRuntime(store: object): StreakRuntime {
  let runtime = runtimeMap.get(store)
  if (!runtime) {
    runtime = {
      inFlightPromise: null,
      inFlightToken: null,
      inFlightDate: null,
      pending: null,
      suspendCount: 0,
      shouldReevaluateOnResume: false,
      exclusiveQueue: Promise.resolve(),
    }
    runtimeMap.set(store, runtime)
  }
  return runtime
}

function isDocumentVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden'
}

function cancelPendingCheckIn(runtime: StreakRuntime) {
  if (!runtime.pending) return
  const pending = runtime.pending
  runtime.pending = null
  for (const resolve of pending.resolvers) {
    resolve(false)
  }
}

export const useStreakStore = defineStore('streak', {
  state: () => ({
    dailyActivities: [] as DailyActivity[],
    now: new Date(),
    showDailyModal: false,
    isCheckingIn: false,
    isAutoCheckInSuspended: false,
    error: null as string | null,
  }),
  getters: {
    today: state => getEffectiveDateForTime(state.now, useSettingsStore().dateChangeLine),
    usage(): ReturnType<typeof calculateStreak> {
      return calculateStreak(this.dailyActivities.map(activity => activity.date), this.today)
    },
    recordDates(): ReturnType<typeof collectRecordDates> {
      return collectRecordDates(
        useHealthDataStore().healthDataList,
        Object.values(useRoutinesStore().routineLogs).flat(),
        useItemsStore().items,
        useSettingsStore().dateChangeLine,
      )
    },
    summaries(): Record<string, StreakSummary> {
      return Object.fromEntries(Object.entries(this.recordDates)
        .map(([category, dates]) => [category, calculateStreak(dates, this.today)]))
    },
  },
  actions: {
    async refreshHistory() {
      this.dailyActivities = await getAllDailyActivities()
    },

    /**
     * 復元・インポート・データ全削除などの排他処理中、自動チェックインを抑止して直列化する。
     * 完了後に利用履歴を再取得し、必要に応じて当日分のチェックインをサイレント再判定する。
     */
    async runWithAutoCheckInSuspended<T>(
      task: () => Promise<T>,
      options: { reevaluateAfter?: boolean } = {},
    ): Promise<T> {
      const runtime = getRuntime(this)
      const reevaluateAfter = options.reevaluateAfter ?? true

      runtime.suspendCount += 1
      this.isAutoCheckInSuspended = true
      cancelPendingCheckIn(runtime)

      const prevExclusive = runtime.exclusiveQueue
      let releaseExclusive!: () => void
      const currentExclusive = new Promise<void>((resolve) => {
        releaseExclusive = resolve
      })
      runtime.exclusiveQueue = prevExclusive.then(() => currentExclusive)

      await prevExclusive
      if (runtime.inFlightPromise) {
        await runtime.inFlightPromise.catch(() => false)
      }

      let taskSucceeded = false
      try {
        const result = await task()
        taskSucceeded = true
        return result
      }
      finally {
        if (taskSucceeded) {
          runtime.shouldReevaluateOnResume = reevaluateAfter
        }

        const isLastExclusive = runtime.suspendCount === 1
        const shouldRefresh = isLastExclusive && (reevaluateAfter || !taskSucceeded)
        if (shouldRefresh) {
          try {
            await this.refreshHistory()
          }
          catch (postError) {
            console.error('利用履歴の再取得に失敗しました:', postError)
            this.error = postError instanceof Error ? postError.message : 'Check-in failed'
          }
        }

        runtime.suspendCount = Math.max(0, runtime.suspendCount - 1)
        const shouldReevaluate = runtime.suspendCount === 0 && runtime.shouldReevaluateOnResume
        if (runtime.suspendCount === 0) {
          this.isAutoCheckInSuspended = false
          runtime.shouldReevaluateOnResume = false
        }
        releaseExclusive()

        if (shouldReevaluate && isDocumentVisible()) {
          try {
            await this.checkIn(undefined, { showModal: false })
          }
          catch (postError) {
            console.error('チェックインの再判定に失敗しました:', postError)
          }
        }
      }
    },

    async checkIn(now?: Date, options?: { showModal?: boolean }): Promise<boolean> {
      const runtime = getRuntime(this)
      const showModal = options?.showModal ?? true

      if (runtime.suspendCount > 0) return false

      const lock = useLockStore()
      lock.checkTimeout()
      if (lock.isLockConfigured && lock.isLocked) return false

      const initialNow = now ?? new Date()
      const targetDate = getEffectiveDateForTime(initialNow, useSettingsStore().dateChangeLine)

      if (runtime.inFlightPromise) {
        if (runtime.inFlightDate === targetDate) {
          return runtime.inFlightPromise
        }

        if (runtime.pending) {
          if (runtime.pending.targetDate === targetDate) {
            runtime.pending.now = now
            runtime.pending.showModal = runtime.pending.showModal || showModal
            return runtime.pending.promise
          }
          cancelPendingCheckIn(runtime)
        }

        const resolvers: Array<(value: boolean) => void> = []
        const promise = new Promise<boolean>((resolve) => {
          resolvers.push(resolve)
        })
        runtime.pending = { now, targetDate, showModal, promise, resolvers }
        return promise
      }

      const runToken = {}
      runtime.inFlightToken = runToken

      const execute = async (): Promise<boolean> => {
        this.isCheckingIn = true
        this.error = null
        let createdAny = false
        let currentNow = initialNow
        let currentDate = targetDate
        const isExplicitNow = now !== undefined

        try {
          for (let attempt = 0; attempt < 3; attempt++) {
            runtime.inFlightDate = currentDate
            this.now = currentNow
            const dateChangeLine = useSettingsStore().dateChangeLine
            const created = await recordDailyActivity({
              date: currentDate,
              firstOpenedAt: currentNow,
              dateChangeLine,
            })
            await this.refreshHistory()
            if (created) {
              createdAny = true
              if (showModal && runtime.suspendCount === 0) {
                this.showDailyModal = true
              }
            }

            // 開始前後で実効日付が変化した場合、進行中キューがなければその場で再判定する
            if (isExplicitNow || runtime.suspendCount > 0 || runtime.pending || !isDocumentVisible()) {
              break
            }
            const currentLock = useLockStore()
            currentLock.checkTimeout()
            if (currentLock.isLockConfigured && currentLock.isLocked) {
              break
            }
            const afterNow = new Date()
            const afterDate = getEffectiveDateForTime(afterNow, useSettingsStore().dateChangeLine)
            if (afterDate === currentDate) {
              break
            }
            currentNow = afterNow
            currentDate = afterDate
          }
          return createdAny
        }
        catch (error) {
          this.error = error instanceof Error ? error.message : 'Check-in failed'
          return false
        }
        finally {
          if (runtime.inFlightToken === runToken) {
            runtime.inFlightPromise = null
            runtime.inFlightToken = null
            runtime.inFlightDate = null
          }
          this.isCheckingIn = false

          if (runtime.pending) {
            const next = runtime.pending
            runtime.pending = null
            if (runtime.suspendCount > 0) {
              for (const resolve of next.resolvers) {
                resolve(false)
              }
            }
            else {
              void this.checkIn(next.now, { showModal: next.showModal }).then(
                (result) => {
                  for (const resolve of next.resolvers) {
                    resolve(result)
                  }
                },
                () => {
                  for (const resolve of next.resolvers) {
                    resolve(false)
                  }
                },
              )
            }
          }
        }
      }

      const inFlight = execute()
      if (runtime.inFlightToken === runToken) {
        runtime.inFlightPromise = inFlight
      }
      return inFlight
    },
  },
})
