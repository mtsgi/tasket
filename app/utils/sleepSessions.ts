/**
 * 睡眠セッション計算・フォーマットユーティリティ
 * 複数件の睡眠セッション（開始時刻・終了時刻）と睡眠時間（sleepHours）の相互変換を提供します。
 */
import dayjs from 'dayjs'
import type { SleepSession } from '~/types/item'

const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

/**
 * ISO日時文字列またはHH:mm文字列から表示・フォーム入力用のHH:mm文字列を抽出
 * @param value - ISO 8601日時文字列またはHH:mm形式の文字列
 * @returns HH:mm形式の文字列（無効な場合は空文字）
 */
export function extractTimeHHmm(value: string | undefined | null): string {
  if (!value) {
    return ''
  }
  const trimmed = value.trim()
  if (HH_MM_PATTERN.test(trimmed)) {
    return trimmed
  }
  const parsed = dayjs(trimmed)
  if (!parsed.isValid()) {
    return ''
  }
  return parsed.format('HH:mm')
}

/**
 * 対象日（YYYY-MM-DD）と開始・終了時刻（HH:mmまたはISO文字列）から正規化されたSleepSessionを生成
 * 開始時刻 > 終了時刻（例: 23:30 〜 07:00）の場合は「前日の開始時刻 〜 当日の終了時刻」として扱う
 * @param date - 記録日（YYYY-MM-DD形式）
 * @param startInput - 開始時刻（HH:mmまたはISO日時）
 * @param endInput - 終了時刻（HH:mmまたはISO日時）
 * @returns 正規化されたSleepSession（ISO 8601形式）、または無効な場合はnull
 */
export function resolveSleepSessionToIso(
  date: string,
  startInput: string,
  endInput: string,
): SleepSession | null {
  if (!date || !startInput || !endInput) {
    return null
  }

  const trimmedStart = startInput.trim()
  const trimmedEnd = endInput.trim()

  const startMatch = HH_MM_PATTERN.exec(trimmedStart)
  const endMatch = HH_MM_PATTERN.exec(trimmedEnd)

  if (startMatch && endMatch) {
    const startHour = Number(startMatch[1])
    const startMinute = Number(startMatch[2])
    const endHour = Number(endMatch[1])
    const endMinute = Number(endMatch[2])

    const startTotalMinutes = startHour * 60 + startMinute
    const endTotalMinutes = endHour * 60 + endMinute

    // 同じ時刻の場合は時間0となるため無効
    if (startTotalMinutes === endTotalMinutes) {
      return null
    }

    const baseDate = dayjs(date)
    if (!baseDate.isValid()) {
      return null
    }

    // 開始時刻 > 終了時刻の場合は前日就寝〜当日起床として扱う
    const startDate = startTotalMinutes > endTotalMinutes
      ? baseDate.subtract(1, 'day')
      : baseDate

    const startDateTime = startDate.hour(startHour).minute(startMinute).second(0).millisecond(0)
    const endDateTime = baseDate.hour(endHour).minute(endMinute).second(0).millisecond(0)

    return {
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
    }
  }

  // 既にISO日時文字列の場合
  const parsedStart = dayjs(trimmedStart)
  const parsedEnd = dayjs(trimmedEnd)
  if (!parsedStart.isValid() || !parsedEnd.isValid()) {
    return null
  }
  if (parsedEnd.diff(parsedStart, 'minute') <= 0) {
    return null
  }

  return {
    startTime: parsedStart.toISOString(),
    endTime: parsedEnd.toISOString(),
  }
}

/**
 * 単一の睡眠セッションの時間（分）を計算
 * @param session - 睡眠セッション
 * @param date - HH:mm形式で格納されている場合の基準日（YYYY-MM-DD）
 * @returns 睡眠時間（分、無効な場合は0）
 */
export function calculateSleepSessionMinutes(session: SleepSession, date?: string): number {
  const resolved = date
    ? resolveSleepSessionToIso(date, session.startTime, session.endTime)
    : (() => {
        const start = dayjs(session.startTime)
        const end = dayjs(session.endTime)
        if (!start.isValid() || !end.isValid() || end.diff(start, 'minute') <= 0) {
          return null
        }
        return { startTime: start.toISOString(), endTime: end.toISOString() }
      })()

  if (!resolved) {
    return 0
  }

  const minutes = dayjs(resolved.endTime).diff(dayjs(resolved.startTime), 'minute')
  return minutes > 0 ? minutes : 0
}

