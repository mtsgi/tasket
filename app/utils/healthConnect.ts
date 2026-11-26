/**
 * Health Connect 連携ユーティリティ
 * Capacitorネイティブプラグインの呼び出しと、日次健康データの競合解決マージ・差分書き込み計算を提供します。
 */
import { Capacitor, registerPlugin } from '@capacitor/core'
import type { HealthData, HealthConnectSyncMetadata, SleepSession } from '~/types/item'
import {
  areSleepSessionsEqual,
  calculateTotalSleepHours,
  normalizeSleepSessionsForDate,
} from '~/utils/sleepSessions'

/**
 * Health Connect連携対象の7項目キー
 */
export type HealthConnectMetricKey
  = | 'steps'
    | 'sleep'
    | 'heartRate'
    | 'weight'
    | 'bodyFatPercentage'
    | 'waterIntake'
    | 'exerciseMinutes'

/**
 * スカラー値の連携項目キー（睡眠以外の6項目）
 */
export type HealthConnectScalarMetricKey = Exclude<HealthConnectMetricKey, 'sleep'>

export const HEALTH_CONNECT_METRICS: HealthConnectMetricKey[] = [
  'steps',
  'sleep',
  'heartRate',
  'weight',
  'bodyFatPercentage',
  'waterIntake',
  'exerciseMinutes',
]

export const HEALTH_CONNECT_SCALAR_METRICS: HealthConnectScalarMetricKey[] = [
  'steps',
  'heartRate',
  'weight',
  'bodyFatPercentage',
  'waterIntake',
  'exerciseMinutes',
]

/**
 * 項目ごとの読み取り・書き込み権限状態
 */
export interface MetricPermissionState {
  read: boolean
  write: boolean
}

export type HealthConnectPermissionsMap = Record<HealthConnectMetricKey, MetricPermissionState>

/**
 * Health Connect利用可否ステータス
 */
export interface HealthConnectAvailabilityResult {
  available: boolean
  status: 'available' | 'provider_update_required' | 'unavailable'
  platform: string
}

/**
 * Health Connect権限確認結果
 */
export interface HealthConnectPermissionsResult {
  permissions: HealthConnectPermissionsMap
  allGranted: boolean
  anyReadGranted: boolean
  anyWriteGranted: boolean
}

/**
 * Health Connectから取得した1日分の集計データ
 */
export interface HealthConnectDailyPayload {
  date: string
  steps?: number
  sleepHours?: number
  sleepSessions?: SleepSession[]
  heartRate?: number
  weight?: number
  bodyFatPercentage?: number
  waterIntake?: number
  exerciseMinutes?: number
}

/**
 * Health Connectから期間取得した結果
 */
export interface HealthConnectDateRangeResult {
  days: HealthConnectDailyPayload[]
}

/**
 * Health Connectへ書き込む1日分のデータ
 */
export interface HealthConnectWritePayload {
  steps?: number
  sleepSessions?: SleepSession[]
  heartRate?: number
  weight?: number
  bodyFatPercentage?: number
  waterIntake?: number
  exerciseMinutes?: number
}

/**
 * Health Connectへの書き込み結果
 */
export interface HealthConnectWriteResult {
  writtenFields: HealthConnectMetricKey[]
  skippedPermissionFields: HealthConnectMetricKey[]
}

/**
 * ネイティブファイルエクスポート結果
 */
export interface NativeFileExportResult {
  saved: boolean
  uri?: string
}

/**
 * Capacitorネイティブプラグインのインターフェース定義
 */
export interface HealthConnectPluginInterface {
  isAvailable(): Promise<HealthConnectAvailabilityResult>
  checkPermissions(): Promise<HealthConnectPermissionsResult>
  requestPermissions(): Promise<HealthConnectPermissionsResult>
  openHealthConnectSettings(): Promise<void>
  readDailyData(options: { date: string }): Promise<HealthConnectDailyPayload>
  readDateRangeData(options: { startDate: string, endDate: string }): Promise<HealthConnectDateRangeResult>
  writeDailyData(options: { date: string, data: HealthConnectWritePayload }): Promise<HealthConnectWriteResult>
  exportFile(options: { filename: string, content: string, mimeType: string }): Promise<NativeFileExportResult>
}

const HealthConnectNativePlugin = registerPlugin<HealthConnectPluginInterface>('HealthConnect')

/**
 * 現在の実行環境がCapacitorのネイティブアプリかどうかを判定
 */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform()
  }
  catch {
    return false
  }
}

/**
 * 現在の実行環境がAndroidネイティブアプリかどうかを判定
 */
export function isAndroidNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
  }
  catch {
    return false
  }
}

/**
 * デフォルトの空権限マップを生成
 */
export function createEmptyPermissionsMap(): HealthConnectPermissionsMap {
  return {
    steps: { read: false, write: false },
    sleep: { read: false, write: false },
    heartRate: { read: false, write: false },
    weight: { read: false, write: false },
    bodyFatPercentage: { read: false, write: false },
    waterIntake: { read: false, write: false },
    exerciseMinutes: { read: false, write: false },
  }
}

