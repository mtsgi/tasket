/**
 * アイテム種別の型定義
 * - todo: やることリスト
 * - expense: 支出
 * - income: 収入
 */
export type ItemType = 'todo' | 'expense' | 'income'

/**
 * アイテムのデータ構造
 * すべてのタスクと収支を統一的に管理するためのインターフェース
 */
export interface Item {
  id: string // 一意のID（UUID）
  title: string // アイテム名
  amount: number // 金額（TODOの場合は0）
  type: ItemType // アイテムの種別
  is_completed: boolean // 完了状態
  scheduled_at: Date // 予定日時
  executed_at: Date | null // 実行日時（完了時に設定）
  created_at: Date // 作成日時
}

/**
 * 日ごとのタイトル（その日のメインタスク）
 * 各日に設定できる「今日やること」の見出し
 */
export interface DayTitle {
  id: string // 一意のID（UUID）
  date: string // 対象日（YYYY-MM-DD形式）
  title: string // タイトル
  created_at: Date // 作成日時
}

/**
 * 月ごとの日課（ルーティン）
 * 毎日繰り返し行う習慣やタスクの定義
 */
export interface Routine {
  id: string // 一意のID（UUID）
  yearMonth: string // 対象年月（YYYY-MM形式）
  title: string // 日課のタイトル
  order: number // 表示順序
  created_at: Date // 作成日時
}

/**
 * 日課の達成記録
 * 特定の日に日課を完了したかどうかを記録
 */
export interface RoutineLog {
  id: string // 一意のID（UUID）
  routineId: string // 対象の日課ID
  date: string // 達成日（YYYY-MM-DD形式）
  is_completed: boolean // 完了状態
  completed_at: Date | null // 完了日時
}

/**
 * 日次サマリーのデータ構造
 * 特定の日の収支とタスク完了状況をまとめたもの
 */
export interface DailySummary {
  date: string // 対象日（YYYY-MM-DD形式）
  income: number // 収入合計
  expense: number // 支出合計
  balance: number // 収支差額（収入 - 支出）
  completedTasks: number // 完了タスク数
  pendingTasks: number // 未完了タスク数
}

/**
 * 月次サマリーのデータ構造
 * 特定の月の収支とタスク完了状況をまとめたもの
 */
export interface MonthlySummary {
  yearMonth: string // 対象年月（YYYY-MM形式）
  income: number // 収入合計
  expense: number // 支出合計
  balance: number // 収支差額（収入 - 支出）
  completedTasks: number // 完了タスク数
  pendingTasks: number // 未完了タスク数
}

/**
 * 支出ランキングアイテムのデータ構造
 * 同じタイトルの支出をグループ化してランキング表示するためのもの
 */
export interface ExpenseRankingItem {
  title: string // 支出項目名
  totalAmount: number // 合計金額
  count: number // 出現回数
}