/**
 * 複数の睡眠セッションから合計睡眠時間（時間・小数第1位）を計算
 * @param sessions - 睡眠セッションの配列
 * @param date - HH:mm形式で格納されている場合の基準日（YYYY-MM-DD）
 * @returns 合計睡眠時間（時間・小数第1位）、または有効なセッションがない場合はundefined
 */
export function calculateTotalSleepHours(
  sessions: SleepSession[] | undefined | null,
  date?: string,
): number | undefined {
  if (!sessions || sessions.length === 0) {
    return undefined
  }

  let totalMinutes = 0
  let validCount = 0

  for (const session of sessions) {
    const minutes = calculateSleepSessionMinutes(session, date)
    if (minutes > 0) {
      totalMinutes += minutes
      validCount++
    }
  }

  if (validCount === 0 || totalMinutes <= 0) {
    return undefined
  }

  return Math.round((totalMinutes / 60) * 10) / 10
}

/**
 * フォーム入力配列を正規化されたSleepSession配列に変換
 * 未入力・無効な行は除外する
 * @param date - 記録日（YYYY-MM-DD形式）
 * @param draftSessions - フォーム入力中の睡眠セッション配列
 * @returns 正規化されたSleepSession配列
 */
export function normalizeSleepSessionsForDate(
  date: string,
  draftSessions: SleepSession[] | undefined | null,
): SleepSession[] {
  if (!draftSessions || draftSessions.length === 0) {
    return []
  }

  const normalized: SleepSession[] = []
  for (const draft of draftSessions) {
    const resolved = resolveSleepSessionToIso(date, draft.startTime, draft.endTime)
    if (resolved) {
      normalized.push(resolved)
    }
  }
  return normalized
}

/**
 * 単一の睡眠セッションを表示用の「HH:mm〜HH:mm」形式にフォーマット
 * @param session - 睡眠セッション
 * @returns フォーマットされた時間帯文字列
 */
export function formatSleepSessionRange(session: SleepSession): string {
  const start = extractTimeHHmm(session.startTime)
  const end = extractTimeHHmm(session.endTime)
  if (!start || !end) {
    return ''
  }
  return `${start}〜${end}`
}

/**
 * 睡眠セッション配列を日次サマリー表示用の文字列（例: "23:30〜07:00" または "23:30〜07:00 / 13:00〜14:00"）にフォーマット
 * @param sessions - 睡眠セッション配列
 * @returns フォーマットされた文字列
 */
export function formatSleepSessionsSummary(sessions: SleepSession[] | undefined | null): string {
  if (!sessions || sessions.length === 0) {
    return ''
  }

  return sessions
    .map(formatSleepSessionRange)
    .filter(Boolean)
    .join(' / ')
}

/**
 * 2つの睡眠セッション配列が同じ内容かどうかを判定
 * @param a - 比較対象の睡眠セッション配列A
 * @param b - 比較対象の睡眠セッション配列B
 * @returns 同一内容であればtrue
 */
export function areSleepSessionsEqual(
  a: SleepSession[] | undefined | null,
  b: SleepSession[] | undefined | null,
): boolean {
  const listA = a ?? []
  const listB = b ?? []

  if (listA.length !== listB.length) {
    return false
  }

  for (let i = 0; i < listA.length; i++) {
    const itemA = listA[i]
    const itemB = listB[i]
    if (!itemA || !itemB) {
      return false
    }
    const startA = dayjs(itemA.startTime).isValid() ? dayjs(itemA.startTime).toISOString() : itemA.startTime
    const endA = dayjs(itemA.endTime).isValid() ? dayjs(itemA.endTime).toISOString() : itemA.endTime
    const startB = dayjs(itemB.startTime).isValid() ? dayjs(itemB.startTime).toISOString() : itemB.startTime
    const endB = dayjs(itemB.endTime).isValid() ? dayjs(itemB.endTime).toISOString() : itemB.endTime
    if (startA !== startB || endA !== endB) {
      return false
    }
  }

  return true
}
