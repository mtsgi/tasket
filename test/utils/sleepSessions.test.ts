/**
 * sleepSessions ユーティリティのユニットテスト
 */
import { describe, it, expect } from 'vitest'
import {
  areSleepSessionsEqual,
  calculateSleepSessionMinutes,
  calculateTotalSleepHours,
  createSleepSessionDrafts,
  extractTimeHHmm,
  formatSleepSessionRange,
  formatSleepSessionsSummary,
  mergeOverlappingSleepIntervals,
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

  describe('calculateTotalSleepHours & mergeOverlappingSleepIntervals', () => {
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

    it('重複する睡眠時間帯（オーバーラップ区間）を区間マージして二重加算を防止する', () => {
      // 23:00〜03:00 (4h) と 02:00〜07:00 (5h) -> 重複マージ後は 23:00〜07:00 の 8.0h
      const hours = calculateTotalSleepHours(
        [
          { startTime: '23:00', endTime: '03:00' },
          { startTime: '02:00', endTime: '07:00' },
        ],
        '2025-12-15',
      )
      expect(hours).toBe(8)

      const merged = mergeOverlappingSleepIntervals([
        { startMs: 1000, endMs: 5000 },
        { startMs: 3000, endMs: 8000 },
        { startMs: 9000, endMs: 10000 },
      ])
      expect(merged).toEqual([
        { startMs: 1000, endMs: 8000 },
        { startMs: 9000, endMs: 10000 },
      ])
    })

    it('有効なセッションがない場合はundefinedを返す', () => {
      expect(calculateTotalSleepHours([], '2025-12-15')).toBeUndefined()
      expect(calculateTotalSleepHours([{ startTime: '', endTime: '' }], '2025-12-15')).toBeUndefined()
    })
  })

  describe('normalizeSleepSessionsForDate & 秒以下の精度保持 (P2-4)', () => {
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

    it('createSleepSessionDrafts で HH:mm 表示に変換しても、未編集の睡眠セッションは秒・ミリ秒以下の精度と由来メタデータを完全に保持する', () => {
      const hcSession = {
        startTime: '2025-12-14T14:15:42.345Z',
        endTime: '2025-12-14T21:45:18.789Z',
        id: 'hc-sleep-1',
        dataOrigin: 'com.fitbit.FitbitMobile',
        source: 'external' as const,
      }

      const drafts = createSleepSessionDrafts([hcSession])
      expect(drafts).toHaveLength(1)
      expect(drafts[0]!.startTime).toBe(extractTimeHHmm(hcSession.startTime))
      expect(drafts[0]!.endTime).toBe(extractTimeHHmm(hcSession.endTime))

      // フォーム上で時刻を編集せずに再度 normalizeSleepSessionsForDate を通す
      const normalized = normalizeSleepSessionsForDate('2025-12-15', drafts)
      expect(normalized).toHaveLength(1)
      expect(normalized[0]!.startTime).toBe('2025-12-14T14:15:42.345Z')
      expect(normalized[0]!.endTime).toBe('2025-12-14T21:45:18.789Z')
      expect(normalized[0]!.source).toBe('external')
      expect(normalized[0]!.id).toBe('hc-sleep-1')
      expect(areSleepSessionsEqual(normalized, [hcSession])).toBe(true)
    })

    it('他アプリ由来の睡眠セッション（source: external）の時刻をフォーム上で編集した場合は source: manual へ遷移する', () => {
      const hcSession = {
        startTime: '2025-12-14T14:15:42.345Z',
        endTime: '2025-12-14T21:45:18.789Z',
        id: 'hc-sleep-1',
        dataOrigin: 'com.fitbit.FitbitMobile',
        source: 'external' as const,
      }

      const drafts = createSleepSessionDrafts([hcSession])
      // ユーザーが開始時刻を 23:00 に変更
      drafts[0]!.startTime = '23:00'

      const normalized = normalizeSleepSessionsForDate('2025-12-15', drafts)
      expect(normalized).toHaveLength(1)
      expect(normalized[0]!.source).toBe('manual')
      expect(normalized[0]!.id).toBeUndefined()
      expect(areSleepSessionsEqual(normalized, [hcSession])).toBe(false)
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
