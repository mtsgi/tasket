export type ItemType = 'todo' | 'expense' | 'income'

export interface Item {
  id: string
  title: string
  amount: number
  type: ItemType
  is_completed: boolean
  scheduled_at: Date
  executed_at: Date | null
  created_at: Date
}

export interface DailySummary {
  date: string
  income: number
  expense: number
  balance: number
  completedTasks: number
  pendingTasks: number
}

export interface MonthlySummary {
  yearMonth: string
  income: number
  expense: number
  balance: number
  completedTasks: number
  pendingTasks: number
}

export interface ExpenseRankingItem {
  title: string
  totalAmount: number
  count: number
}
