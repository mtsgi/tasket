import { describe, it, expect } from 'vitest'
import { calculateStreak, collectRecordDates, hasHealthRecord, parseDailyActivities } from '~/utils/streak'
import { createHealthData, createItem, createRoutineLog } from '../helpers/factories'

describe('calculateStreak', () => {
  it('履歴なしはゼロ、直近7日は未記録', () => {
    const result = calculateStreak([], '2026-10-07')
    expect(result).toMatchObject({ current: 0, longest: 0, monthCount: 0, recordedToday: false })
    expect(result.recentDays).toHaveLength(7)
    expect(result.recentDays[0]).toEqual({ date: '2026-10-01', recorded: false })
  })
  it('並び順・重複によらず連続日数を数える', () => {
    expect(calculateStreak(['2026-10-07', '2026-10-05', '2026-10-06', '2026-10-07'], '2026-10-07'))
      .toMatchObject({ current: 3, longest: 3, monthCount: 3, recordedToday: true })
  })
  it('今日未記録なら昨日までの連続を維持する', () => {
    expect(calculateStreak(['2026-10-05', '2026-10-06'], '2026-10-07'))
      .toMatchObject({ current: 2, longest: 2, recordedToday: false })
  })
  it('昨日も未記録なら現在はゼロ、最長は残す', () => {
    expect(calculateStreak(['2026-10-03', '2026-10-04'], '2026-10-07'))
      .toMatchObject({ current: 0, longest: 2 })
  })
  it('欠けた過去日の追加で連続が復活し、削除で短くなる', () => {
    const dates = ['2026-10-03', '2026-10-04', '2026-10-06']
    expect(calculateStreak(dates, '2026-10-06').current).toBe(1)
    expect(calculateStreak([...dates, '2026-10-05'], '2026-10-06').current).toBe(4)
    expect(calculateStreak(dates, '2026-10-06').current).toBe(1)
  })
  it('月・年を跨ぎ、表示月の日数は分けて数える', () => {
    const dates = ['2025-12-30', '2025-12-31', '2026-01-01']
    expect(calculateStreak(dates, '2026-01-01', '2025-12')).toMatchObject({ current: 3, monthCount: 2 })
  })
  it('うるう日を含む連続を数える', () => {
    expect(calculateStreak(['2024-02-28', '2024-02-29', '2024-03-01'], '2024-03-01').current).toBe(3)
  })
  it('未来日や無効な日付を除外する', () => {
    expect(calculateStreak(['2026-10-07', '2026-10-08', '2026-02-30', 'invalid'], '2026-10-07'))
      .toMatchObject({ current: 1, longest: 1, monthCount: 1 })
  })
})

describe('collectRecordDates', () => {
  it('メタデータだけの健康レコードや空文字は記録扱いにしない', () => {
    expect(hasHealthRecord(createHealthData({ weight: undefined, bodyFatPercentage: undefined }))).toBe(false)
    expect(hasHealthRecord(createHealthData({ weight: undefined, bodyFatPercentage: undefined, healthMemo: '  ' }))).toBe(false)
  })
  it('0も有効な記録として扱い、1項目あれば達成する', () => {
    expect(hasHealthRecord(createHealthData({ weight: undefined, steps: 0 }))).toBe(true)
    expect(hasHealthRecord(createHealthData({ weight: undefined, healthMemo: '元気' }))).toBe(true)
    expect(hasHealthRecord(createHealthData({ weight: NaN, bodyFatPercentage: undefined }))).toBe(false)
  })
  it('健康と日課は保存された対象日を使う', () => {
    const result = collectRecordDates(
      [createHealthData({ date: '2026-10-07', weight: 60, sleepHours: 0, systolicBloodPressure: 120 })],
      [createRoutineLog({ date: '2026-10-06', status: 'achieved' }), createRoutineLog({ date: '2026-10-07', status: 'not_achieved' })],
      [], 4,
    )
    expect(result.health).toEqual(['2026-10-07'])
    expect(result.weight).toEqual(['2026-10-07'])
    expect(result.sleep).toEqual(['2026-10-07'])
    expect(result.bloodPressure).toEqual(['2026-10-07'])
    expect(result.routine).toEqual(['2026-10-06'])
  })
  it('TODO・収支・食事は予定日の実効日付で数え、空の食事は除く', () => {
    const result = collectRecordDates([], [], [
      createItem({ scheduled_at: new Date(2026, 9, 7, 2), mealLog: { calories: 0 } }),
      createItem({ type: 'expense', scheduled_at: new Date(2026, 9, 7, 4), mealLog: {} }),
      createItem({ type: 'income', scheduled_at: new Date(2026, 9, 7, 5) }),
    ], 4)
    expect(result.todo).toEqual(['2026-10-06'])
    expect(result.expense).toEqual(['2026-10-07', '2026-10-07'])
    expect(result.meal).toEqual(['2026-10-06'])
    expect(calculateStreak(result.overall, '2026-10-07').current).toBe(2)
  })
  it('未来の健康記録は存在しても現在の達成には使わない', () => {
    const result = collectRecordDates([createHealthData({ date: '2026-10-08', weight: 60 })], [], [], 4)
    expect(calculateStreak(result.health, '2026-10-07').current).toBe(0)
  })
})

describe('parseDailyActivities', () => {
  it('旧形式のバックアップに履歴がなくても読み込める', () => {
    expect(parseDailyActivities(undefined)).toEqual([])
  })
  it('日時をDateに復元する', () => {
    expect(parseDailyActivities([{ date: '2026-10-06', firstOpenedAt: '2026-10-06T12:00:00Z', dateChangeLine: 4 }])[0])
      .toEqual({ date: '2026-10-06', firstOpenedAt: new Date('2026-10-06T12:00:00Z'), dateChangeLine: 4 })
  })
  it.each([
    null, {}, [null],
    [{ date: '2026-02-30', firstOpenedAt: '2026-10-06T12:00:00Z', dateChangeLine: 4 }],
    [{ date: '2026-10-06', firstOpenedAt: 'invalid', dateChangeLine: 4 }],
    [{ date: '2026-10-06', firstOpenedAt: '2026-10-06T12:00:00Z', dateChangeLine: 24 }],
  ])('無効な履歴を拒否する: %j', (data) => {
    expect(() => parseDailyActivities(data)).toThrow()
  })
})
