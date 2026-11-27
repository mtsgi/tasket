/**
 * Piniaストア: 健康データ管理
 * 健康データのCRUD操作と集計機能を提供します。
 */
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import type { HealthData, MonthlyHealthSummary } from '~/types/item'
import {
  getAllHealthData,
  getHealthDataByDate,
  saveHealthData,
  deleteHealthData,
  getHealthDataByDateRange,
} from '~/utils/db'
import {
  calculateTotalSleepHours,
  normalizeSleepSessionsForDate,
} from '~/utils/sleepSessions'
import {
  applyWrittenFieldsToSyncMetadata,
  buildHealthConnectWritePayload,
  mergeHealthConnectDailyData,
  readHealthConnectDailyData,
  readHealthConnectDateRangeData,
  writeHealthConnectDailyData,
  type HealthConnectMetricKey,
} from '~/utils/healthConnect'
import dayjs from 'dayjs'

interface HealthDataFetchState {
  inFlight: Promise<void> | null
  inFlightToken: object | null
  generation: number
}

const healthDataFetchStates = new WeakMap<object, HealthDataFetchState>()

function getHealthDataFetchState(store: object): HealthDataFetchState {
  let state = healthDataFetchStates.get(store)
  if (!state) {
    state = { inFlight: null, inFlightToken: null, generation: 0 }
    healthDataFetchStates.set(store, state)
  }
  return state
}

