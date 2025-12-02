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
