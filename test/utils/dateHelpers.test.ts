/**
 * dateHelpers.ts のユニットテスト
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  formatDate,
  formatYearMonth,
  formatYear,
  formatTime,
  formatDateTime,
  formatDisplayDate,
  formatDisplayYearMonth,
  formatDisplayYear,
  formatDisplayDateTime,
  getStartOfDay,
  getEndOfDay,
  getStartOfMonth,
  getEndOfMonth,
  getStartOfYear,
  getEndOfYear,
  addDays,
  addMonths,
  addYears,
  getDaysInMonth,
  getFirstDayOfWeek,
  parseDate,
  isToday,
  isSameMonth,
  getEffectiveDateForTime,
  getStartOfEffectiveDay,
  getEndOfEffectiveDay,
} from '../../app/utils/dateHelpers'

// フォーマット系テスト
describe('formatDate', () => {
  it('DateオブジェクトをYYYY-MM-DD形式に変換する', () => {
    expect(formatDate(new Date('2025-12-15T10:30:00'))).toBe('2025-12-15')
  })

  it('文字列を受け付ける', () => {
    expect(formatDate('2025-06-01')).toBe('2025-06-01')
  })
})

describe('formatYearMonth', () => {
  it('YYYY-MM形式に変換する', () => {
    expect(formatYearMonth(new Date('2025-12-15'))).toBe('2025-12')
  })
})

describe('formatYear', () => {
  it('YYYY形式に変換する', () => {
    expect(formatYear(new Date('2025-12-15'))).toBe('2025')
  })
})

describe('formatTime', () => {
  it('HH:mm形式に変換する', () => {
    expect(formatTime(new Date('2025-12-15T14:30:00'))).toBe('14:30')
  })

  it('0埋めされる', () => {
    expect(formatTime(new Date('2025-12-15T09:05:00'))).toBe('09:05')
  })
})

describe('formatDateTime', () => {
  it('YYYY-MM-DD HH:mm形式に変換する', () => {
    expect(formatDateTime(new Date('2025-12-15T14:30:00'))).toBe('2025-12-15 14:30')
  })
})

describe('formatDisplayDate', () => {
  it('日本語表示形式に変換する', () => {
    expect(formatDisplayDate(new Date('2025-12-01'))).toBe('2025年12月1日')
  })
})

describe('formatDisplayYearMonth', () => {
  it('日本語年月形式に変換する', () => {
    expect(formatDisplayYearMonth(new Date('2025-12-15'))).toBe('2025年12月')
  })
})

describe('formatDisplayYear', () => {
  it('日本語年形式に変換する', () => {
    expect(formatDisplayYear(new Date('2025-12-15'))).toBe('2025年')
  })
})

describe('formatDisplayDateTime', () => {
  it('日本語日時形式に変換する', () => {
    expect(formatDisplayDateTime(new Date('2025-12-01T14:30:00'))).toBe('2025年12月1日 14:30')
  })
})

// 期間計算テスト
describe('getStartOfDay', () => {
  it('その日の00:00:00を返す', () => {
    const result = getStartOfDay('2025-12-15')
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
    expect(result.getSeconds()).toBe(0)
  })
})

describe('getEndOfDay', () => {
  it('その日の23:59:59を返す', () => {
    const result = getEndOfDay('2025-12-15')
    expect(result.getHours()).toBe(23)
    expect(result.getMinutes()).toBe(59)
    expect(result.getSeconds()).toBe(59)
  })
})

describe('getStartOfMonth', () => {
  it('月の最初の日の00:00:00を返す', () => {
    const result = getStartOfMonth('2025-12-15')
    expect(result.getDate()).toBe(1)
    expect(result.getMonth()).toBe(11) // 0-indexed
    expect(result.getHours()).toBe(0)
  })
})

describe('getEndOfMonth', () => {
  it('月の最後の日の23:59:59を返す', () => {
    const result = getEndOfMonth('2025-12-15')
    expect(result.getDate()).toBe(31)
    expect(result.getMonth()).toBe(11)
    expect(result.getHours()).toBe(23)
  })

  it('2月の末日を正しく処理する（平年）', () => {
    const result = getEndOfMonth('2025-02-10')
    expect(result.getDate()).toBe(28)
  })

  it('2月の末日を正しく処理する（うるう年）', () => {
    const result = getEndOfMonth('2024-02-10')
    expect(result.getDate()).toBe(29)
  })
})

describe('getStartOfYear', () => {
  it('年の最初の日を返す', () => {
    const result = getStartOfYear('2025-06-15')
    expect(result.getMonth()).toBe(0) // 1月
    expect(result.getDate()).toBe(1)
  })
})

describe('getEndOfYear', () => {
  it('年の最後の日を返す', () => {
    const result = getEndOfYear('2025-06-15')
    expect(result.getMonth()).toBe(11) // 12月
    expect(result.getDate()).toBe(31)
  })
})

// 日付加算テスト
describe('addDays', () => {
  it('日数を加算する', () => {
    const result = addDays('2025-12-15', 5)
    expect(formatDate(result)).toBe('2025-12-20')
  })

  it('負の日数で減算する', () => {
    const result = addDays('2025-12-15', -5)
    expect(formatDate(result)).toBe('2025-12-10')
  })

  it('月を跨ぐ加算', () => {
    const result = addDays('2025-12-30', 5)
    expect(formatDate(result)).toBe('2026-01-04')
  })
})

describe('addMonths', () => {
  it('月数を加算する', () => {
    const result = addMonths('2025-06-15', 3)
    expect(formatYearMonth(result)).toBe('2025-09')
  })

  it('年を跨ぐ加算', () => {
    const result = addMonths('2025-11-15', 3)
    expect(formatYearMonth(result)).toBe('2026-02')
  })
})

describe('addYears', () => {
  it('年数を加算する', () => {
    const result = addYears('2025-06-15', 2)
    expect(formatYear(result)).toBe('2027')
  })
})

describe('getDaysInMonth', () => {
  it('12月は31日', () => {
    expect(getDaysInMonth('2025-12-01')).toBe(31)
  })

  it('2月は28日（平年）', () => {
    expect(getDaysInMonth('2025-02-01')).toBe(28)
  })

  it('2月は29日（うるう年）', () => {
    expect(getDaysInMonth('2024-02-01')).toBe(29)
  })

  it('4月は30日', () => {
    expect(getDaysInMonth('2025-04-01')).toBe(30)
  })
})

describe('getFirstDayOfWeek', () => {
  it('月初の曜日を返す（0=日曜日）', () => {
    // 2025年12月1日は月曜日 → 1
    expect(getFirstDayOfWeek('2025-12-15')).toBe(1)
  })
})

describe('parseDate', () => {
  it('日付文字列をDateオブジェクトに変換する', () => {
    const result = parseDate('2025-12-15')
    expect(result).toBeInstanceOf(Date)
    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(11) // 0-indexed
    expect(result.getDate()).toBe(15)
  })
})

// 判定系テスト
describe('isToday', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('今日の日付でtrueを返す', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-12-15T10:00:00'))
    expect(isToday('2025-12-15')).toBe(true)
  })

  it('今日以外の日付でfalseを返す', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-12-15T10:00:00'))
    expect(isToday('2025-12-14')).toBe(false)
  })
})

describe('isSameMonth', () => {
  it('同じ月ならtrueを返す', () => {
    expect(isSameMonth('2025-12-01', '2025-12-31')).toBe(true)
  })

  it('異なる月ならfalseを返す', () => {
    expect(isSameMonth('2025-12-01', '2025-11-30')).toBe(false)
  })

  it('異なる年の同じ月はfalseを返す', () => {
    expect(isSameMonth('2025-12-01', '2024-12-01')).toBe(false)
  })
})

// 日付変更線テスト（Tasket固有のロジック）
describe('getEffectiveDateForTime', () => {
  it('日付変更線が0時の場合、通常の日付を返す', () => {
    expect(getEffectiveDateForTime('2025-12-15T03:00:00', 0)).toBe('2025-12-15')
  })

  it('日付変更線が4時で、3時台は前日扱い', () => {
    expect(getEffectiveDateForTime('2025-12-15T03:30:00', 4)).toBe('2025-12-14')
  })

  it('日付変更線が4時で、4時以降は当日扱い', () => {
    expect(getEffectiveDateForTime('2025-12-15T04:00:00', 4)).toBe('2025-12-15')
  })

  it('日付変更線が4時で、23時台は当日扱い', () => {
    expect(getEffectiveDateForTime('2025-12-15T23:00:00', 4)).toBe('2025-12-15')
  })

  it('日付変更線ちょうどの時刻は当日扱い', () => {
    expect(getEffectiveDateForTime('2025-12-15T06:00:00', 6)).toBe('2025-12-15')
  })

  it('日をまたぐケース（月初）', () => {
    expect(getEffectiveDateForTime('2025-12-01T02:00:00', 4)).toBe('2025-11-30')
  })
})

describe('getStartOfEffectiveDay', () => {
  it('日付変更線が0時の場合、その日の00:00を返す', () => {
    const result = getStartOfEffectiveDay('2025-12-15', 0)
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
  })

  it('日付変更線が4時の場合、その日の4:00を返す', () => {
    const result = getStartOfEffectiveDay('2025-12-15', 4)
    expect(result.getHours()).toBe(4)
    expect(result.getMinutes()).toBe(0)
    expect(result.getSeconds()).toBe(0)
  })
})

describe('getEndOfEffectiveDay', () => {
  it('日付変更線が0時の場合、その日の23:59:59.999を返す', () => {
    const result = getEndOfEffectiveDay('2025-12-15', 0)
    expect(result.getHours()).toBe(23)
    expect(result.getMinutes()).toBe(59)
    expect(result.getSeconds()).toBe(59)
  })

  it('日付変更線が4時の場合、翌日の3:59:59.999を返す', () => {
    const result = getEndOfEffectiveDay('2025-12-15', 4)
    expect(result.getDate()).toBe(16) // 翌日
    expect(result.getHours()).toBe(3)
    expect(result.getMinutes()).toBe(59)
    expect(result.getSeconds()).toBe(59)
  })
})