/**
 * Health Connectの利用可否を取得（Web/PWA環境では安全にunavailableを返す）
 */
export async function checkHealthConnectAvailability(): Promise<HealthConnectAvailabilityResult> {
  if (!isAndroidNativeApp()) {
    return {
      available: false,
      status: 'unavailable',
      platform: Capacitor.getPlatform?.() || 'web',
    }
  }

  try {
    return await HealthConnectNativePlugin.isAvailable()
  }
  catch (error) {
    console.error('Failed to check Health Connect availability:', error)
    return {
      available: false,
      status: 'unavailable',
      platform: 'android',
    }
  }
}

/**
 * Health Connectの現在の権限状態を取得
 */
export async function getHealthConnectPermissions(): Promise<HealthConnectPermissionsResult> {
  if (!isAndroidNativeApp()) {
    return {
      permissions: createEmptyPermissionsMap(),
      allGranted: false,
      anyReadGranted: false,
      anyWriteGranted: false,
    }
  }

  return await HealthConnectNativePlugin.checkPermissions()
}

/**
 * Health Connectのアクセス権限をユーザーに要求
 */
export async function requestHealthConnectPermissions(): Promise<HealthConnectPermissionsResult> {
  if (!isAndroidNativeApp()) {
    return {
      permissions: createEmptyPermissionsMap(),
      allGranted: false,
      anyReadGranted: false,
      anyWriteGranted: false,
    }
  }

  return await HealthConnectNativePlugin.requestPermissions()
}

/**
 * Health Connectアプリの設定画面を開く
 */
export async function openHealthConnectSettings(): Promise<void> {
  if (!isAndroidNativeApp()) {
    return
  }
  await HealthConnectNativePlugin.openHealthConnectSettings()
}

/**
 * 指定日（YYYY-MM-DD）の健康データをHealth Connectから読み取る
 */
export async function readHealthConnectDailyData(date: string): Promise<HealthConnectDailyPayload> {
  if (!isAndroidNativeApp()) {
    throw new Error('Health Connect is only available on Android app')
  }
  return await HealthConnectNativePlugin.readDailyData({ date })
}

/**
 * 指定期間（startDate〜endDate）の健康データをHealth Connectから一括読み取る
 */
export async function readHealthConnectDateRangeData(
  startDate: string,
  endDate: string,
): Promise<HealthConnectDailyPayload[]> {
  if (!isAndroidNativeApp()) {
    throw new Error('Health Connect is only available on Android app')
  }
  const result = await HealthConnectNativePlugin.readDateRangeData({ startDate, endDate })
  return result.days || []
}

/**
 * 指定日（YYYY-MM-DD）の健康データをHealth Connectへ書き込む
 */
export async function writeHealthConnectDailyData(
  date: string,
  data: HealthConnectWritePayload,
): Promise<HealthConnectWriteResult> {
  if (!isAndroidNativeApp()) {
    throw new Error('Health Connect is only available on Android app')
  }
  return await HealthConnectNativePlugin.writeDailyData({ date, data })
}

/**
 * Androidネイティブ環境でのファイル保存/共有を実行
 */
export async function exportFileOnAndroid(
  filename: string,
  content: string,
  mimeType: string,
): Promise<boolean> {
  if (!isAndroidNativeApp()) {
    return false
  }
  const result = await HealthConnectNativePlugin.exportFile({ filename, content, mimeType })
  return result.saved
}

/**
 * Health Connectから取得した1日分のデータをTasketの既存HealthDataにマージする
 * ルール:
 * - 項目単位で判定し、Tasket側が未入力（undefined）または前回HC同期値（healthConnectSync）と同じ項目のみHC最新値で更新
 * - Tasket側で手動入力・編集済みの項目は保護し、勝手に上書きしない
 * - 対象7項目以外の既存フィールド（筋肉量、内臓脂肪、体調メモ等）はすべてそのまま保持する
 */
