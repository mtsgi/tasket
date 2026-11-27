/**
 * Health Connect 連携ユーティリティ
 * Capacitorネイティブプラグインの呼び出しと、日次健康データの競合解決マージ・差分書き込み計算を提供します。
 */
import { Capacitor, registerPlugin } from '@capacitor/core'
import type {
  HealthData,
  HealthConnectMetricValueMap,
  HealthConnectSyncMetadata,
  SleepSession,
} from '~/types/item'
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

/**
 * 加算・累積型の連携項目キー（他アプリ記録との差分書き込み対象）
 */
export type HealthConnectAdditiveMetricKey = 'steps' | 'waterIntake' | 'exerciseMinutes'

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

export const HEALTH_CONNECT_ADDITIVE_METRICS: HealthConnectAdditiveMetricKey[] = [
  'steps',
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
 * Health Connectから取得した1日分の集計データおよびステータス情報
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
  /** 他アプリ（DataOrigin != Tasket）由来の項目別集計値 */
  externalValues?: HealthConnectMetricValueMap
  /** Tasket自身（DataOrigin == Tasket）由来の項目別集計値 */
  tasketValues?: HealthConnectMetricValueMap
  /** 他アプリ由来の心拍数サンプルが存在するか */
  hasExternalHeartRate?: boolean
  /** TasketレコードのclientRecordVersionマップ */
  clientRecordVersions?: Partial<Record<HealthConnectMetricKey, number>>
  /** Tasketが作成済みの睡眠セッションclientRecordId一覧 */
  tasketSleepClientRecordIds?: string[]
  /** 読み取りに成功し値が存在した項目 */
  readFields?: HealthConnectMetricKey[]
  /** 読み取りに成功したが当日データが0件だった項目 */
  emptyFields?: HealthConnectMetricKey[]
  /** 読み取り権限が未許可のためスキップされた項目 */
  skippedPermissionFields?: HealthConnectMetricKey[]
  /** 読み取り中にエラーが発生した項目 */
  failedFields?: HealthConnectMetricKey[]
  /** 項目別のエラー詳細メッセージ */
  fieldErrors?: Partial<Record<HealthConnectMetricKey, string>>
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
  /** 前回同期時点で把握している他アプリ由来の集計値 */
  externalValues?: HealthConnectMetricValueMap
  /** 前回同期時点の項目別 clientRecordVersion */
  clientRecordVersions?: Partial<Record<HealthConnectMetricKey, number>>
  /** 前回同期時点でTasketが管理していた睡眠セッションclientRecordId一覧 */
  previousSleepClientRecordIds?: string[]
}

/**
 * Health Connectへの書き込み結果
 */
