/**
 * healthConnect ユーティリティのユニットテスト
 */
import { describe, it, expect } from 'vitest'
import {
  applyWrittenFieldsToSyncMetadata,
  buildHealthConnectWritePayload,
  mergeHealthConnectDailyData,
} from '~/utils/healthConnect'
import { createHealthData } from '../helpers/factories'
import { createSleepSessionDrafts, normalizeSleepSessionsForDate } from '~/utils/sleepSessions'

describe('healthConnect utilities', () => {
  describe('mergeHealthConnectDailyData', () => {
    it('既存データがない日に全7項目を取り込み、同期メタデータを記録する', () => {
      const incomingSessions = normalizeSleepSessionsForDate('2025-12-15', [
        { startTime: '23:30', endTime: '07:00' },
      ])
      const result = mergeHealthConnectDailyData(
        undefined,
        {
          date: '2025-12-15',
          steps: 8500,
          sleepSessions: incomingSessions,
          sleepHours: 7.5,
          heartRate: 64,
          weight: 68.4,
          bodyFatPercentage: 18.2,
          waterIntake: 1800,
          exerciseMinutes: 45,
        },
        '2025-12-15',
      )

      expect(result.hasChanges).toBe(true)
      expect(result.updatedFields).toEqual([
        'steps',
        'heartRate',
        'weight',
        'bodyFatPercentage',
        'waterIntake',
        'exerciseMinutes',
        'sleep',
      ])
      expect(result.mergedData.steps).toBe(8500)
      expect(result.mergedData.sleepHours).toBe(7.5)
      expect(result.mergedData.sleepSessions).toEqual(incomingSessions)
      expect(result.mergedData.heartRate).toBe(64)
      expect(result.mergedData.weight).toBe(68.4)
      expect(result.mergedData.bodyFatPercentage).toBe(18.2)
      expect(result.mergedData.waterIntake).toBe(1800)
      expect(result.mergedData.exerciseMinutes).toBe(45)
      expect(result.mergedData.healthConnectSync?.steps).toBe(8500)
      expect(result.mergedData.healthConnectSync?.weight).toBe(68.4)
    })

    it('Tasket側で手動編集された項目および未保存フォーム入力（dirtyMetrics）は保護し、未変更項目のみ更新する', () => {
      const existing = createHealthData({
        date: '2025-12-15',
        weight: 67.0, // 手動で68.0から67.0に変更済み
        steps: 5000, // 前回HC同期値のまま
        waterIntake: 1000, // 前回HC同期値のまま（ただしフォーム上で未保存編集中としてdirty指定）
        muscleMass: 52.3, // 連携対象外フィールド
        healthMemo: '快調',
        healthConnectSync: {
          weight: 68.0,
          steps: 5000,
          waterIntake: 1000,
        },
      })

      const result = mergeHealthConnectDailyData(
        existing,
        {
          date: '2025-12-15',
          weight: 69.0, // HC側の値（Tasket側が手動変更済みなのでスキップ）
          steps: 9200, // HC側の新しい歩数（更新されるべき）
          waterIntake: 1500, // フォーム上で未保存編集中（dirtyMetrics）のためスキップされるべき
          heartRate: 66, // Tasket側が未入力（補完されるべき）
        },
        '2025-12-15',
        { dirtyMetrics: ['waterIntake'] },
      )

      expect(result.mergedData.weight).toBe(67.0)
      expect(result.mergedData.waterIntake).toBe(1000)
      expect(result.skippedManualFields).toContain('weight')
      expect(result.skippedManualFields).toContain('waterIntake')
      expect(result.mergedData.steps).toBe(9200)
      expect(result.mergedData.heartRate).toBe(66)
      expect(result.updatedFields).toEqual(['steps', 'heartRate'])
      expect(result.mergedData.muscleMass).toBe(52.3)
      expect(result.mergedData.healthMemo).toBe('快調')
    })

    it('同一データの繰り返し同期では変更なし（hasChanges: false）となり循環同期しない', () => {
      const first = mergeHealthConnectDailyData(
        undefined,
        {
          date: '2025-12-15',
          steps: 7000,
          waterIntake: 1200,
          externalValues: { steps: 7000, waterIntake: 1000 },
          tasketValues: { steps: 0, waterIntake: 200 },
        },
        '2025-12-15',
      )
      expect(first.hasChanges).toBe(true)

      const existing = createHealthData({
        ...first.mergedData,
        date: '2025-12-15',
      })

      const second = mergeHealthConnectDailyData(
        existing,
        {
          date: '2025-12-15',
          steps: 7000,
          waterIntake: 1200,
          externalValues: { steps: 7000, waterIntake: 1000 },
          tasketValues: { steps: 0, waterIntake: 200 },
        },
        '2025-12-15',
      )
      expect(second.hasChanges).toBe(false)
      expect(second.updatedFields).toEqual([])
    })

    it('全項目が読み取り失敗（allFailed）または全権限未許可（allPermissionDenied）の場合は同期成功として扱わない', () => {
      const existing = createHealthData({
        date: '2025-12-15',
        weight: 65.0,
        bodyFatPercentage: undefined,
      })

      const failedResult = mergeHealthConnectDailyData(
        existing,
        {
          date: '2025-12-15',
          readFields: [],
          emptyFields: [],
          failedFields: ['steps', 'sleep', 'heartRate', 'weight', 'bodyFatPercentage', 'waterIntake', 'exerciseMinutes'],
          fieldErrors: { steps: 'RemoteException' },
        },
        '2025-12-15',
      )
      expect(failedResult.allFailed).toBe(true)
      expect(failedResult.hasChanges).toBe(false)
      expect(failedResult.mergedData.healthConnectSync).toBeUndefined()

      const deniedResult = mergeHealthConnectDailyData(
        existing,
        {
          date: '2025-12-15',
          readFields: [],
          emptyFields: [],
          skippedPermissionFields: ['steps', 'sleep', 'heartRate', 'weight', 'bodyFatPercentage', 'waterIntake', 'exerciseMinutes'],
          failedFields: [],
        },
        '2025-12-15',
      )
      expect(deniedResult.allPermissionDenied).toBe(true)
      expect(deniedResult.hasChanges).toBe(false)
      expect(deniedResult.mergedData.healthConnectSync).toBeUndefined()
    })

    it('一部の項目のみ取得失敗した場合でも成功した項目はマージされ、失敗項目は既存値を維持する', () => {
      const existing = createHealthData({
        date: '2025-12-15',
        weight: 65.0,
        steps: 4000,
        healthConnectSync: {
          weight: 65.0,
          steps: 4000,
        },
      })

      const partialResult = mergeHealthConnectDailyData(
        existing,
        {
          date: '2025-12-15',
          steps: 8000,
          readFields: ['steps'],
          emptyFields: ['sleep', 'heartRate', 'bodyFatPercentage', 'waterIntake', 'exerciseMinutes'],
          failedFields: ['weight'],
          fieldErrors: { weight: 'IOException' },
        },
        '2025-12-15',
      )

      expect(partialResult.allFailed).toBe(false)
      expect(partialResult.hasChanges).toBe(true)
      expect(partialResult.updatedFields).toEqual(['steps'])
      expect(partialResult.mergedData.steps).toBe(8000)
      expect(partialResult.mergedData.weight).toBe(65.0)
      expect(partialResult.failedFields).toEqual(['weight'])
    })
  })

  describe('他アプリ由来データの取得・編集・書き込み・再取得（二重計上・循環同期防止 P1-3）', () => {
    it('他アプリで記録された水分摂取量1,000mlを取得後、Tasketで1,200mlへ編集・書き込み・再取得しても2,200mlに二重計上されない', () => {
      // 1. 他アプリ由来の 1,000ml を取得
      const read1 = mergeHealthConnectDailyData(
        undefined,
        {
          date: '2025-12-15',
          waterIntake: 1000,
          externalValues: { waterIntake: 1000 },
          tasketValues: { waterIntake: 0 },
          readFields: ['waterIntake'],
        },
        '2025-12-15',
      )
      expect(read1.mergedData.waterIntake).toBe(1000)

      // 2. ユーザーが Tasket で 1,200ml に編集
      const editedData = createHealthData({
        ...read1.mergedData,
        date: '2025-12-15',
        weight: undefined,
        bodyFatPercentage: undefined,
        waterIntake: 1200,
      })

      const { payload, targetFields } = buildHealthConnectWritePayload(editedData)
      expect(targetFields).toEqual(['waterIntake'])
      expect(payload.waterIntake).toBe(1200)
      expect(payload.externalValues?.waterIntake).toBe(1000)

      // 3. Kotlin側で差分 200ml (1200 - 1000) が Upsert され、メタデータを更新
      const updatedSync = applyWrittenFieldsToSyncMetadata(
        editedData,
        ['waterIntake'],
        payload,
        {
          writtenFields: ['waterIntake'],
          skippedPermissionFields: [],
          externalValues: { waterIntake: 1000 },
          tasketValues: { waterIntake: 200 },
          clientRecordVersions: { waterIntake: 1700000000001 },
        },
      )
      const afterWriteData = createHealthData({
        ...editedData,
        healthConnectSync: updatedSync,
      })

      // 再書き込みチェック：変更がないため targetFields は空になる
      const rewriteCheck = buildHealthConnectWritePayload(afterWriteData)
      expect(rewriteCheck.targetFields).toEqual([])

      // 4. Health Connect から再取得（他アプリ 1,000ml + Tasket 200ml = 1,200ml）
      const read2 = mergeHealthConnectDailyData(
        afterWriteData,
        {
          date: '2025-12-15',
          waterIntake: 1200,
          externalValues: { waterIntake: 1000 },
          tasketValues: { waterIntake: 200 },
          clientRecordVersions: { waterIntake: 1700000000001 },
          readFields: ['waterIntake'],
        },
        '2025-12-15',
      )
      expect(read2.hasChanges).toBe(false)
      expect(read2.mergedData.waterIntake).toBe(1200)
    })

    it('他アプリで記録された1,000mlをTasketで800mlへ減少修正した場合、Tasketレコードを削除した上で再取得時も800mlをローカル保護する', () => {
      const initial = createHealthData({
        date: '2025-12-15',
        weight: undefined,
        bodyFatPercentage: undefined,
        waterIntake: 800,
        healthConnectSync: {
          waterIntake: 1000,
          externalValues: { waterIntake: 1000 },
          tasketValues: { waterIntake: 0 },
        },
      })

      const { payload, targetFields } = buildHealthConnectWritePayload(initial)
      expect(targetFields).toEqual(['waterIntake'])

      const syncAfterWrite = applyWrittenFieldsToSyncMetadata(
        initial,
        [],
        payload,
        {
          writtenFields: [],
          skippedPermissionFields: [],
          localOnlyFields: ['waterIntake'],
          externalValues: { waterIntake: 1000 },
          tasketValues: { waterIntake: 0 },
        },
      )
      const savedAfterWrite = createHealthData({
        ...initial,
        healthConnectSync: syncAfterWrite,
      })

      // Health Connect 上には他アプリの 1,000ml が残っているが、再取得しても Tasket 側の 800ml が上書きされない
      const readAgain = mergeHealthConnectDailyData(
        savedAfterWrite,
        {
          date: '2025-12-15',
          waterIntake: 1000,
          externalValues: { waterIntake: 1000 },
          tasketValues: { waterIntake: 0 },
          readFields: ['waterIntake'],
        },
        '2025-12-15',
      )
      expect(readAgain.mergedData.waterIntake).toBe(800)
      expect(readAgain.skippedManualFields).toContain('waterIntake')
    })

    it('加算型データの書き込み時に読み取り権限がなく localOnlyFields となった場合は同期済み扱いとせず、次回権限付与後に書き込み対象となる', () => {
      const initial = createHealthData({
        date: '2025-12-15',
        weight: undefined,
        bodyFatPercentage: undefined,
        waterIntake: 1200,
        healthConnectSync: {
          waterIntake: 1000,
          externalValues: { waterIntake: 1000 },
        },
      })

      const { payload, targetFields } = buildHealthConnectWritePayload(initial)
      expect(targetFields).toEqual(['waterIntake'])

      // 読み取り権限がなく安全に差分計算できないため plugin が localOnlyFields: ['waterIntake']（externalValues なし）を返したケース
      const syncAfterSkipped = applyWrittenFieldsToSyncMetadata(
        initial,
        [],
        payload,
        {
          writtenFields: [],
          skippedPermissionFields: [],
          localOnlyFields: ['waterIntake'],
        },
      )
      expect(syncAfterSkipped.waterIntake).toBe(1000)

      // 権限付与後に再度 buildHealthConnectWritePayload を呼ぶと再び書き込み対象になる
      const retryBuild = buildHealthConnectWritePayload({
        ...initial,
        healthConnectSync: syncAfterSkipped,
      })
      expect(retryBuild.targetFields).toEqual(['waterIntake'])
    })

    it('他アプリ由来の心拍数サンプルが存在する日は心拍数のHC書き込みをスキップし、ローカル優先値として保護する', () => {
      const data = createHealthData({
        date: '2025-12-15',
        weight: undefined,
        bodyFatPercentage: undefined,
        heartRate: 75, // 70から手動編集
        healthConnectSync: {
          heartRate: 70,
          hasExternalHeartRate: true,
        },
      })

      const { targetFields, localOnlyFields } = buildHealthConnectWritePayload(data)
      expect(targetFields).toEqual([])
      expect(localOnlyFields).toEqual(['heartRate'])

      // 再取得しても手動編集した 75 bpm が保護される
      const readAgain = mergeHealthConnectDailyData(
        data,
        {
          date: '2025-12-15',
          heartRate: 70,
          hasExternalHeartRate: true,
          readFields: ['heartRate'],
        },
        '2025-12-15',
      )
      expect(readAgain.mergedData.heartRate).toBe(75)
      expect(readAgain.skippedManualFields).toContain('heartRate')
    })
  })

  describe('睡眠セッションの時刻精度保持・追加・削除・失敗再試行 (P1-2, P2-4)', () => {
    it('未編集の他アプリ由来睡眠セッションは秒以下の精度を維持し、変更済みと誤判定されてHealth Connectへ書き戻されない', () => {
      const externalSession = {
        startTime: '2025-12-14T14:20:35.500Z',
        endTime: '2025-12-14T21:50:12.250Z',
        id: 'ext-sleep-1',
        dataOrigin: 'com.fitbit.FitbitMobile',
        source: 'external' as const,
      }

      // 1. Health Connect から取得
      const merged = mergeHealthConnectDailyData(
        undefined,
        {
          date: '2025-12-15',
          sleepSessions: [externalSession],
          readFields: ['sleep'],
        },
        '2025-12-15',
      )

      // 2. フォームの HH:mm ドラフトを経由して再度ビルド（ユーザーは睡眠を未編集、体重のみ入力）
      const formDrafts = createSleepSessionDrafts(merged.mergedData.sleepSessions)
      const normalizedFromForm = normalizeSleepSessionsForDate('2025-12-15', formDrafts)

      const dataAfterForm = createHealthData({
        ...merged.mergedData,
        date: '2025-12-15',
        weight: 66.5,
        bodyFatPercentage: undefined,
        sleepSessions: normalizedFromForm,
      })

      const { payload, targetFields } = buildHealthConnectWritePayload(dataAfterForm)
      // 体重のみが書き込み対象となり、未編集の睡眠セッションは書き戻されない
      expect(targetFields).toEqual(['weight'])
      expect(payload.sleepSessions).toBeUndefined()
    })

    it('Tasketで作成した睡眠セッションを全削除した場合、空配列を送信してHealth Connect上のTasketセッションを削除する', () => {
      const prevTasketSessions = normalizeSleepSessionsForDate('2025-12-15', [
        { startTime: '23:00', endTime: '06:30', source: 'tasket', clientRecordId: 'tasket-sleep-2025-12-15-0' },
      ])
      const data = createHealthData({
        date: '2025-12-15',
        weight: undefined,
        bodyFatPercentage: undefined,
        sleepSessions: [],
        sleepHours: undefined,
        healthConnectSync: {
          sleepSessions: prevTasketSessions,
          sleepHours: 7.5,
          tasketSleepClientRecordIds: ['tasket-sleep-2025-12-15-0'],
        },
      })

      const { payload, targetFields } = buildHealthConnectWritePayload(data)
      expect(targetFields).toEqual(['sleep'])
      expect(payload.sleepSessions).toEqual([])
      expect(payload.previousSleepClientRecordIds).toContain('tasket-sleep-2025-12-15-0')
    })

    it('睡眠セッション削除が一部失敗して pendingDeleteSleepClientRecordIds が残った場合、次回書き込み時に再試行対象になる', () => {
      const sessions = normalizeSleepSessionsForDate('2025-12-15', [
        { startTime: '23:30', endTime: '07:00', source: 'tasket' },
      ])
      const data = createHealthData({
        date: '2025-12-15',
        weight: undefined,
        bodyFatPercentage: undefined,
        sleepSessions: sessions,
        sleepHours: 7.5,
        healthConnectSync: {
          sleepSessions: sessions,
          sleepHours: 7.5,
          tasketSleepClientRecordIds: ['tasket-sleep-2025-12-15-0'],
          pendingDeleteSleepClientRecordIds: ['tasket-sleep-2025-12-15-1'],
        },
      })

      const { payload, targetFields } = buildHealthConnectWritePayload(data)
      expect(targetFields).toEqual(['sleep'])
      expect(payload.previousSleepClientRecordIds).toContain('tasket-sleep-2025-12-15-1')
    })
  })

  describe('applyWrittenFieldsToSyncMetadata', () => {
    it('書き込みに成功した項目のみhealthConnectSyncメタデータとclientRecordVersionsを更新し、失敗項目は除外する', () => {
      const sessions = normalizeSleepSessionsForDate('2025-12-15', [
        { startTime: '23:30', endTime: '07:00' },
      ])
      const healthData = createHealthData({
        date: '2025-12-15',
        weight: 67.5,
        steps: 10000,
        sleepSessions: sessions,
        sleepHours: 7.5,
      })

      const syncMeta = applyWrittenFieldsToSyncMetadata(
        healthData,
        ['weight', 'sleep'],
        {
          weight: 67.5,
          steps: 10000,
          sleepSessions: sessions,
        },
        {
          writtenFields: ['weight', 'sleep'],
          skippedPermissionFields: ['steps'],
          clientRecordVersions: {
            weight: 1700000000100,
            sleep: 1700000000100,
          },
        },
      )

      expect(syncMeta.weight).toBe(67.5)
      expect(syncMeta.sleepSessions).toEqual(sessions)
      expect(syncMeta.sleepHours).toBe(7.5)
      expect(syncMeta.steps).toBeUndefined()
      expect(syncMeta.clientRecordVersions?.weight).toBe(1700000000100)
      expect(syncMeta.syncedAt).toBeDefined()
    })
  })
})
