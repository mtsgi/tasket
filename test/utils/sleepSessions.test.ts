/**
 * sleepSessions ユーティリティのユニットテスト
 */
import { describe, it, expect } from 'vitest'
import {
  areSleepSessionsEqual,
  calculateSleepSessionMinutes,
  calculateTotalSleepHours,
  extractTimeHHmm,
  formatSleepSessionRange,
  formatSleepSessionsSummary,
  normalizeSleepSessionsForDate,
  resolveSleepSessionToIso,
} from '~/utils/sleepSessions'

describe('sleepSessions utilities', () => {
  describe('extractTimeHHmm', () => {
    it('HH:mm形式の文字列をそのまま返す', () => {
      expect(extractTimeHHmm('23:30')).toBe('23:30')
      expect(extractTimeHHmm('07:05')).toBe('07:05')
    })

    it('ISO日時文字列から時刻を抽出する', () => {
      const resolved = resolveSleepSessionToIso('2025-12-15', '23:30', '07:00')
      expect(resolved).not.toBeNull()
      expect(extractTimeHHmm(resolved!.startTime)).toBe('23:30')
      expect(extractTimeHHmm(resolved!.endTime)).toBe('07:00')
    })

    it('空または無効な文字列の場合は空文字を返す', () => {
      expect(extractTimeHHmm('')).toBe('')
      expect(extractTimeHHmm(undefined)).toBe('')
      expect(extractTimeHHmm('invalid-time')).toBe('')
    })
  })

  describe('resolveSleepSessionToIso', () => {
    it('開始時刻 <= 終了時刻の場合は同日の時間帯として解決する', () => {
      const resolved = resolveSleepSessionToIso('2025-12-15', '01:00', '07:30')
      expect(resolved).not.toBeNull()
      expect(calculateSleepSessionMinutes(resolved!)).toBe(390) // 6.5時間
    })

    it('開始時刻 > 終了時刻（例: 23:30〜07:00）の場合は前日夜〜当日朝として解決する', () => {
      const resolved = resolveSleepSessionToIso('2025-12-15', '23:30', '07:00')
      expect(resolved).not.toBeNull()
      expect(calculateSleepSessionMinutes(resolved!)).toBe(450) // 7.5時間
    })

    it('開始時刻と終了時刻が同一の場合はnullを返す', () => {
      expect(resolveSleepSessionToIso('2025-12-15', '07:00', '07:00')).toBeNull()
    })
  })

  describe('calculateTotalSleepHours', () => {
    it('単一セッションの合計睡眠時間を計算する', () => {
      const hours = calculateTotalSleepHours(
        [{ startTime: '23:30', endTime: '07:00' }],
        '2025-12-15',
      )
      expect(hours).toBe(7.5)
    })

    it('夜間睡眠＋昼寝などの複数セッションの合計時間を小数第1位で計算する', () => {
      const hours = calculateTotalSleepHours(
        [
          { startTime: '23:30', endTime: '06:30' }, // 7.0h
          { startTime: '13:00', endTime: '14:15' }, // 1.25h -> 合計8.25h -> 8.3h
        ],
        '2025-12-15',
      )
      expect(hours).toBe(8.3)
    })

    it('有効なセッションがない場合はundefinedを返す', () => {
      expect(calculateTotalSleepHours([], '2025-12-15')).toBeUndefined()
      expect(calculateTotalSleepHours([{ startTime: '', endTime: '' }], '2025-12-15')).toBeUndefined()
    })
  })

  describe('normalizeSleepSessionsForDate & formatting', () => {
    it('未入力の行を除外して正規化し、表示用サマリーを生成する', () => {
      const normalized = normalizeSleepSessionsForDate('2025-12-15', [
        { startTime: '23:30', endTime: '07:00' },
        { startTime: '', endTime: '' },
        { startTime: '13:00', endTime: '14:00' },
      ])
      expect(normalized).toHaveLength(2)
      expect(formatSleepSessionRange(normalized[0]!)).toBe('23:30〜07:00')
      expect(formatSleepSessionsSummary(normalized)).toBe('23:30〜07:00 / 13:00〜14:00')
    })

    it('areSleepSessionsEqualで同一判定ができる', () => {
      const a = normalizeSleepSessionsForDate('2025-12-15', [{ startTime: '23:30', endTime: '07:00' }])
      const b = normalizeSleepSessionsForDate('2025-12-15', [{ startTime: '23:30', endTime: '07:00' }])
      const c = normalizeSleepSessionsForDate('2025-12-15', [{ startTime: '23:00', endTime: '07:00' }])

      expect(areSleepSessionsEqual(a, b)).toBe(true)
      expect(areSleepSessionsEqual(a, c)).toBe(false)
      expect(areSleepSessionsEqual([], undefined)).toBe(true)
    })
  })
})
