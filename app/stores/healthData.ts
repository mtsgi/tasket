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

        const now = new Date()
        const dataToSave: HealthData = existingData
          ? {
              ...existingData,
              ...healthData,
              updated_at: now,
            }
          : {
              id: uuidv4(),
              ...healthData,
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