export const useHealthDataStore = defineStore('healthData', {
  /**
   * ストアの状態
   */
  state: () => ({
    healthDataList: [] as HealthData[], // すべての健康データ
    isLoading: false, // 読み込み中フラグ
    error: null as string | null, // エラーメッセージ
  }),

  /**
   * ゲッター（算出プロパティ）
   */
  getters: {
    /**
     * 特定の日の健康データを取得
     * @param dateString - 日付文字列（YYYY-MM-DD）
     * @returns その日の健康データ、または見つからない場合はundefined
     */
    getHealthDataByDateString: (state) => {
      return (dateString: string) => {
        return state.healthDataList.find(data => data.date === dateString)
      }
    },

    /**
     * 指定日より前の直近の健康データを取得
     * @param dateString - 日付文字列（YYYY-MM-DD）
     * @returns 前回の健康データ、または見つからない場合はundefined
     */
    getPreviousHealthDataByDateString: (state) => {
      return (dateString: string) => {
        let previousData: HealthData | undefined

        for (const data of state.healthDataList) {
          if (data.date < dateString && (!previousData || data.date > previousData.date)) {
            previousData = data
          }
        }

        return previousData
      }
    },

    /**
     * 特定の月の健康データを取得
     * @param yearMonth - 年月文字列（YYYY-MM）
     * @returns その月の健康データリスト（日付順）
     */
    getHealthDataByMonth: (state) => {
      return (yearMonth: string) => {
        return state.healthDataList
          .filter(data => data.date.startsWith(yearMonth))
          .sort((a, b) => a.date.localeCompare(b.date))
      }
    },

    /**
     * 月次健康サマリーを計算
     * @param yearMonth - 年月文字列（YYYY-MM）
     * @returns 月次健康サマリー
     */
    getMonthlyHealthSummary: (state) => {
      return (yearMonth: string): MonthlyHealthSummary => {
        const monthData = state.healthDataList
          .filter(data => data.date.startsWith(yearMonth))
          .sort((a, b) => a.date.localeCompare(b.date))

        // 前月のデータを取得
        const prevMonth = dayjs(yearMonth + '-01').subtract(1, 'month').format('YYYY-MM')
        const prevMonthData = state.healthDataList
          .filter(data => data.date.startsWith(prevMonth))
          .sort((a, b) => a.date.localeCompare(b.date))

        const summary: MonthlyHealthSummary = {
          yearMonth,
          recordCount: monthData.length,
        }

        if (monthData.length === 0) {
          return summary
        }

        // 平均値の計算
        const weights = monthData.filter(d => d.weight).map(d => d.weight!)
        const bodyFats = monthData.filter(d => d.bodyFatPercentage).map(d => d.bodyFatPercentage!)
        const muscleMasses = monthData.filter(d => d.muscleMass).map(d => d.muscleMass!)
        const visceralFatLevels = monthData.filter(d => d.visceralFatLevel).map(d => d.visceralFatLevel!)
        const systolics = monthData.filter(d => d.systolicBloodPressure).map(d => d.systolicBloodPressure!)
        const diastolics = monthData.filter(d => d.diastolicBloodPressure).map(d => d.diastolicBloodPressure!)
        const heartRates = monthData.filter(d => d.heartRate).map(d => d.heartRate!)
        const sleepHours = monthData.filter(d => d.sleepHours).map(d => d.sleepHours!)
        const bodyWaterPercentages = monthData.filter(d => d.bodyWaterPercentage).map(d => d.bodyWaterPercentage!)
        const boneMasses = monthData.filter(d => d.boneMass).map(d => d.boneMass!)
        const proteinPercentages = monthData.filter(d => d.proteinPercentage).map(d => d.proteinPercentage!)

        if (weights.length > 0) {
          summary.avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length
        }
        if (bodyFats.length > 0) {
          summary.avgBodyFatPercentage = bodyFats.reduce((a, b) => a + b, 0) / bodyFats.length
        }
        if (muscleMasses.length > 0) {
          summary.avgMuscleMass = muscleMasses.reduce((a, b) => a + b, 0) / muscleMasses.length
        }
        if (visceralFatLevels.length > 0) {
          summary.avgVisceralFatLevel = visceralFatLevels.reduce((a, b) => a + b, 0) / visceralFatLevels.length
        }
        if (systolics.length > 0) {
          summary.avgSystolicBloodPressure = systolics.reduce((a, b) => a + b, 0) / systolics.length
        }
        if (diastolics.length > 0) {
          summary.avgDiastolicBloodPressure = diastolics.reduce((a, b) => a + b, 0) / diastolics.length
        }
        if (heartRates.length > 0) {
          summary.avgHeartRate = heartRates.reduce((a, b) => a + b, 0) / heartRates.length
        }
        if (sleepHours.length > 0) {
          summary.avgSleepHours = sleepHours.reduce((a, b) => a + b, 0) / sleepHours.length
        }
        if (bodyWaterPercentages.length > 0) {
          summary.avgBodyWaterPercentage = bodyWaterPercentages.reduce((a, b) => a + b, 0) / bodyWaterPercentages.length
        }
        if (boneMasses.length > 0) {
          summary.avgBoneMass = boneMasses.reduce((a, b) => a + b, 0) / boneMasses.length
        }
        if (proteinPercentages.length > 0) {
          summary.avgProteinPercentage = proteinPercentages.reduce((a, b) => a + b, 0) / proteinPercentages.length
        }

        // 合計値の計算
        summary.totalSteps = monthData.reduce((sum, d) => sum + (d.steps || 0), 0)
        summary.totalExerciseMinutes = monthData.reduce((sum, d) => sum + (d.exerciseMinutes || 0), 0)
        summary.totalCaloriesBurned = monthData.reduce((sum, d) => sum + (d.caloriesBurned || 0), 0)

        // 前月との比較
        if (prevMonthData.length > 0) {
          const prevWeights = prevMonthData.filter(d => d.weight).map(d => d.weight!)
          const prevBodyFats = prevMonthData.filter(d => d.bodyFatPercentage).map(d => d.bodyFatPercentage!)
          const prevMuscleMasses = prevMonthData.filter(d => d.muscleMass).map(d => d.muscleMass!)
          const prevVisceralFatLevels = prevMonthData.filter(d => d.visceralFatLevel).map(d => d.visceralFatLevel!)
          const prevHeartRates = prevMonthData.filter(d => d.heartRate).map(d => d.heartRate!)
          const prevSleepHours = prevMonthData.filter(d => d.sleepHours).map(d => d.sleepHours!)
          const prevSteps = prevMonthData.reduce((sum, d) => sum + (d.steps || 0), 0)

          if (summary.avgWeight && prevWeights.length > 0) {
            const prevAvgWeight = prevWeights.reduce((a, b) => a + b, 0) / prevWeights.length
            summary.weightChange = summary.avgWeight - prevAvgWeight
          }
          if (summary.avgBodyFatPercentage && prevBodyFats.length > 0) {
            const prevAvgBodyFat = prevBodyFats.reduce((a, b) => a + b, 0) / prevBodyFats.length
            summary.bodyFatChange = summary.avgBodyFatPercentage - prevAvgBodyFat
          }
          if (summary.avgMuscleMass && prevMuscleMasses.length > 0) {
            const prevAvgMuscleMass = prevMuscleMasses.reduce((a, b) => a + b, 0) / prevMuscleMasses.length
            summary.muscleMassChange = summary.avgMuscleMass - prevAvgMuscleMass
          }
          if (summary.avgVisceralFatLevel && prevVisceralFatLevels.length > 0) {
            const prevAvgVisceralFatLevel = prevVisceralFatLevels.reduce((a, b) => a + b, 0) / prevVisceralFatLevels.length
            summary.visceralFatLevelChange = summary.avgVisceralFatLevel - prevAvgVisceralFatLevel
          }
          if (summary.avgHeartRate && prevHeartRates.length > 0) {
            const prevAvgHeartRate = prevHeartRates.reduce((a, b) => a + b, 0) / prevHeartRates.length
            summary.heartRateChange = summary.avgHeartRate - prevAvgHeartRate
          }
          if (summary.avgSleepHours && prevSleepHours.length > 0) {
            const prevAvgSleepHours = prevSleepHours.reduce((a, b) => a + b, 0) / prevSleepHours.length
            summary.sleepHoursChange = summary.avgSleepHours - prevAvgSleepHours
          }
          if (summary.totalSteps && prevSteps > 0) {
            summary.stepsChange = summary.totalSteps - prevSteps
          }
        }

        return summary
      }
    },
  },

  /**
   * アクション（メソッド）
   */
  actions: {
    /**
     * すべての健康データをデータベースから取得
     * 進行中の取得がある場合は重複呼び出しを集約し、force指定時は最新データで上書きする
     */
    async fetchHealthData(options?: { force?: boolean }) {
      const fetchState = getHealthDataFetchState(this)
      if (!options?.force && fetchState.inFlight) {
        return fetchState.inFlight
      }

      const generation = ++fetchState.generation
      const fetchToken = {}
      fetchState.inFlightToken = fetchToken
      this.isLoading = true
      this.error = null

      const promise = (async () => {
        try {
          const dataList = await getAllHealthData()
          if (fetchState.generation === generation) {
            this.healthDataList = dataList
          }
        }
        catch (error) {
          if (fetchState.generation === generation) {
            this.error = error instanceof Error ? error.message : 'Unknown error'
          }
          console.error('Failed to fetch health data:', error)
        }
        finally {
          if (fetchState.inFlightToken === fetchToken) {
            fetchState.inFlight = null
            fetchState.inFlightToken = null
          }
          if (!fetchState.inFlight) {
            this.isLoading = false
          }
        }
      })()

      if (fetchState.inFlightToken === fetchToken) {
        fetchState.inFlight = promise
      }
      return promise
    },

    /**
     * 特定の日の健康データを取得
     * @param date - 日付文字列（YYYY-MM-DD）
     */
    async fetchHealthDataByDate(date: string) {
      this.isLoading = true
      this.error = null
      try {
        const data = await getHealthDataByDate(date)
        if (data) {
          const index = this.healthDataList.findIndex(d => d.id === data.id)
          if (index !== -1) {
            this.healthDataList[index] = data
          }
          else {
            this.healthDataList.push(data)
          }
        }
        return data
      }
      catch (error) {
        this.error = error instanceof Error ? error.message : 'Unknown error'
        console.error('Failed to fetch health data by date:', error)
        return undefined
      }
      finally {
        this.isLoading = false
      }
    },

    /**
     * 健康データを保存または更新
     * @param healthData - 健康データ（IDがない場合は新規作成）
     */
    async saveHealthDataItem(healthData: Partial<HealthData> & { date: string }) {
      this.isLoading = true
      this.error = null
      try {
        // 既存のデータを確認
        const existingData = await getHealthDataByDate(healthData.date)

        // sleepSessionsが指定されている場合は正規化し、合計からsleepHoursを自動計算
        const normalizedPayload: Partial<HealthData> & { date: string } = { ...healthData }
        if (healthData.sleepSessions !== undefined) {
          const normalizedSessions = normalizeSleepSessionsForDate(healthData.date, healthData.sleepSessions)
          normalizedPayload.sleepSessions = normalizedSessions
          if (normalizedSessions.length > 0) {
            normalizedPayload.sleepHours = calculateTotalSleepHours(normalizedSessions, healthData.date)
          }
        }

        const now = new Date()
        const dataToSave: HealthData = existingData
          ? {
              ...existingData,
              ...normalizedPayload,
              updated_at: now,
            }
          : {
              id: uuidv4(),
              ...normalizedPayload,
              created_at: now,
              updated_at: now,
            }

        await saveHealthData(dataToSave)
        const fetchState = getHealthDataFetchState(this)
        fetchState.generation += 1
        fetchState.inFlight = null
        fetchState.inFlightToken = null

        // ストアの状態を更新
        const index = this.healthDataList.findIndex(d => d.id === dataToSave.id)
        if (index !== -1) {
          this.healthDataList[index] = dataToSave
        }
        else {
          this.healthDataList.push(dataToSave)
        }

        return dataToSave
      }
      catch (error) {
        this.error = error instanceof Error ? error.message : 'Unknown error'
        console.error('Failed to save health data:', error)
        throw error
      }
      finally {
        this.isLoading = false
      }
    },

    /**
     * 指定日の健康データをHealth Connectから読み取ってマージ保存
     * @param date - 日付文字列（YYYY-MM-DD）
     * @param options - フォームで未保存編集中の項目（dirtyMetrics）などの保護オプション
     */
    async syncDateFromHealthConnect(
      date: string,
      options?: { dirtyMetrics?: Iterable<HealthConnectMetricKey> },
    ): Promise<{
      data: HealthData | undefined
      updatedFields: HealthConnectMetricKey[]
      skippedManualFields: HealthConnectMetricKey[]
      skippedPermissionFields: HealthConnectMetricKey[]
      failedFields: HealthConnectMetricKey[]
      fieldErrors: Partial<Record<HealthConnectMetricKey, string>>
      allFailed: boolean
      allPermissionDenied: boolean
    }> {
      this.isLoading = true
      this.error = null
      try {
        const incoming = await readHealthConnectDailyData(date)
        const existing = await getHealthDataByDate(date)
        const mergeResult = mergeHealthConnectDailyData(
          existing,
          incoming,
          date,
          options,
        )

        const {
          mergedData,
          updatedFields,
          skippedManualFields,
          skippedPermissionFields,
          failedFields,
          fieldErrors,
          hasChanges,
          hasMetadataChanges,
          allFailed,
          allPermissionDenied,
        } = mergeResult

        if (allFailed) {
          this.error = 'Failed to read all metrics from Health Connect'
          return {
            data: existing,
            updatedFields: [],
            skippedManualFields: [],
            skippedPermissionFields,
            failedFields,
            fieldErrors,
            allFailed: true,
            allPermissionDenied: false,
          }
        }

        if (allPermissionDenied) {
          return {
            data: existing,
            updatedFields: [],
            skippedManualFields: [],
            skippedPermissionFields,
            failedFields,
            fieldErrors,
            allFailed: false,
            allPermissionDenied: true,
          }
        }

        if (!existing && !hasChanges) {
          return {
            data: undefined,
            updatedFields,
            skippedManualFields,
            skippedPermissionFields,
            failedFields,
            fieldErrors,
            allFailed: false,
            allPermissionDenied: false,
          }
        }

        if (existing && !hasChanges && !hasMetadataChanges) {
          return {
            data: existing,
            updatedFields,
            skippedManualFields,
            skippedPermissionFields,
            failedFields,
            fieldErrors,
            allFailed: false,
            allPermissionDenied: false,
          }
        }

        const saved = await this.saveHealthDataItem(mergedData)
        return {
          data: saved,
          updatedFields,
          skippedManualFields,
          skippedPermissionFields,
          failedFields,
          fieldErrors,
          allFailed: false,
          allPermissionDenied: false,
        }
      }
      catch (error) {
        this.error = error instanceof Error ? error.message : 'Unknown error'
        console.error('Failed to sync date from Health Connect:', error)
        throw error
      }
      finally {
        this.isLoading = false
      }
    },

    /**
     * 直近N日分（デフォルト30日）の健康データをHealth Connectから一括取得してマージ保存
     * @param days - 取得する日数（デフォルト30）
     */
    async syncRecentFromHealthConnect(days = 30): Promise<{
      syncedDaysCount: number
      updatedFieldsCount: number
      failedDaysCount: number
      partialFailedFieldsCount: number
      allFailed: boolean
      allPermissionDenied: boolean
    }> {
      this.isLoading = true
      this.error = null
      try {
        const endDate = dayjs().format('YYYY-MM-DD')
        const startDate = dayjs().subtract(Math.max(1, days) - 1, 'day').format('YYYY-MM-DD')
        const dailyList = await readHealthConnectDateRangeData(startDate, endDate)

        let syncedDaysCount = 0
        let updatedFieldsCount = 0
        let failedDaysCount = 0
        let partialFailedFieldsCount = 0
        let permissionDeniedDaysCount = 0

        for (const incoming of dailyList) {
          const existing = await getHealthDataByDate(incoming.date)
          const {
            mergedData,
            updatedFields,
            failedFields,
            hasChanges,
            hasMetadataChanges,
            allFailed,
            allPermissionDenied,
          } = mergeHealthConnectDailyData(
            existing,
            incoming,
            incoming.date,
          )

          if (allFailed) {
            failedDaysCount++
            partialFailedFieldsCount += failedFields.length
            continue
          }
          if (allPermissionDenied) {
            permissionDeniedDaysCount++
            continue
          }
          if (failedFields.length > 0) {
            partialFailedFieldsCount += failedFields.length
          }

          if (hasChanges || (existing && hasMetadataChanges)) {
            await this.saveHealthDataItem(mergedData)
            if (hasChanges) {
              syncedDaysCount++
              updatedFieldsCount += updatedFields.length
            }
          }
        }

        const totalDays = dailyList.length
        const allFailed = totalDays > 0 && failedDaysCount === totalDays
        const allPermissionDenied = totalDays > 0 && permissionDeniedDaysCount === totalDays

        if (allFailed) {
          this.error = 'Failed to read all days from Health Connect'
        }

        return {
          syncedDaysCount,
          updatedFieldsCount,
          failedDaysCount,
          partialFailedFieldsCount,
          allFailed,
          allPermissionDenied,
        }
      }
      catch (error) {
        this.error = error instanceof Error ? error.message : 'Unknown error'
        console.error('Failed to sync recent data from Health Connect:', error)
        throw error
      }
      finally {
        this.isLoading = false
      }
    },

    /**
     * 指定日のフォーム入力値をローカルDBへ保存した上で、新規・変更項目をHealth Connectへ書き込む
     * @param healthDataInput - フォームから渡された健康データ
     */
    async writeDateToHealthConnect(healthDataInput: Partial<HealthData> & { date: string }): Promise<{
      data: HealthData
      writtenFields: HealthConnectMetricKey[]
      skippedPermissionFields: HealthConnectMetricKey[]
      invalidFields: HealthConnectMetricKey[]
      failedFields: HealthConnectMetricKey[]
      fieldErrors: Partial<Record<HealthConnectMetricKey, string>>
      localOnlyFields: HealthConnectMetricKey[]
      nothingToWrite: boolean
    }> {
      this.isLoading = true
      this.error = null
      try {
        const existing = await getHealthDataByDate(healthDataInput.date)
        const previousSync = existing?.healthConnectSync

        // まず現在のフォーム入力値をIndexedDBへ保存
        const savedData = await this.saveHealthDataItem(healthDataInput)

        // 前回HC同期値との差分を計算
        const { payload, targetFields, localOnlyFields } = buildHealthConnectWritePayload(savedData, previousSync)
        if (targetFields.length === 0) {
          return {
            data: savedData,
            writtenFields: [],
            skippedPermissionFields: [],
            invalidFields: [],
            failedFields: [],
            fieldErrors: {},
            localOnlyFields,
            nothingToWrite: localOnlyFields.length === 0,
          }
        }

        const writeResult = await writeHealthConnectDailyData(savedData.date, payload)
        const invalidFields = writeResult.invalidFields ?? []
        const failedFields = writeResult.failedFields ?? []
        const fieldErrors = writeResult.fieldErrors ?? {}
        const pluginLocalOnlyFields = writeResult.localOnlyFields ?? []
        const combinedLocalOnlyFields = [...new Set<HealthConnectMetricKey>([...localOnlyFields, ...pluginLocalOnlyFields])]
        const hasPendingSleepDeletes = (writeResult.pendingDeleteSleepClientRecordIds?.length ?? 0) > 0

        if (writeResult.writtenFields.length > 0 || hasPendingSleepDeletes || pluginLocalOnlyFields.length > 0) {
          const updatedSync = applyWrittenFieldsToSyncMetadata(
            { ...savedData, healthConnectSync: previousSync },
            writeResult.writtenFields,
            payload,
            writeResult,
          )
          const finalData = await this.saveHealthDataItem({
            ...savedData,
            healthConnectSync: updatedSync,
          })
          return {
            data: finalData,
            writtenFields: writeResult.writtenFields,
            skippedPermissionFields: writeResult.skippedPermissionFields,
            invalidFields,
            failedFields,
            fieldErrors,
            localOnlyFields: combinedLocalOnlyFields,
            nothingToWrite: false,
          }
        }

        return {
          data: savedData,
          writtenFields: writeResult.writtenFields,
          skippedPermissionFields: writeResult.skippedPermissionFields,
          invalidFields,
          failedFields,
          fieldErrors,
          localOnlyFields: combinedLocalOnlyFields,
          nothingToWrite: false,
        }
      }
      catch (error) {
        this.error = error instanceof Error ? error.message : 'Unknown error'
        console.error('Failed to write date to Health Connect:', error)
        throw error
      }
      finally {
        this.isLoading = false
      }
    },

    /**
     * 健康データを削除
     * @param id - 健康データのID
     */
    async deleteHealthDataItem(id: string) {
      this.isLoading = true
      this.error = null
      try {
        await deleteHealthData(id)
        const fetchState = getHealthDataFetchState(this)
        fetchState.generation += 1
        fetchState.inFlight = null
        fetchState.inFlightToken = null
        this.healthDataList = this.healthDataList.filter(data => data.id !== id)
      }
      catch (error) {
        this.error = error instanceof Error ? error.message : 'Unknown error'
        console.error('Failed to delete health data:', error)
        throw error
      }
      finally {
        this.isLoading = false
      }
    },

    /**
     * 日付範囲で健康データを取得
     * @param startDate - 開始日（YYYY-MM-DD）
     * @param endDate - 終了日（YYYY-MM-DD）
     */
    async fetchHealthDataByDateRange(startDate: string, endDate: string) {
      this.isLoading = true
      this.error = null
      try {
        const dataList = await getHealthDataByDateRange(startDate, endDate)
        // 既存データとマージ
        dataList.forEach((data) => {
          const index = this.healthDataList.findIndex(d => d.id === data.id)
          if (index !== -1) {
            this.healthDataList[index] = data
          }
          else {
            this.healthDataList.push(data)
          }
        })
        return dataList
      }
      catch (error) {
        this.error = error instanceof Error ? error.message : 'Unknown error'
        console.error('Failed to fetch health data by date range:', error)
        return []
      }
      finally {
        this.isLoading = false
      }
    },
  },
})
