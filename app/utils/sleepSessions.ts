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

  // 既にISO日時文字列の場合（秒・ミリ秒精度をそのまま保持）
  const parsedStart = dayjs(trimmedStart)
  const parsedEnd = dayjs(trimmedEnd)
  if (!parsedStart.isValid() || !parsedEnd.isValid()) {
    return null
  }
  if (parsedEnd.valueOf() <= parsedStart.valueOf()) {
    return null
  }

  return {
    startTime: parsedStart.toISOString(),
    endTime: parsedEnd.toISOString(),
  }
}

/**
 * 保存済みの睡眠セッション配列からフォーム入力用のドラフト配列を生成
 * 表示用には HH:mm を設定し、未編集時の秒以下精度・由来メタデータ維持のため originalStartTime / originalEndTime 等を保持する
 */
export function createSleepSessionDrafts(
  sessions: SleepSession[] | undefined | null,
): SleepSession[] {
  if (!sessions || sessions.length === 0) {
    return []
  }

  return sessions.map((session) => {
    const displayStart = extractTimeHHmm(session.startTime)
    const displayEnd = extractTimeHHmm(session.endTime)
    const isIsoStart = !HH_MM_PATTERN.test(session.startTime.trim()) && dayjs(session.startTime).isValid()
    const isIsoEnd = !HH_MM_PATTERN.test(session.endTime.trim()) && dayjs(session.endTime).isValid()

    return {
      ...session,
      startTime: displayStart,
      endTime: displayEnd,
      originalStartTime: session.originalStartTime ?? (isIsoStart ? dayjs(session.startTime).toISOString() : undefined),
      originalEndTime: session.originalEndTime ?? (isIsoEnd ? dayjs(session.endTime).toISOString() : undefined),
    }
  })
}

/**
 * 単一の睡眠セッションをミリ秒区間 [startMs, endMs] に解決
 */
export function resolveSleepSessionIntervalMs(
  session: SleepSession,
  date?: string,
): { startMs: number, endMs: number } | null {
  if (!session?.startTime || !session?.endTime) {
    return null
  }

  const trimmedStart = session.startTime.trim()
  const trimmedEnd = session.endTime.trim()

  // 未編集の元ISO日時があり、かつ表示用HH:mmと一致している場合は元ISO日時の精度を使用
  if (
    session.originalStartTime
    && session.originalEndTime
    && extractTimeHHmm(session.originalStartTime) === extractTimeHHmm(trimmedStart)
    && extractTimeHHmm(session.originalEndTime) === extractTimeHHmm(trimmedEnd)
  ) {
    const origStart = dayjs(session.originalStartTime)
    const origEnd = dayjs(session.originalEndTime)
    if (origStart.isValid() && origEnd.isValid() && origEnd.valueOf() > origStart.valueOf()) {
      return {
        startMs: origStart.valueOf(),
        endMs: origEnd.valueOf(),
      }
    }
  }

  const resolved = date
    ? resolveSleepSessionToIso(date, trimmedStart, trimmedEnd)
    : (() => {
        const start = dayjs(trimmedStart)
        const end = dayjs(trimmedEnd)
        if (!start.isValid() || !end.isValid() || end.valueOf() <= start.valueOf()) {
          return null
        }
        return { startTime: start.toISOString(), endTime: end.toISOString() }
      })()

  if (!resolved) {
    return null
  }

  const startMs = dayjs(resolved.startTime).valueOf()
  const endMs = dayjs(resolved.endTime).valueOf()
  return endMs > startMs ? { startMs, endMs } : null
}

/**
 * 重複する睡眠時間帯（オーバーラップ区間）をマージして互いに素な区間リストを返す
 */
export function mergeOverlappingSleepIntervals(
  intervals: Array<{ startMs: number, endMs: number }>,
): Array<{ startMs: number, endMs: number }> {
  const valid = intervals
    .filter(interval => interval.endMs > interval.startMs)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)

  if (valid.length === 0) {
    return []
  }

  const merged: Array<{ startMs: number, endMs: number }> = [
    { startMs: valid[0]!.startMs, endMs: valid[0]!.endMs },
  ]

  for (let i = 1; i < valid.length; i++) {
    const next = valid[i]!
    const current = merged[merged.length - 1]!
    if (next.startMs < current.endMs) {
      current.endMs = Math.max(current.endMs, next.endMs)
    }
    else {
      merged.push({ startMs: next.startMs, endMs: next.endMs })
    }
  }

  return merged
}

/**
 * 単一の睡眠セッションの時間（分）を計算
 * @param session - 睡眠セッション
 * @param date - HH:mm形式で格納されている場合の基準日（YYYY-MM-DD）
 * @returns 睡眠時間（分、無効な場合は0）
 */
export function calculateSleepSessionMinutes(session: SleepSession, date?: string): number {
  const interval = resolveSleepSessionIntervalMs(session, date)
  if (!interval) {
    return 0
  }

  const minutes = Math.round((interval.endMs - interval.startMs) / 60000)
  return minutes > 0 ? minutes : 0
}