export interface HealthConnectWriteResult {
  writtenFields: HealthConnectMetricKey[]
  skippedPermissionFields: HealthConnectMetricKey[]
  invalidFields?: HealthConnectMetricKey[]
  localOnlyFields?: HealthConnectMetricKey[]
  failedFields?: HealthConnectMetricKey[]
  fieldErrors?: Partial<Record<HealthConnectMetricKey, string>>
  externalValues?: HealthConnectMetricValueMap
  tasketValues?: HealthConnectMetricValueMap
  clientRecordVersions?: Partial<Record<HealthConnectMetricKey, number>>
  tasketSleepClientRecordIds?: string[]
  pendingDeleteSleepClientRecordIds?: string[]
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

function isAdditiveMetric(field: HealthConnectScalarMetricKey): field is HealthConnectAdditiveMetricKey {
  return (HEALTH_CONNECT_ADDITIVE_METRICS as readonly string[]).includes(field)
}

/**
 * 睡眠セッションがTasketからHealth Connectへの書き込み対象（Tasket作成）かどうかを判定
 * 他アプリ由来（'external'）や他アプリ由来をローカル編集したもの（'manual'）は書き戻さない
 */
export function isTasketWritableSleepSession(session: SleepSession): boolean {
  const source = session.source ?? 'tasket'
  return source === 'tasket'
}

export interface MergeHealthConnectOptions {
  /** フォーム上で未保存のまま編集中の項目（上書き保護対象） */
  dirtyMetrics?: Iterable<HealthConnectMetricKey>
}

export interface MergeHealthConnectResult {
  mergedData: Partial<HealthData> & { date: string }
  updatedFields: HealthConnectMetricKey[]
  skippedManualFields: HealthConnectMetricKey[]
  skippedPermissionFields: HealthConnectMetricKey[]
  failedFields: HealthConnectMetricKey[]
  fieldErrors: Partial<Record<HealthConnectMetricKey, string>>
  hasChanges: boolean
  hasMetadataChanges: boolean
  allFailed: boolean
  allPermissionDenied: boolean
}

/**
 * Health Connectから取得した1日分のデータをTasketの既存HealthDataにマージする
 * ルール:
 * - 項目単位で判定し、Tasket側が未入力（undefined）または前回HC同期値（healthConnectSync）と同じ項目のみHC最新値で更新
 * - フォームで未保存編集中の項目（dirtyMetrics）およびTasket側で手動編集済みの項目は保護し、上書きしない
 * - 加算型項目で他アプリ由来合計より小さい値へ手動修正されていた場合もローカル上書きとして保護する
 * - 読み取り失敗項目（failedFields）や権限未許可項目（skippedPermissionFields）は同期済みとして扱わない
 */
export function mergeHealthConnectDailyData(
  existing: HealthData | undefined,
  incoming: HealthConnectDailyPayload,
  date: string,
  options?: MergeHealthConnectOptions,
): MergeHealthConnectResult {
  const dirtySet = new Set<HealthConnectMetricKey>(options?.dirtyMetrics ?? [])
  const failedFields: HealthConnectMetricKey[] = [...(incoming.failedFields ?? [])]
  const skippedPermissionFields: HealthConnectMetricKey[] = [...(incoming.skippedPermissionFields ?? [])]
  const fieldErrors: Partial<Record<HealthConnectMetricKey, string>> = { ...(incoming.fieldErrors ?? {}) }
  const failedSet = new Set<HealthConnectMetricKey>(failedFields)
  const skippedPermSet = new Set<HealthConnectMetricKey>(skippedPermissionFields)

  const hasExplicitStatus
    = incoming.readFields !== undefined
      || incoming.emptyFields !== undefined
      || incoming.failedFields !== undefined
      || incoming.skippedPermissionFields !== undefined

  const succeededReadCount = (incoming.readFields?.length ?? 0) + (incoming.emptyFields?.length ?? 0)
  const allPermissionDenied
    = hasExplicitStatus
      && skippedPermissionFields.length === HEALTH_CONNECT_METRICS.length
      && succeededReadCount === 0
      && failedFields.length === 0
  const allFailed
    = hasExplicitStatus
      && failedFields.length > 0
      && succeededReadCount === 0

  const prevSync: HealthConnectSyncMetadata = {
    ...(existing?.healthConnectSync || {}),
    externalValues: { ...(existing?.healthConnectSync?.externalValues || {}) },
    tasketValues: { ...(existing?.healthConnectSync?.tasketValues || {}) },
    clientRecordVersions: { ...(existing?.healthConnectSync?.clientRecordVersions || {}) },
  }

  const mergedData: Partial<HealthData> & { date: string } = {
    ...(existing || {}),
    date,
  }

  const updatedFields: HealthConnectMetricKey[] = []
  const skippedManualFields: HealthConnectMetricKey[] = []
  let hasMetadataChanges = false

  if (allFailed || allPermissionDenied) {
    return {
      mergedData,
      updatedFields,
      skippedManualFields,
      skippedPermissionFields,
      failedFields,
      fieldErrors,
      hasChanges: false,
      hasMetadataChanges: false,
      allFailed,
      allPermissionDenied,
    }
  }

  // 由来別メタデータ・バージョンの反映（読み取り失敗・権限不足の項目は除外）
  if (incoming.externalValues) {
    for (const field of HEALTH_CONNECT_SCALAR_METRICS) {
      if (failedSet.has(field) || skippedPermSet.has(field)) continue
      const extVal = incoming.externalValues[field]
      if (extVal !== undefined && prevSync.externalValues?.[field] !== extVal) {
        prevSync.externalValues![field] = extVal
        hasMetadataChanges = true
      }
    }
  }
  if (incoming.tasketValues) {
    for (const field of HEALTH_CONNECT_SCALAR_METRICS) {
      if (failedSet.has(field) || skippedPermSet.has(field)) continue
      const tasketVal = incoming.tasketValues[field]
      if (tasketVal !== undefined && prevSync.tasketValues?.[field] !== tasketVal) {
        prevSync.tasketValues![field] = tasketVal
        hasMetadataChanges = true
      }
    }
  }
  if (
    incoming.hasExternalHeartRate !== undefined
    && !failedSet.has('heartRate')
    && !skippedPermSet.has('heartRate')
    && prevSync.hasExternalHeartRate !== incoming.hasExternalHeartRate
  ) {
    prevSync.hasExternalHeartRate = incoming.hasExternalHeartRate
    hasMetadataChanges = true
  }
  if (incoming.clientRecordVersions) {
    for (const field of HEALTH_CONNECT_METRICS) {
      if (failedSet.has(field) || skippedPermSet.has(field)) continue
      const ver = incoming.clientRecordVersions[field]
      if (typeof ver === 'number' && ver > (prevSync.clientRecordVersions?.[field] ?? 0)) {
        prevSync.clientRecordVersions![field] = ver
        hasMetadataChanges = true
      }
    }
  }
  if (
    incoming.tasketSleepClientRecordIds !== undefined
    && !failedSet.has('sleep')
    && !skippedPermSet.has('sleep')
  ) {
    prevSync.tasketSleepClientRecordIds = [...incoming.tasketSleepClientRecordIds]
    hasMetadataChanges = true
  }

  // スカラー6項目のマージ判定
  for (const field of HEALTH_CONNECT_SCALAR_METRICS) {
    if (failedSet.has(field) || skippedPermSet.has(field)) {
      continue
    }

    const incomingVal = incoming[field]
    if (typeof incomingVal !== 'number' || Number.isNaN(incomingVal)) {
      continue
    }

    if (dirtySet.has(field)) {
      skippedManualFields.push(field)
      continue
    }

    const currentVal = existing?.[field]
    const lastSyncedVal = prevSync[field]
    const prevExternalVal = existing?.healthConnectSync?.externalValues?.[field]

    // 加算型項目で他アプリ由来合計より小さい値へ手動修正されていた場合はローカル優先値として保護
    const isAdditiveLocalReduction
      = isAdditiveMetric(field)
        && currentVal !== undefined
        && prevExternalVal !== undefined
        && currentVal < prevExternalVal

    const isUnmodifiedInTasket
      = !isAdditiveLocalReduction
        && (currentVal === undefined || currentVal === lastSyncedVal)

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
  if (!failedSet.has('sleep') && !skippedPermSet.has('sleep')) {
    const incomingSessions = normalizeSleepSessionsForDate(date, incoming.sleepSessions)
    const incomingSleepHours = incomingSessions.length > 0
      ? calculateTotalSleepHours(incomingSessions, date)
      : (typeof incoming.sleepHours === 'number' && !Number.isNaN(incoming.sleepHours) ? incoming.sleepHours : undefined)

    if (incomingSessions.length > 0 || incomingSleepHours !== undefined) {
      if (dirtySet.has('sleep')) {
        skippedManualFields.push('sleep')
      }
      else {
        const currentSessions = existing?.sleepSessions
        const currentHours = existing?.sleepHours
        const hasExistingSleep = (currentSessions && currentSessions.length > 0) || currentHours !== undefined
        const hasManualEditedExternalSession = (currentSessions ?? []).some(s => s.source === 'manual')

        const isSleepUnmodifiedInTasket
          = !hasManualEditedExternalSession
            && (
              !hasExistingSleep
              || (
                currentHours === prevSync.sleepHours
                && areSleepSessionsEqual(currentSessions, prevSync.sleepSessions)
              )
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
    }
  }

  prevSync.syncedAt = new Date().toISOString()
  mergedData.healthConnectSync = prevSync

  return {
    mergedData,
    updatedFields,
    skippedManualFields,
    skippedPermissionFields,
    failedFields,
    fieldErrors,
    hasChanges: updatedFields.length > 0,
    hasMetadataChanges,
    allFailed,
    allPermissionDenied,
  }
}

/**
 * Tasketの健康データからHealth Connectへ書き込むべき差分ペイロードを構築する
 * ルール:
 * - 新規入力された項目、または前回HC同期値（healthConnectSync）から変更された項目のみ書き込む
 * - 心拍数（heartRate）は他アプリ由来の記録が存在する日（hasExternalHeartRate === true）はHCへ書き込まずローカル優先保持とする
 * - 睡眠（sleep）は Tasket由来の sleepSessions（source !== 'external' && source !== 'manual'）の追加・変更・全削除がある場合、または前回削除未完了のセッションがある場合に書き込む
 */
export function buildHealthConnectWritePayload(
  healthData: Partial<HealthData> & { date: string },
  previousSync?: HealthConnectSyncMetadata,
): {
  payload: HealthConnectWritePayload
  targetFields: HealthConnectMetricKey[]
  localOnlyFields: HealthConnectMetricKey[]
} {
  const syncMeta = previousSync ?? healthData.healthConnectSync
  const payload: HealthConnectWritePayload = {}
  const targetFields: HealthConnectMetricKey[] = []
  const localOnlyFields: HealthConnectMetricKey[] = []

  for (const field of HEALTH_CONNECT_SCALAR_METRICS) {
    const value = healthData[field]
    if (typeof value === 'number' && !Number.isNaN(value) && value >= 0) {
      if (value !== syncMeta?.[field]) {
        // 他アプリ由来の心拍数サンプルが存在する日の心拍数編集はTasketローカル優先保持としHCへ書き込まない
        if (field === 'heartRate' && syncMeta?.hasExternalHeartRate) {
          localOnlyFields.push('heartRate')
          continue
        }
        payload[field] = value
        targetFields.push(field)
      }
    }
  }

  // 睡眠セッションの書き込み対象判定（未編集の他アプリ由来 'external' やローカル編集 'manual' はHCへ書き戻さない）
  const normalizedSessions = normalizeSleepSessionsForDate(healthData.date, healthData.sleepSessions)
  const writableSessions = normalizedSessions.filter(isTasketWritableSleepSession)
  const prevSyncedSessions = normalizeSleepSessionsForDate(healthData.date, syncMeta?.sleepSessions)
  const prevWritableSessions = prevSyncedSessions.filter(isTasketWritableSleepSession)
  const hasPendingDeletes = (syncMeta?.pendingDeleteSleepClientRecordIds?.length ?? 0) > 0
  const hadPrevTasketSleepIds = (syncMeta?.tasketSleepClientRecordIds?.length ?? 0) > 0

  if (writableSessions.length > 0) {
    if (!areSleepSessionsEqual(writableSessions, prevWritableSessions) || hasPendingDeletes) {
      payload.sleepSessions = writableSessions
      targetFields.push('sleep')
    }
  }
  else if (prevWritableSessions.length > 0 || hadPrevTasketSleepIds || hasPendingDeletes) {
    // 以前Tasket由来の睡眠セッションが存在していたが0件に削除された場合（または削除再試行が必要な場合）
    payload.sleepSessions = []
    targetFields.push('sleep')
  }
  else if (normalizedSessions.length > 0 && !areSleepSessionsEqual(normalizedSessions, prevSyncedSessions)) {
    // 他アプリ由来セッションのみをローカル編集('manual')した場合
    localOnlyFields.push('sleep')
  }

  if (targetFields.length > 0) {
    if (syncMeta?.externalValues) {
      payload.externalValues = { ...syncMeta.externalValues }
    }
    if (syncMeta?.clientRecordVersions) {
      payload.clientRecordVersions = { ...syncMeta.clientRecordVersions }
    }
    const prevIds = new Set<string>([
      ...(syncMeta?.tasketSleepClientRecordIds ?? []),
      ...(syncMeta?.pendingDeleteSleepClientRecordIds ?? []),
    ])
    for (const s of prevWritableSessions) {
      if (s.clientRecordId) {
        prevIds.add(s.clientRecordId)
      }
    }
    if (prevIds.size > 0) {
      payload.previousSleepClientRecordIds = [...prevIds]
    }
  }

  return {
    payload,
    targetFields,
    localOnlyFields,
  }
}

/**
 * Health Connectへの書き込み結果に基づいて同期メタデータ（healthConnectSync）を更新する
 * 失敗した項目（failedFields）や権限未許可の項目（skippedPermissionFields）は同期済みとしてマークしない
 */
export function applyWrittenFieldsToSyncMetadata(
  healthData: Partial<HealthData> & { date: string },
  writtenFields: HealthConnectMetricKey[],
  writtenPayload: HealthConnectWritePayload,
  writeResult?: Partial<HealthConnectWriteResult>,
): HealthConnectSyncMetadata {
  const failedSet = new Set<HealthConnectMetricKey>(writeResult?.failedFields ?? [])
  const prevSync = healthData.healthConnectSync || {}

  const nextSync: HealthConnectSyncMetadata = {
    ...prevSync,
    externalValues: { ...(prevSync.externalValues || {}), ...(writeResult?.externalValues || {}) },
    tasketValues: { ...(prevSync.tasketValues || {}), ...(writeResult?.tasketValues || {}) },
    clientRecordVersions: { ...(prevSync.clientRecordVersions || {}), ...(writeResult?.clientRecordVersions || {}) },
  }

  if (writeResult?.tasketSleepClientRecordIds !== undefined) {
    nextSync.tasketSleepClientRecordIds = [...writeResult.tasketSleepClientRecordIds]
  }
  if (writeResult?.pendingDeleteSleepClientRecordIds !== undefined) {
    nextSync.pendingDeleteSleepClientRecordIds = [...writeResult.pendingDeleteSleepClientRecordIds]
  }

  let anySucceeded = false

  for (const field of writtenFields) {
    if (failedSet.has(field)) {
      continue
    }
    anySucceeded = true

    if (field === 'sleep') {
      const normalizedAll = normalizeSleepSessionsForDate(healthData.date, healthData.sleepSessions)
      nextSync.sleepSessions = normalizedAll
      nextSync.sleepHours = calculateTotalSleepHours(normalizedAll, healthData.date) ?? healthData.sleepHours
      if (writeResult?.tasketSleepClientRecordIds === undefined && writtenPayload.sleepSessions) {
        nextSync.tasketSleepClientRecordIds = writtenPayload.sleepSessions.map(
          (s, idx) => s.clientRecordId || `tasket-sleep-${healthData.date}-${idx}`,
        )
      }
    }
    else {
      const val = writtenPayload[field]
      if (val !== undefined) {
        nextSync[field] = val
        // プラグイン側から由来別内訳が返らなかった場合のフォールバック計算
        if (writeResult?.tasketValues?.[field] === undefined) {
          if (isAdditiveMetric(field)) {
            const extVal = nextSync.externalValues?.[field] ?? 0
            nextSync.tasketValues![field] = Math.max(0, val - extVal)
          }
          else {
            nextSync.tasketValues![field] = val
          }
        }
      }
    }
  }

  // 他アプリ由来合計より小さい値へ減少修正され Tasket レコード削除＋ローカル保護となった項目のメタデータ反映
  // （読み取り権限不足で externalValues が確認できなかった場合は、後で権限付与時に再送できるよう同期済み扱いにはしない）
  for (const field of writeResult?.localOnlyFields ?? []) {
    if (failedSet.has(field) || field === 'sleep') {
      continue
    }
    const verifiedExtVal = writeResult?.externalValues?.[field]
    const val = writtenPayload[field]
    if (verifiedExtVal !== undefined && val !== undefined) {
      nextSync[field] = val
    }
  }

  if (anySucceeded) {
    nextSync.syncedAt = new Date().toISOString()
  }

  return nextSync
}
