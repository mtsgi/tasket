/**
 * 日付操作ユーティリティ
 * dayjs ライブラリを使用した日付のフォーマットと計算を提供します。
 */
import dayjs from 'dayjs'

/**
 * 日付をYYYY-MM-DD形式の文字列に変換
 * @param date - 変換する日付
 * @returns YYYY-MM-DD形式の文字列
 */
export function formatDate(date: Date | string): string {
  return dayjs(date).format('YYYY-MM-DD')
}

/**
 * 日付をYYYY-MM形式の年月文字列に変換
 * @param date - 変換する日付
 * @returns YYYY-MM形式の文字列
 */
export function formatYearMonth(date: Date | string): string {
  return dayjs(date).format('YYYY-MM')
}

/**
 * 日付をHH:mm形式の時刻文字列に変換
 * @param date - 変換する日付
 * @returns HH:mm形式の文字列
 */
export function formatTime(date: Date | string): string {
  return dayjs(date).format('HH:mm')
}

/**
 * 日付をYYYY-MM-DD HH:mm形式の日時文字列に変換
 * @param date - 変換する日付
 * @returns YYYY-MM-DD HH:mm形式の文字列
 */
export function formatDateTime(date: Date | string): string {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

/**
 * 日付を日本語表示形式に変換（例: 2025年12月1日）
 * @param date - 変換する日付
 * @returns 日本語形式の日付文字列
 */
export function formatDisplayDate(date: Date | string): string {
  return dayjs(date).format('YYYY年M月D日')
}

/**
 * 日付を日本語表示形式の年月に変換（例: 2025年12月）
 * @param date - 変換する日付
 * @returns 日本語形式の年月文字列
 */
export function formatDisplayYearMonth(date: Date | string): string {
  return dayjs(date).format('YYYY年M月')
}

/**
 * 指定日の開始時刻（00:00:00）を取得
 * @param date - 対象の日付
 * @returns その日の開始時刻
 */
export function getStartOfDay(date: Date | string): Date {
  return dayjs(date).startOf('day').toDate()
}

/**
 * 指定日の終了時刻（23:59:59）を取得
 * @param date - 対象の日付
 * @returns その日の終了時刻
 */
export function getEndOfDay(date: Date | string): Date {
  return dayjs(date).endOf('day').toDate()
}

/**
 * 指定月の開始日時を取得
 * @param date - 対象の日付
 * @returns その月の最初の日時
 */
export function getStartOfMonth(date: Date | string): Date {
  return dayjs(date).startOf('month').toDate()
}

/**
 * 指定月の終了日時を取得
 * @param date - 対象の日付
 * @returns その月の最後の日時
 */
export function getEndOfMonth(date: Date | string): Date {
  return dayjs(date).endOf('month').toDate()
}

/**
 * 日付に日数を加算
 * @param date - 基準日
 * @param days - 加算する日数（負の値で減算）
 * @returns 計算後の日付
 */
export function addDays(date: Date | string, days: number): Date {
  return dayjs(date).add(days, 'day').toDate()
}

/**
 * 日付に月数を加算
 * @param date - 基準日
 * @param months - 加算する月数（負の値で減算）
 * @returns 計算後の日付
 */
export function addMonths(date: Date | string, months: number): Date {
  return dayjs(date).add(months, 'month').toDate()
}

/**
 * 指定月の日数を取得
 * @param date - 対象の日付
 * @returns その月の日数
 */
export function getDaysInMonth(date: Date | string): number {
  return dayjs(date).daysInMonth()
}

/**
 * 指定月の最初の日の曜日を取得（0=日曜日）
 * @param date - 対象の日付
 * @returns 曜日番号（0-6）
 */
export function getFirstDayOfWeek(date: Date | string): number {
  return dayjs(date).startOf('month').day()
}

/**
 * 日付文字列をDateオブジェクトに変換
 * @param dateString - 日付文字列
 * @returns Dateオブジェクト
 */
export function parseDate(dateString: string): Date {
  return dayjs(dateString).toDate()
}

/**
 * 指定日が今日かどうかを判定
 * @param date - 判定する日付
 * @returns 今日ならtrue
 */
export function isToday(date: Date | string): boolean {
  return dayjs(date).isSame(dayjs(), 'day')
}

/**
 * 2つの日付が同じ月かどうかを判定
 * @param date1 - 日付1
 * @param date2 - 日付2
 * @returns 同じ月ならtrue
 */
export function isSameMonth(date1: Date | string, date2: Date | string): boolean {
  return dayjs(date1).isSame(dayjs(date2), 'month')
}

/**
 * 指定時刻から実効日付を取得
 * 日付変更線を考慮して、指定時刻が属する実効日付を返す
 * @param dateTime - 対象の日時
 * @param dateChangeLine - 日付変更線の時刻（0-23時）
 * @returns 実効日付（YYYY-MM-DD形式）
 * @example
 * // 日付変更線が4時の場合
 * // 2025-12-13 03:30 → '2025-12-12' (前日の実効日付に含まれる)
 * // 2025-12-13 04:00 → '2025-12-13' (当日の実効日付に含まれる)
 */
export function getEffectiveDateForTime(dateTime: Date | string, dateChangeLine: number): string {
  const date = dayjs(dateTime)
  const hour = date.hour()

  // 日付変更線より前の時刻の場合、前日の実効日付として扱う
  // 例: 4時設定で3時台のアイテムは、前日の実効日付に属する
  if (hour < dateChangeLine) {
    return date.subtract(1, 'day').format('YYYY-MM-DD')
  }

  return date.format('YYYY-MM-DD')
}

/**
 * 実効日付の開始時刻を取得
 * 日付変更線を考慮した、その日の開始時刻を返す
 * @param date - 対象の日付（YYYY-MM-DD形式）
 * @param dateChangeLine - 日付変更線の時刻（0-23時）
 * @returns 実効日付の開始時刻
 * @example
 * // 日付変更線が4時の場合
 * // 2025-12-12の実効日付は、2025-12-12 04:00:00 から開始
 */
export function getStartOfEffectiveDay(date: Date | string, dateChangeLine: number): Date {
  const targetDate = dayjs(date)

  // 日付変更線が0時の場合は通常の日の開始
  if (dateChangeLine === 0) {
    return targetDate.startOf('day').toDate()
  }

  // 当日の日付変更線時刻から開始
  return targetDate.hour(dateChangeLine).minute(0).second(0).millisecond(0).toDate()
}

/**
 * 実効日付の終了時刻を取得
 * 日付変更線を考慮した、その日の終了時刻を返す
 * @param date - 対象の日付（YYYY-MM-DD形式）
 * @param dateChangeLine - 日付変更線の時刻（0-23時）
 * @returns 実効日付の終了時刻
 * @example
 * // 日付変更線が4時の場合
 * // 2025-12-12の実効日付は、2025-12-13 03:59:59.999 まで
 */
export function getEndOfEffectiveDay(date: Date | string, dateChangeLine: number): Date {
  const targetDate = dayjs(date)

  // 日付変更線が0時の場合は通常の日の終了
  if (dateChangeLine === 0) {
    return targetDate.endOf('day').toDate()
  }

  // 翌日の日付変更線時刻の直前まで（dateChangeLine時のミリ秒前）
  // 例: 4時設定の場合、翌日3:59:59.999まで
  return targetDate.add(1, 'day').hour(dateChangeLine).minute(0).second(0).millisecond(0).subtract(1, 'millisecond').toDate()
}
