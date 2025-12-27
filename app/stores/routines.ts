/**
 * Piniaストア: 日課（ルーティン）管理
 * 月ごとの日課定義と日々の達成記録を管理します。
 */
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import type { Routine, RoutineLog, RoutineStatus } from '~/types/item'
import {
  getRoutinesByYearMonth,
  getAllRoutines,
  addRoutine,
  updateRoutine,
  deleteRoutine,
  getRoutineLogsByDate,
  getRoutineLog,
  saveRoutineLog,
  getAllRoutineLogs,
  getRoutineLogsByDateRange,
} from '~/utils/db'

export const useRoutinesStore = defineStore('routines', {
  /**
   * ストアの状態
   */
  state: () => ({
    routines: [] as Routine[], // 現在の月の日課リスト
    allRoutines: [] as Routine[], // すべての日課
    routineLogs: {} as Record<string, RoutineLog[]>, // 日付をキーとした日課ログマップ
    isLoading: false, // 読み込み中フラグ
    error: null as string | null, // エラーメッセージ
  }),

  /**
   * ゲッター（算出プロパティ）
   */
  getters: {
    /**
     * 特定の日の日課ログを取得
     * @param date - 日付文字列（YYYY-MM-DD）
     * @returns その日の日課ログリスト
     */
    getLogsByDate: (state) => {
      return (date: string): RoutineLog[] => {
        return state.routineLogs[date] || []
      }
    },

    /**
     * 特定の日課の特定の日のステータスを取得
     * @param routineId - 日課ID
     * @param date - 日付文字列（YYYY-MM-DD）
     * @returns ステータス（デフォルトは'unconfirmed'）
     */
    getRoutineStatus: (state) => {
      return (routineId: string, date: string): RoutineStatus => {
        const logs = state.routineLogs[date] || []
        const log = logs.find(l => l.routineId === routineId)
        return log?.status ?? 'unconfirmed'
      }
    },

    /**
     * 特定の日課が特定の日に完了しているかを確認（後方互換性のため保持）
     * @param routineId - 日課ID
     * @param date - 日付文字列（YYYY-MM-DD）
     * @returns 完了状態
     */
    isRoutineCompleted: (state) => {
      return (routineId: string, date: string): boolean => {
        const logs = state.routineLogs[date] || []
        const log = logs.find(l => l.routineId === routineId)
        return log?.status === 'achieved'
      }
    },
  },

  /**
   * アクション（操作メソッド）
   */
  actions: {
    /**
     * 特定の月の日課をデータベースから取得
     * @param yearMonth - 年月文字列（YYYY-MM）
     */
    async fetchRoutines(yearMonth: string) {
      this.isLoading = true
      this.error = null
      try {
        this.routines = await getRoutinesByYearMonth(yearMonth)
      }
      catch (e) {
        this.error = e instanceof Error ? e.message : '日課の取得に失敗しました'
      }
      finally {
        this.isLoading = false
      }
    },

    /**
     * すべての日課をデータベースから取得
     */
    async fetchAllRoutines() {
      this.isLoading = true
      this.error = null
      try {
        this.allRoutines = await getAllRoutines()
      }
      catch (e) {
        this.error = e instanceof Error ? e.message : '日課の取得に失敗しました'
      }
      finally {
        this.isLoading = false
      }
    },

    /**
     * 特定の日の日課ログをデータベースから取得
     * @param date - 日付文字列（YYYY-MM-DD）
     */
    async fetchRoutineLogs(date: string) {
      this.isLoading = true
      this.error = null
      try {
        this.routineLogs[date] = await getRoutineLogsByDate(date)
      }
      catch (e) {
        this.error = e instanceof Error ? e.message : '日課ログの取得に失敗しました'
      }
      finally {
        this.isLoading = false
      }
    },

    /**
     * 月内の全日課ログを取得
     * @param yearMonth - 年月文字列（YYYY-MM形式）
     * @returns 月内の全日課ログリスト
     */
    async fetchMonthRoutineLogs(yearMonth: string): Promise<RoutineLog[]> {
      this.isLoading = true
      this.error = null
      try {
        // 月の最初の日と最後の日を計算
        const startDate = `${yearMonth}-01`
        const year = Number.parseInt(yearMonth.split('-')[0])
        const month = Number.parseInt(yearMonth.split('-')[1])
        const lastDay = new Date(year, month, 0).getDate()
        const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

        const logs = await getRoutineLogsByDateRange(startDate, endDate)
        return logs
      }
      catch (e) {
        this.error = e instanceof Error ? e.message : '日課ログの取得に失敗しました'
        return []
      }
      finally {
        this.isLoading = false
      }
    },

    /**
     * 新しい日課を作成
     * @param data - 日課データ
     * @returns 作成された日課
     */
    async createRoutine(data: { title: string, yearMonth: string }) {
      const newRoutine: Routine = {
        id: uuidv4(),
        title: data.title,
        yearMonth: data.yearMonth,
        order: this.routines.length,
        created_at: new Date(),
      }
      await addRoutine(newRoutine)
      this.routines.push(newRoutine)
      return newRoutine
    },

    /**
     * 日課を更新
     * @param id - 日課ID
     * @param data - 更新データ
     */
    async updateRoutineById(id: string, data: Partial<Omit<Routine, 'id' | 'created_at'>>) {
      const index = this.routines.findIndex(r => r.id === id)
      if (index !== -1) {
        const updatedRoutine = { ...this.routines[index], ...data }
        await updateRoutine(updatedRoutine)
        this.routines[index] = updatedRoutine
        return updatedRoutine
      }
      return null
    },

    /**
     * 日課を削除
     * @param id - 日課ID
     */
    async deleteRoutineById(id: string) {
      await deleteRoutine(id)
      const index = this.routines.findIndex(r => r.id === id)
      if (index !== -1) {
        this.routines.splice(index, 1)
      }
    },

    /**
     * 日課のステータスを循環的に変更（未確認 → 達成 → 未達成 → 未確認）
     * @param routineId - 日課ID
     * @param date - 日付文字列（YYYY-MM-DD）
     */
    async cycleRoutineStatus(routineId: string, date: string) {
      // 既存のログを取得
      let log = await getRoutineLog(routineId, date)

      // 現在のステータスを取得
      const currentStatus: RoutineStatus = log?.status ?? 'unconfirmed'

      // ステータスを循環: unconfirmed → achieved → not_achieved → unconfirmed
      let newStatus: RoutineStatus
      if (currentStatus === 'unconfirmed') {
        newStatus = 'achieved'
      }
      else if (currentStatus === 'achieved') {
        newStatus = 'not_achieved'
      }
      else {
        newStatus = 'unconfirmed'
      }

      if (log) {
        // 既存のログがある場合は更新
        log = {
          ...log,
          status: newStatus,
          completed_at: newStatus === 'achieved' ? new Date() : null,
        }
      }
      else {
        // 新規ログを作成
        log = {
          id: uuidv4(),
          routineId,
          date,
          status: newStatus,
          completed_at: newStatus === 'achieved' ? new Date() : null,
        }
      }

      await saveRoutineLog(log)

      // ストアの状態を更新
      if (!this.routineLogs[date]) {
        this.routineLogs[date] = []
      }

      const existingIndex = this.routineLogs[date].findIndex(l => l.routineId === routineId)
      if (existingIndex !== -1) {
        this.routineLogs[date][existingIndex] = log
      }
      else {
        this.routineLogs[date].push(log)
      }
    },

    /**
     * 日課の完了状態を切り替え（後方互換性のため保持）
     * @deprecated cycleRoutineStatus を使用してください
     * @param routineId - 日課ID
     * @param date - 日付文字列（YYYY-MM-DD）
     */
    async toggleRoutineComplete(routineId: string, date: string) {
      // 既存のログを取得
      let log = await getRoutineLog(routineId, date)

      if (log) {
        // 既存のログがある場合は完了状態を切り替え
        const newStatus: RoutineStatus = log.status === 'achieved' ? 'not_achieved' : 'achieved'
        log = {
          ...log,
          status: newStatus,
          completed_at: newStatus === 'achieved' ? new Date() : null,
        }
      }
      else {
        // 新規ログを作成
        log = {
          id: uuidv4(),
          routineId,
          date,
          status: 'achieved',
          completed_at: new Date(),
        }
      }

      await saveRoutineLog(log)

      // ストアの状態を更新
      if (!this.routineLogs[date]) {
        this.routineLogs[date] = []
      }

      const existingIndex = this.routineLogs[date].findIndex(l => l.routineId === routineId)
      if (existingIndex !== -1) {
        this.routineLogs[date][existingIndex] = log
      }
      else {
        this.routineLogs[date].push(log)
      }
    },

    /**
     * エクスポート用にすべての日課と日課ログを取得
     */
    async getAllDataForExport() {
      const routines = await getAllRoutines()
      const logs = await getAllRoutineLogs()
      return { routines, logs }
    },
  },
})
