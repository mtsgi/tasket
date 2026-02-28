/**
 * useStatistics.ts のユニットテスト
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStatistics } from '~/composables/useStatistics'
import { createItem, createExpenseItem, createIncomeItem, resetIdCounter } from '../helpers/factories'

// useSettingsStoreのモック（calculateDailyTotals と getItemCountByDate で使用）
vi.mock('~/stores/settings', () => ({
  useSettingsStore: vi.fn(() => ({
    dateChangeLine: 0,
  })),
}))

describe('useStatistics', () => {
  beforeEach(() => {
    resetIdCounter()
  })

  const { calculateDailySummary, calculateMonthlySummary, calculateYearlySummary, calculateExpenseRanking, calculateDailyTotals, getItemCountByDate } = useStatistics()

  describe('calculateDailySummary', () => {
    it('空のアイテムリストでゼロのサマリーを返す', () => {
      const result = calculateDailySummary([], '2025-12-15')
      expect(result).toEqual({
        date: '2025-12-15',
        income: 0,
        expense: 0,
        balance: 0,
        completedTasks: 0,
        pendingTasks: 0,
      })
    })

    it('収入・支出の合計を正しく計算する', () => {
      const items = [
        createIncomeItem({ amount: 5000 }),
        createExpenseItem({ amount: 1000 }),
        createExpenseItem({ amount: 2000 }),
      ]
      const result = calculateDailySummary(items, '2025-12-15')
      expect(result.income).toBe(5000)
      expect(result.expense).toBe(3000)
      expect(result.balance).toBe(2000)
    })

    it('完了・未完了タスクを正しくカウントする', () => {
      const items = [
        createItem({ is_completed: true }),
        createItem({ is_completed: true }),
        createItem({ is_completed: false }),
      ]
      const result = calculateDailySummary(items, '2025-12-15')
      expect(result.completedTasks).toBe(2)
      expect(result.pendingTasks).toBe(1)
    })
  })

  describe('calculateMonthlySummary', () => {
    it('空のアイテムリストでゼロのサマリーを返す', () => {
      const result = calculateMonthlySummary([], '2025-12')
      expect(result.yearMonth).toBe('2025-12')
      expect(result.income).toBe(0)
      expect(result.expense).toBe(0)
      expect(result.balance).toBe(0)
    })

    it('月次の収支を正しく集計する', () => {
      const items = [
        createIncomeItem({ amount: 300000 }),
        createExpenseItem({ amount: 50000 }),
        createExpenseItem({ amount: 30000 }),
      ]
      const result = calculateMonthlySummary(items, '2025-12')
      expect(result.income).toBe(300000)
      expect(result.expense).toBe(80000)
      expect(result.balance).toBe(220000)
    })
  })

  describe('calculateYearlySummary', () => {
    it('年次サマリーを正しく計算する', () => {
      const items = [
        createIncomeItem({ amount: 100000 }),
        createExpenseItem({ amount: 40000 }),
      ]
      const result = calculateYearlySummary(items, '2025')
      expect(result.year).toBe('2025')
      expect(result.income).toBe(100000)
      expect(result.expense).toBe(40000)
      expect(result.balance).toBe(60000)
    })
  })

  describe('calculateExpenseRanking', () => {
    it('空のリストで空配列を返す', () => {
      expect(calculateExpenseRanking([])).toEqual([])
    })

    it('同じタイトルの支出をグループ化し金額順にソートする', () => {
      const items = [
        createExpenseItem({ title: '昼食代', amount: 1000 }),
        createExpenseItem({ title: '昼食代', amount: 1200 }),
        createExpenseItem({ title: '交通費', amount: 500 }),
        createExpenseItem({ title: '交通費', amount: 500 }),
        createExpenseItem({ title: '交通費', amount: 500 }),
      ]
      const result = calculateExpenseRanking(items)

      // 合計金額順（昼食代: 2200 > 交通費: 1500）
      expect(result[0]!.title).toBe('昼食代')
      expect(result[0]!.totalAmount).toBe(2200)
      expect(result[0]!.count).toBe(2)

      expect(result[1]!.title).toBe('交通費')
      expect(result[1]!.totalAmount).toBe(1500)
      expect(result[1]!.count).toBe(3)
    })

    it('支出以外のアイテムは除外する', () => {
      const items = [
        createIncomeItem({ title: '給料', amount: 300000 }),
        createItem({ title: 'タスク', type: 'todo' }),
        createExpenseItem({ title: '食費', amount: 500 }),
      ]
      const result = calculateExpenseRanking(items)
      expect(result).toHaveLength(1)
      expect(result[0]!.title).toBe('食費')
    })

    it('金額0の支出項目は除外する', () => {
      const items = [
        createExpenseItem({ title: 'ゼロ支出', amount: 0 }),
        createExpenseItem({ title: '有効支出', amount: 100 }),
      ]
      const result = calculateExpenseRanking(items)
      expect(result).toHaveLength(1)
      expect(result[0]!.title).toBe('有効支出')
    })
  })

  describe('calculateDailyTotals', () => {
    it('月の各日について収支合計と累計残高を計算する', () => {
      const items = [
        createIncomeItem({ amount: 1000, scheduled_at: new Date('2025-12-01T10:00:00') }),
        createExpenseItem({ amount: 300, scheduled_at: new Date('2025-12-01T12:00:00') }),
        createExpenseItem({ amount: 500, scheduled_at: new Date('2025-12-02T12:00:00') }),
      ]
      const result = calculateDailyTotals(items, '2025-12')

      expect(result.dates).toHaveLength(31) // 12月は31日
      expect(result.incomes[0]).toBe(1000) // 12/1の収入
      expect(result.expenses[0]).toBe(300) // 12/1の支出
      expect(result.balances[0]).toBe(700) // 12/1の累計残高
      expect(result.expenses[1]).toBe(500) // 12/2の支出
      expect(result.balances[1]).toBe(200) // 12/2の累計残高
    })
  })

  describe('getItemCountByDate', () => {
    it('特定の日のアイテム数と収支を返す', () => {
      const items = [
        createItem({ scheduled_at: new Date('2025-12-15T10:00:00'), is_completed: true }),
        createExpenseItem({ amount: 1000, scheduled_at: new Date('2025-12-15T12:00:00') }),
        createIncomeItem({ amount: 5000, scheduled_at: new Date('2025-12-15T14:00:00') }),
        createItem({ scheduled_at: new Date('2025-12-16T10:00:00') }), // 別の日
      ]
      const result = getItemCountByDate(items, '2025-12-15')

      expect(result.total).toBe(3)
      expect(result.completed).toBe(1)
      expect(result.income).toBe(5000)
      expect(result.expense).toBe(1000)
    })
  })
})