export function mergeHealthConnectDailyData(
  existing: HealthData | undefined,
  incoming: HealthConnectDailyPayload,
  date: string,
): {
  mergedData: Partial<HealthData> & { date: string }
  updatedFields: HealthConnectMetricKey[]
  skippedManualFields: HealthConnectMetricKey[]
  hasChanges: boolean
} {
  const prevSync: HealthConnectSyncMetadata = {
    ...(existing?.healthConnectSync || {}),
  }

  const mergedData: Partial<HealthData> & { date: string } = {
    ...(existing || {}),
    date,
  }

  const updatedFields: HealthConnectMetricKey[] = []
  const skippedManualFields: HealthConnectMetricKey[] = []

  // スカラー6項目のマージ判定
  for (const field of HEALTH_CONNECT_SCALAR_METRICS) {
    const incomingVal = incoming[field]
    if (typeof incomingVal !== 'number' || Number.isNaN(incomingVal)) {
      continue
    }

    const currentVal = existing?.[field]
    const lastSyncedVal = prevSync[field]
    const isUnmodifiedInTasket = currentVal === undefined || currentVal === lastSyncedVal

    if (isUnmodifiedInTasket) {
      const valueChanged = currentVal !== incomingVal || prevSync[field] !== incomingVal
      mergedData[field] = incomingVal
      prevSync[field] = incomingVal
      if (valueChanged) {
        updatedFields.push(field)
      }
    }
    else {
      skippedManualFields.push(field)
    }
  }

  // 睡眠（sleepSessions / sleepHours）のマージ判定
  const incomingSessions = normalizeSleepSessionsForDate(date, incoming.sleepSessions)
  const incomingSleepHours = incomingSessions.length > 0
    ? calculateTotalSleepHours(incomingSessions, date)
    : (typeof incoming.sleepHours === 'number' && !Number.isNaN(incoming.sleepHours) ? incoming.sleepHours : undefined)

  if (incomingSessions.length > 0 || incomingSleepHours !== undefined) {
    const currentSessions = existing?.sleepSessions
    const currentHours = existing?.sleepHours
    const hasExistingSleep = (currentSessions && currentSessions.length > 0) || currentHours !== undefined

    const isSleepUnmodifiedInTasket = !hasExistingSleep || (
      currentHours === prevSync.sleepHours
      && areSleepSessionsEqual(currentSessions, prevSync.sleepSessions)
    )

    if (isSleepUnmodifiedInTasket) {
      const sessionsChanged = !areSleepSessionsEqual(currentSessions, incomingSessions)
      const hoursChanged = currentHours !== incomingSleepHours

      if (incomingSessions.length > 0) {
        mergedData.sleepSessions = incomingSessions
        prevSync.sleepSessions = incomingSessions
      }
      if (incomingSleepHours !== undefined) {
        mergedData.sleepHours = incomingSleepHours
        prevSync.sleepHours = incomingSleepHours
      }

      if (sessionsChanged || hoursChanged) {
        updatedFields.push('sleep')
      }
    }
    else {
      skippedManualFields.push('sleep')
    }
  }

  prevSync.syncedAt = new Date().toISOString()
  mergedData.healthConnectSync = prevSync

  return {
    mergedData,
    updatedFields,
    skippedManualFields,
    hasChanges: updatedFields.length > 0,
  }
}

/**
 * Tasketの健康データからHealth Connectへ書き込むべき差分ペイロードを構築する
 * ルール:
 * - 新規入力された項目、または前回HC同期値（healthConnectSync）から変更された項目のみ書き込む
 * - 睡眠（sleep）は sleepSessions（開始・終了時刻）が1件以上入力されている場合のみ書き込む（sleepHours単独では書き込まない）
 */
export function buildHealthConnectWritePayload(
  healthData: Partial<HealthData> & { date: string },
  previousSync?: HealthConnectSyncMetadata,
): {
  payload: HealthConnectWritePayload
  targetFields: HealthConnectMetricKey[]
} {
  const syncMeta = previousSync ?? healthData.healthConnectSync
  const payload: HealthConnectWritePayload = {}
  const targetFields: HealthConnectMetricKey[] = []

  for (const field of HEALTH_CONNECT_SCALAR_METRICS) {
    const value = healthData[field]
    if (typeof value === 'number' && !Number.isNaN(value) && value >= 0) {
      if (value !== syncMeta?.[field]) {
        payload[field] = value
        targetFields.push(field)
      }
    }
  }

  // 睡眠は sleepSessions（開始・終了時刻）がある場合のみ書き込み対象にする
  const normalizedSessions = normalizeSleepSessionsForDate(healthData.date, healthData.sleepSessions)
  if (normalizedSessions.length > 0) {
    if (!areSleepSessionsEqual(normalizedSessions, syncMeta?.sleepSessions)) {
      payload.sleepSessions = normalizedSessions
      targetFields.push('sleep')
    }
  }

  return {
    payload,
    targetFields,
  }
}

/**
 * Health Connectへの書き込み成功後に同期メタデータ（healthConnectSync）を更新する
 */
export function applyWrittenFieldsToSyncMetadata(
  healthData: Partial<HealthData> & { date: string },
  writtenFields: HealthConnectMetricKey[],
  writtenPayload: HealthConnectWritePayload,
): HealthConnectSyncMetadata {
  const nextSync: HealthConnectSyncMetadata = {
    ...(healthData.healthConnectSync || {}),
    syncedAt: new Date().toISOString(),
  }

  for (const field of writtenFields) {
    if (field === 'sleep') {
      if (writtenPayload.sleepSessions) {
        nextSync.sleepSessions = writtenPayload.sleepSessions
        nextSync.sleepHours = calculateTotalSleepHours(writtenPayload.sleepSessions, healthData.date) ?? healthData.sleepHours
      }
    }
    else {
      const val = writtenPayload[field]
      if (val !== undefined) {
        nextSync[field] = val
      }
    }
  }

  return nextSync
}
