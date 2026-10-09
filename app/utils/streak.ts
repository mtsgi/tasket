import dayjs from 'dayjs'
import type { DailyActivity, HealthData, Item, RoutineLog } from '~/types/item'
import { getEffectiveDateForTime } from '~/utils/dateHelpers'

export interface StreakSummary {
  current: number
  longest: number
  monthCount: number
  recordedToday: boolean
  recentDays: { date: string, recorded: boolean }[]
}

export function isActivityDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && dayjs(date).format('YYYY-MM-DD') === date
}

/** 今日が未記録でも昨日までの連続は維持。未来日・重複日は集計しない。 */
export function calculateStreak(dates: Iterable<string>, today: string, month = today.slice(0, 7)): StreakSummary {
  const days = new Set([...dates].filter(date => isActivityDate(date) && date <= today))
  const sorted = [...days].sort()
  let longest = 0
  let run = 0
  let previous = ''
  for (const date of sorted) {
    run = dayjs(previous).add(1, 'day').format('YYYY-MM-DD') === date ? run + 1 : 1
    longest = Math.max(longest, run)
    previous = date
  }
  let cursor = days.has(today) ? today : dayjs(today).subtract(1, 'day').format('YYYY-MM-DD')
  let current = 0
  while (days.has(cursor)) {
    current++
    cursor = dayjs(cursor).subtract(1, 'day').format('YYYY-MM-DD')
  }
  return {
    current,
    longest,
    monthCount: sorted.filter(date => date.startsWith(month + '-')).length,
    recordedToday: days.has(today),
    recentDays: Array.from({ length: 7 }, (_, index) => {
      const date = dayjs(today).subtract(6 - index, 'day').format('YYYY-MM-DD')
      return { date, recorded: days.has(date) }
    }),
  }
}

const healthFields = [
  'weight', 'bodyFatPercentage', 'muscleMass', 'visceralFatLevel', 'basalMetabolicRate',
  'bodyWaterPercentage', 'boneMass', 'proteinPercentage', 'systolicBloodPressure',
  'diastolicBloodPressure', 'heartRate', 'bodyTemperature', 'spo2', 'sleepHours',
  'steps', 'exerciseMinutes', 'caloriesBurned', 'waterIntake',
  'menstrualCycle', 'medicationRecord', 'healthMemo',
] as const

function hasValue(value: unknown): boolean {
  return typeof value === 'number' ? Number.isFinite(value) : typeof value === 'string' && value.trim().length > 0
}

export function hasHealthRecord(data: HealthData): boolean {
  return healthFields.some(field => hasValue(data[field]))
}

/** 記録ストリークは対象日で集計し、利用履歴から独立させる。 */
export function collectRecordDates(health: HealthData[], logs: RoutineLog[], items: Item[], dateChangeLine: number) {
  const dates = {
    health: health.filter(hasHealthRecord).map(data => data.date),
    weight: health.filter(data => hasValue(data.weight)).map(data => data.date),
    sleep: health.filter(data => hasValue(data.sleepHours)).map(data => data.date),
    bloodPressure: health.filter(data => hasValue(data.systolicBloodPressure) || hasValue(data.diastolicBloodPressure)).map(data => data.date),
    steps: health.filter(data => hasValue(data.steps)).map(data => data.date),
    routine: logs.filter(log => log.status === 'achieved').map(log => log.date),
    todo: [] as string[],
    expense: [] as string[],
    meal: [] as string[],
  }
  for (const item of items) {
    const date = getEffectiveDateForTime(item.scheduled_at, dateChangeLine)
    if (item.type === 'todo') dates.todo.push(date)
    if (item.type === 'expense' || item.type === 'income') dates.expense.push(date)
    if (item.mealLog && Object.values(item.mealLog).some(hasValue)) dates.meal.push(date)
  }
  return { ...dates, overall: [...dates.health, ...dates.routine, ...dates.todo, ...dates.expense, ...dates.meal] }
}

/** バックアップからの履歴も同じ検証を通す。 */
export function parseDailyActivities(value: unknown): DailyActivity[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error('Invalid daily activities')
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object' || typeof entry.date !== 'string'
      || !isActivityDate(entry.date) || typeof entry.firstOpenedAt !== 'string'
      || !Number.isFinite(new Date(entry.firstOpenedAt).getTime())
      || !Number.isInteger(entry.dateChangeLine) || entry.dateChangeLine < 0 || entry.dateChangeLine > 23) {
      throw new Error('Invalid daily activity')
    }
    return { date: entry.date, firstOpenedAt: new Date(entry.firstOpenedAt), dateChangeLine: entry.dateChangeLine }
  })
}
