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
import { normalizeSleepSessionsForDate } from '~/utils/sleepSessions'

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

    it('Tasket側で手動編集された項目は上書きせず保護し、前回HC同期値のままの項目のみ更新する', () => {
      const existing = createHealthData({
        date: '2025-12-15',
        weight: 67.0, // 手動で68.0から67.0に変更済み
        steps: 5000, // 前回HC同期値のまま
        muscleMass: 52.3, // 連携対象外フィールド
        healthMemo: '快調',
        healthConnectSync: {
          weight: 68.0,
          steps: 5000,
        },
      })

      const result = mergeHealthConnectDailyData(
        existing,
        {
          date: '2025-12-15',
          weight: 69.0, // HC側の値（Tasket側が手動変更済みなのでスキップされるべき）
          steps: 9200, // HC側の新しい歩数（更新されるべき）
          heartRate: 66, // Tasket側が未入力（補完されるべき）
        },
        '2025-12-15',
      )

      expect(result.mergedData.weight).toBe(67.0)
      expect(result.skippedManualFields).toContain('weight')
      expect(result.mergedData.steps).toBe(9200)
      expect(result.mergedData.heartRate).toBe(66)
      expect(result.updatedFields).toEqual(['steps', 'heartRate'])
      // 対象外フィールドも破壊されない
      expect(result.mergedData.muscleMass).toBe(52.3)
      expect(result.mergedData.healthMemo).toBe('快調')
    })
  })

  describe('buildHealthConnectWritePayload', () => {
    it('前回HC同期値から変更がない項目は書き込み対象から除外し、新規・変更項目のみ抽出する', () => {
      const sessions = normalizeSleepSessionsForDate('2025-12-15', [
        { startTime: '23:00', endTime: '06:30' },
      ])
      const healthData = createHealthData({
        date: '2025-12-15',
        steps: 8000, // 未変更
        weight: 67.5, // 68.0から変更
        heartRate: 62, // 新規入力
        sleepHours: 7.5,
        sleepSessions: sessions, // 新規セッション
        healthConnectSync: {
          steps: 8000,
          weight: 68.0,
          bodyFatPercentage: 20,
        },
      })

      const { payload, targetFields } = buildHealthConnectWritePayload(healthData)

      expect(targetFields).toEqual(['heartRate', 'weight', 'sleep'])
      expect(payload.steps).toBeUndefined()
      expect(payload.weight).toBe(67.5)
      expect(payload.heartRate).toBe(62)
      expect(payload.sleepSessions).toEqual(sessions)
    })

    it('sleepSessionsが空でsleepHoursのみ手入力されている場合は睡眠のHC書き込みをスキップする', () => {
      const healthData = createHealthData({
        date: '2025-12-15',
        weight: undefined,
        bodyFatPercentage: undefined,
        sleepHours: 7.0,
        sleepSessions: [],
      })

      const { payload, targetFields } = buildHealthConnectWritePayload(healthData)

      expect(targetFields).toEqual([])
      expect(payload.sleepSessions).toBeUndefined()
    })
  })

  describe('applyWrittenFieldsToSyncMetadata', () => {
    it('書き込みに成功した項目のみhealthConnectSyncメタデータを更新する', () => {
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
        ['weight', 'sleep'], // stepsは書き込み権限がなくスキップされたケース
        {
          weight: 67.5,
          steps: 10000,
          sleepSessions: sessions,
        },
      )

      expect(syncMeta.weight).toBe(67.5)
      expect(syncMeta.sleepSessions).toEqual(sessions)
      expect(syncMeta.sleepHours).toBe(7.5)
      expect(syncMeta.steps).toBeUndefined()
      expect(syncMeta.syncedAt).toBeDefined()
    })
  })
})
