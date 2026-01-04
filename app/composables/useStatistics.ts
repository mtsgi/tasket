/**
 * 統計計算コンポーザブル
 * 日次・月次のサマリーや支出ランキングの計算を提供します。
 */
import type { Item, DailySummary, MonthlySummary, ExpenseRankingItem } from '~/types/item'
import { formatDate, getDaysInMonth, getStartOfMonth, addDays, getStartOfEffectiveDay, getEndOfEffectiveDay } from '~/utils/dateHelpers'
import { useSettingsStore } from '~/stores/settings'

export function useStatistics() {
  /**
   * 日次サマリーを計算
   * @param items - 対象のアイテムリスト
   * @param dateString - 対象日（YYYY-MM-DD）
   * @returns 日次サマリー
   */
  function calculateDailySummary(items: Item[], dateString: string): DailySummary {
    // 収入の合計を計算
    const income = items
      .filter(item => item.type === 'income')
      .reduce((sum, item) => sum + item.amount, 0)

    // 支出の合計を計算
    const expense = items
      .filter(item => item.type === 'expense')
      .reduce((sum, item) => sum + item.amount, 0)

    // 完了・未完了タスク数をカウント
    const completedTasks = items.filter(item => item.is_completed).length
    const pendingTasks = items.filter(item => !item.is_completed).length

    return {
      date: dateString,
      income,
      expense,
      balance: income - expense,
      completedTasks,
      pendingTasks,
    }
  }

  /**
   * 月次サマリーを計算
   * @param items - 対象のアイテムリスト
   * @param yearMonth - 対象年月（YYYY-MM）
   * @returns 月次サマリー
   */
  function calculateMonthlySummary(items: Item[], yearMonth: string): MonthlySummary {
    // 収入の合計を計算
    const income = items
      .filter(item => item.type === 'income')
      .reduce((sum, item) => sum + item.amount, 0)

    // 支出の合計を計算
    const expense = items
      .filter(item => item.type === 'expense')
      .reduce((sum, item) => sum + item.amount, 0)

    // 完了・未完了タスク数をカウント
    const completedTasks = items.filter(item => item.is_completed).length
    const pendingTasks = items.filter(item => !item.is_completed).length

    return {
      yearMonth,
      income,
      expense,
      balance: income - expense,
      completedTasks,
      pendingTasks,
    }
  }

  /**
   * 支出ランキングを計算
   * 同じタイトルの支出をグループ化し、金額順にソート
   * @param items - 対象のアイテムリスト
   * @returns 支出ランキング（金額の多い順、0円の項目は除外）
   */
  function calculateExpenseRanking(items: Item[]): ExpenseRankingItem[] {
    // 支出アイテムのみをフィルタリング
    const expenseItems = items.filter(item => item.type === 'expense')

    // タイトルごとにグループ化
    const groupedByTitle = expenseItems.reduce((acc, item) => {
      if (!acc[item.title]) {
        acc[item.title] = { totalAmount: 0, count: 0 }
      }
      const group = acc[item.title]
      if (group) {
        group.totalAmount += item.amount
        group.count += 1
      }
      return acc
    }, {} as Record<string, { totalAmount: number, count: number }>)

    // 金額の多い順にソートして返す（0円の項目は除外）
    return Object.entries(groupedByTitle)
      .map(([title, data]) => ({
        title,
        totalAmount: data.totalAmount,
        count: data.count,
      }))
      .filter(item => item.totalAmount > 0)
      .sort((a, b) => b.totalAmount - a.totalAmount)
  }

  /**
   * 日別の収支合計を計算（グラフ表示用）
   * 日付変更線を考慮してアイテムをグループ化
   * @param items - 対象のアイテムリスト
   * @param yearMonth - 対象年月（YYYY-MM）
   * @returns 日別の収入・支出・累計残高
   */
  function calculateDailyTotals(items: Item[], yearMonth: string): {
    dates: string[]
    incomes: number[]
    expenses: number[]
    balances: number[]
  } {
    const settingsStore = useSettingsStore()
    const dateChangeLine = settingsStore.dateChangeLine

    const startOfMonth = getStartOfMonth(yearMonth + '-01')
    const daysInMonth = getDaysInMonth(yearMonth + '-01')

    const dates: string[] = []
    const incomes: number[] = []
    const expenses: number[] = []
    const balances: number[] = []

    let cumulativeBalance = 0 // 累計残高

    // 月の各日について計算
    for (let i = 0; i < daysInMonth; i++) {
      const currentDate = addDays(startOfMonth, i)
      const dateString = formatDate(currentDate)
      dates.push(String(i + 1)) // グラフのラベル用（日にちのみ）

      // 日付変更線を考慮した開始・終了時刻を取得
      const startOfDay = getStartOfEffectiveDay(dateString, dateChangeLine)
      const endOfDay = getEndOfEffectiveDay(dateString, dateChangeLine)

      // その日のアイテムをフィルタリング（日付変更線を考慮）
      const dayItems = items.filter((item) => {
        const scheduledAt = new Date(item.scheduled_at)
        return scheduledAt >= startOfDay && scheduledAt <= endOfDay
      })

      // 日別の収入を計算
      const dayIncome = dayItems
        .filter(item => item.type === 'income')
        .reduce((sum, item) => sum + item.amount, 0)

      // 日別の支出を計算
      const dayExpense = dayItems
        .filter(item => item.type === 'expense')
        .reduce((sum, item) => sum + item.amount, 0)

      // 累計残高を更新
      cumulativeBalance += dayIncome - dayExpense

      incomes.push(dayIncome)
      expenses.push(dayExpense)
      balances.push(cumulativeBalance)
    }

    return { dates, incomes, expenses, balances }
  }

  /**
   * 特定の日のアイテム数と金額を取得（カレンダー表示用）
   * 日付変更線を考慮してアイテムをフィルタリング
   * @param items - 対象のアイテムリスト
   * @param dateString - 対象日（YYYY-MM-DD）
   * @returns アイテム数と収支
   */
  function getItemCountByDate(items: Item[], dateString: string): {
    total: number
    completed: number
    income: number
    expense: number
  } {
    const settingsStore = useSettingsStore()
    const dateChangeLine = settingsStore.dateChangeLine

    // 日付変更線を考慮した開始・終了時刻を取得
    const startOfDay = getStartOfEffectiveDay(dateString, dateChangeLine)
    const endOfDay = getEndOfEffectiveDay(dateString, dateChangeLine)

    // その日のアイテムをフィルタリング（日付変更線を考慮）
    const dayItems = items.filter((item) => {
      const scheduledAt = new Date(item.scheduled_at)
      return scheduledAt >= startOfDay && scheduledAt <= endOfDay
    })

    return {
      total: dayItems.length,
      completed: dayItems.filter(item => item.is_completed).length,
      income: dayItems
        .filter(item => item.type === 'income')
        .reduce((sum, item) => sum + item.amount, 0),
      expense: dayItems
        .filter(item => item.type === 'expense')
        .reduce((sum, item) => sum + item.amount, 0),
    }
  }

  return {
    calculateDailySummary,
    calculateMonthlySummary,
    calculateExpenseRanking,
    calculateDailyTotals,
    getItemCountByDate,
  }
}
