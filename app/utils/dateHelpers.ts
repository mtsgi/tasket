import dayjs from 'dayjs'

export function formatDate(date: Date | string): string {
  return dayjs(date).format('YYYY-MM-DD')
}

export function formatYearMonth(date: Date | string): string {
  return dayjs(date).format('YYYY-MM')
}

export function formatTime(date: Date | string): string {
  return dayjs(date).format('HH:mm')
}

export function formatDateTime(date: Date | string): string {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

export function formatDisplayDate(date: Date | string): string {
  return dayjs(date).format('YYYY年M月D日')
}

export function formatDisplayYearMonth(date: Date | string): string {
  return dayjs(date).format('YYYY年M月')
}

export function getStartOfDay(date: Date | string): Date {
  return dayjs(date).startOf('day').toDate()
}

export function getEndOfDay(date: Date | string): Date {
  return dayjs(date).endOf('day').toDate()
}

export function getStartOfMonth(date: Date | string): Date {
  return dayjs(date).startOf('month').toDate()
}

export function getEndOfMonth(date: Date | string): Date {
  return dayjs(date).endOf('month').toDate()
}

export function addDays(date: Date | string, days: number): Date {
  return dayjs(date).add(days, 'day').toDate()
}

export function addMonths(date: Date | string, months: number): Date {
  return dayjs(date).add(months, 'month').toDate()
}

export function getDaysInMonth(date: Date | string): number {
  return dayjs(date).daysInMonth()
}

export function getFirstDayOfWeek(date: Date | string): number {
  return dayjs(date).startOf('month').day()
}

export function parseDate(dateString: string): Date {
  return dayjs(dateString).toDate()
}

export function isToday(date: Date | string): boolean {
  return dayjs(date).isSame(dayjs(), 'day')
}

export function isSameMonth(date1: Date | string, date2: Date | string): boolean {
  return dayjs(date1).isSame(dayjs(date2), 'month')
}