/**
 * 複数の睡眠セッションから合計睡眠時間（時間・小数第1位）を計算
 * 重複する睡眠時間帯がある場合は区間マージして二重計上を防止し、秒以下の精度も考慮する
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

  const intervals: Array<{ startMs: number, endMs: number }> = []
  for (const session of sessions) {
    const interval = resolveSleepSessionIntervalMs(session, date)
    if (interval) {
      intervals.push(interval)
    }
  }

  const merged = mergeOverlappingSleepIntervals(intervals)
  if (merged.length === 0) {
    return undefined
  }

  const totalMs = merged.reduce((sum, item) => sum + (item.endMs - item.startMs), 0)
  if (totalMs <= 0) {
    return undefined
  }

  const rounded = Math.round((totalMs / 3600000) * 10) / 10
  return rounded > 0 ? rounded : undefined
}

/**
 * フォーム入力配列またはHealth Connect取得配列を正規化されたSleepSession配列に変換
 * - 未入力・無効な行は除外する
 * - 未編集のセッション（表示用HH:mmがoriginalStartTime/originalEndTimeのHH:mmと一致）は秒以下の精度と由来メタデータを維持する
 * - 他アプリ由来（source === 'external'）のセッションがフォームで時刻変更された場合は source: 'manual'（ローカル編集）へ遷移させ、Health Connectへの重複書き戻しを防ぐ
 * @param date - 記録日（YYYY-MM-DD形式）
 * @param draftSessions - フォーム入力中または取得した睡眠セッション配列
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
    if (!draft?.startTime || !draft?.endTime) {
      continue
    }
    const trimmedStart = draft.startTime.trim()
    const trimmedEnd = draft.endTime.trim()

    // 1. すでにISO日時が直接入っており、originalStartTime等がない場合
    const isDirectIso = !HH_MM_PATTERN.test(trimmedStart) && !HH_MM_PATTERN.test(trimmedEnd)
    if (isDirectIso) {
      const parsedStart = dayjs(trimmedStart)
      const parsedEnd = dayjs(trimmedEnd)
      if (parsedStart.isValid() && parsedEnd.isValid() && parsedEnd.valueOf() > parsedStart.valueOf()) {
        const entry: SleepSession = {
          startTime: parsedStart.toISOString(),
          endTime: parsedEnd.toISOString(),
        }
        if (draft.id !== undefined) entry.id = draft.id
        if (draft.clientRecordId !== undefined) entry.clientRecordId = draft.clientRecordId
        if (draft.clientRecordVersion !== undefined) entry.clientRecordVersion = draft.clientRecordVersion
        if (draft.dataOrigin !== undefined) entry.dataOrigin = draft.dataOrigin
        if (draft.source !== undefined) entry.source = draft.source
        normalized.push(entry)
      }
      continue
    }

    // 2. フォームドラフトで originalStartTime / originalEndTime が保持されており、HH:mm が未変更の場合
    if (
      draft.originalStartTime
      && draft.originalEndTime
      && extractTimeHHmm(draft.originalStartTime) === extractTimeHHmm(trimmedStart)
      && extractTimeHHmm(draft.originalEndTime) === extractTimeHHmm(trimmedEnd)
    ) {
      const origStart = dayjs(draft.originalStartTime)
      const origEnd = dayjs(draft.originalEndTime)
      if (origStart.isValid() && origEnd.isValid() && origEnd.valueOf() > origStart.valueOf()) {
        const entry: SleepSession = {
          startTime: origStart.toISOString(),
          endTime: origEnd.toISOString(),
        }
        if (draft.id !== undefined) entry.id = draft.id
        if (draft.clientRecordId !== undefined) entry.clientRecordId = draft.clientRecordId
        if (draft.clientRecordVersion !== undefined) entry.clientRecordVersion = draft.clientRecordVersion
        if (draft.dataOrigin !== undefined) entry.dataOrigin = draft.dataOrigin
        if (draft.source !== undefined) entry.source = draft.source
        normalized.push(entry)
        continue
      }
    }

    // 3. 新規追加または時刻（HH:mm）が編集された場合
    const resolved = resolveSleepSessionToIso(date, trimmedStart, trimmedEnd)
    if (resolved) {
      const entry: SleepSession = {
        startTime: resolved.startTime,
        endTime: resolved.endTime,
      }
      if (draft.source === 'external') {
        // 他アプリ由来のセッションを手動編集した場合はローカル優先セッション('manual')へ遷移
        entry.source = 'manual'
        if (draft.dataOrigin !== undefined) {
          entry.dataOrigin = draft.dataOrigin
        }
      }
      else if (draft.source === 'manual') {
        entry.source = 'manual'
        if (draft.dataOrigin !== undefined) {
          entry.dataOrigin = draft.dataOrigin
        }
      }
      else {
        if (draft.source !== undefined) {
          entry.source = draft.source
        }
        if (draft.clientRecordId !== undefined) {
          entry.clientRecordId = draft.clientRecordId
        }
        if (draft.clientRecordVersion !== undefined) {
          entry.clientRecordVersion = draft.clientRecordVersion
        }
        if (draft.dataOrigin !== undefined) {
          entry.dataOrigin = draft.dataOrigin
        }
      }
      normalized.push(entry)
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
 * 2つの睡眠セッション配列が同じ内容かどうかを判定（ミリ秒精度および由来種別を含む）
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
    const sourceA = itemA.source ?? 'tasket'
    const sourceB = itemB.source ?? 'tasket'
    if (startA !== startB || endA !== endB || sourceA !== sourceB) {
      return false
    }
  }

  return true
}
