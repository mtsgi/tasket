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

export const useStreakStore = defineStore('streak', {
  state: () => ({
    dailyActivities: [] as DailyActivity[],
    now: new Date(),
    showDailyModal: false,
    isCheckingIn: false,
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
    async checkIn(now = new Date()): Promise<boolean> {
      const lock = useLockStore()
      lock.checkTimeout()
      if ((lock.isLockConfigured && lock.isLocked) || this.isCheckingIn) return false
      this.isCheckingIn = true
      this.error = null
      this.now = now
      try {
        const dateChangeLine = useSettingsStore().dateChangeLine
        const created = await recordDailyActivity({
          date: getEffectiveDateForTime(now, dateChangeLine),
          firstOpenedAt: now,
          dateChangeLine,
        })
        await this.refreshHistory()
        if (created) this.showDailyModal = true
        return created
      }
      catch (error) {
        this.error = error instanceof Error ? error.message : 'Check-in failed'
        return false
      }
      finally {
        this.isCheckingIn = false
      }
    },
  },
})
