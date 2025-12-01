import type { Item, DailySummary, MonthlySummary, ExpenseRankingItem } from '~/types/item'
import { formatDate, getDaysInMonth, getStartOfMonth, addDays } from '~/utils/dateHelpers'

export function useStatistics() {
  function calculateDailySummary(items: Item[], dateString: string): DailySummary {
    const income = items
      .filter(item => item.type === 'income')
      .reduce((sum, item) => sum + item.amount, 0)

    const expense = items
      .filter(item => item.type === 'expense')
      .reduce((sum, item) => sum + item.amount, 0)

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

  function calculateMonthlySummary(items: Item[], yearMonth: string): MonthlySummary {
    const income = items
      .filter(item => item.type === 'income')
      .reduce((sum, item) => sum + item.amount, 0)

    const expense = items
      .filter(item => item.type === 'expense')
      .reduce((sum, item) => sum + item.amount, 0)

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

  function calculateExpenseRanking(items: Item[]): ExpenseRankingItem[] {
    const expenseItems = items.filter(item => item.type === 'expense')
    const groupedByTitle = expenseItems.reduce((acc, item) => {
      if (!acc[item.title]) {
        acc[item.title] = { totalAmount: 0, count: 0 }
      }
      acc[item.title].totalAmount += item.amount
      acc[item.title].count += 1
      return acc
    }, {} as Record<string, { totalAmount: number, count: number }>)

    return Object.entries(groupedByTitle)
      .map(([title, data]) => ({
        title,
        totalAmount: data.totalAmount,
        count: data.count,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
  }

  function calculateDailyTotals(items: Item[], yearMonth: string): {
    dates: string[]
    incomes: number[]
    expenses: number[]
    balances: number[]
  } {
    const startOfMonth = getStartOfMonth(yearMonth + '-01')
    const daysInMonth = getDaysInMonth(yearMonth + '-01')

    const dates: string[] = []
    const incomes: number[] = []
    const expenses: number[] = []
    const balances: number[] = []

    let cumulativeBalance = 0

    for (let i = 0; i < daysInMonth; i++) {
      const currentDate = addDays(startOfMonth, i)
      const dateString = formatDate(currentDate)
      dates.push(String(i + 1))

      const dayItems = items.filter((item) => {
        return formatDate(item.scheduled_at) === dateString
      })

      const dayIncome = dayItems
        .filter(item => item.type === 'income')
        .reduce((sum, item) => sum + item.amount, 0)

      const dayExpense = dayItems
        .filter(item => item.type === 'expense')
        .reduce((sum, item) => sum + item.amount, 0)

      cumulativeBalance += dayIncome - dayExpense

      incomes.push(dayIncome)
      expenses.push(dayExpense)
      balances.push(cumulativeBalance)
    }

    return { dates, incomes, expenses, balances }
  }

  function getItemCountByDate(items: Item[], dateString: string): {
    total: number
    completed: number
    income: number
    expense: number
  } {
    const dayItems = items.filter((item) => {
      return formatDate(item.scheduled_at) === dateString
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
