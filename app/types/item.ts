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
  notes: string // 備考
  
  // 食事ログ関連（type='todo'で食事の場合に使用）
  mealLog?: MealLog // 食事ログデータ
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
 * 日課のステータス
 * - unconfirmed: 未確認（デフォルト）
 * - not_achieved: 未達成（明示的に未完了）
 * - achieved: 達成（完了）
 */
export type RoutineStatus = 'unconfirmed' | 'not_achieved' | 'achieved'

/**
 * 日課の達成記録
 * 特定の日に日課の状態を記録
 */
export interface RoutineLog {
  id: string // 一意のID（UUID）
  routineId: string // 対象の日課ID
  date: string // 達成日（YYYY-MM-DD形式）
  status: RoutineStatus // ステータス（未確認・未達成・達成）
  completed_at: Date | null // 完了日時（達成時のみ）

  // 後方互換性のため保持（マイグレーション時に使用）
  is_completed?: boolean
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

/**
 * プリセットのデータ構造
 * よく使うタスク設定を保存し、簡単に再利用できるようにする
 */
export interface Preset {
  id: string // 一意のID（UUID）
  title: string // プリセット名（アイテム名）
  time: string // 時刻（HH:mm形式）
  type: ItemType // アイテムの種別
  amount: number // 金額（TODOの場合は0）
  notes: string // 備考
  created_at: Date // 作成日時
}

/**
 * 食事ログのデータ構造
 * TODOアイテムに紐づけて食事内容を記録
 */
export interface MealLog {
  calories?: number // カロリー（kcal）
  protein?: number // タンパク質（g）
  carbs?: number // 炭水化物（g）
  fat?: number // 脂質（g）
  photo?: string // 写真（Base64エンコードされた画像データ）
  memo?: string // 自由メモ
}

/**
 * 健康データのデータ構造
 * 日ごとの健康状態を記録
 */
export interface HealthData {
  id: string // 一意のID（UUID）
  date: string // 記録日（YYYY-MM-DD形式）
  
  // 基本測定値
  weight?: number // 体重（kg）
  bodyFatPercentage?: number // 体脂肪率（%）
  muscleMass?: number // 筋肉量（kg）
  visceralFatLevel?: number // 内臓脂肪レベル
  basalMetabolicRate?: number // 基礎代謝量（kcal）
  
  // 循環器系
  systolicBloodPressure?: number // 最高血圧（mmHg）
  diastolicBloodPressure?: number // 最低血圧（mmHg）
  heartRate?: number // 脈拍/心拍数（bpm）
  
  // その他のバイタル
  bodyTemperature?: number // 体温（℃）
  spo2?: number // 血中酸素濃度（%）
  
  // 活動量
  sleepHours?: number // 睡眠時間（時間）
  steps?: number // 歩数
  exerciseMinutes?: number // 運動時間（分）
  caloriesBurned?: number // 消費カロリー（kcal）
  waterIntake?: number // 水分摂取量（ml）
  
  // 女性向け
  menstrualCycle?: 'menstruation' | 'follicular' | 'ovulation' | 'luteal' | null // 生理周期
  
  // その他
  medicationRecord?: string // 服薬記録
  healthMemo?: string // 体調に関する自由記録メモ
  
  created_at: Date // 作成日時
  updated_at: Date // 更新日時
}

/**
 * 月次健康サマリーのデータ構造
 * 特定の月の健康データをまとめたもの
 */
export interface MonthlyHealthSummary {
  yearMonth: string // 対象年月（YYYY-MM形式）
  
  // 平均値
  avgWeight?: number // 平均体重
  avgBodyFatPercentage?: number // 平均体脂肪率
  avgSystolicBloodPressure?: number // 平均最高血圧
  avgDiastolicBloodPressure?: number // 平均最低血圧
  avgHeartRate?: number // 平均心拍数
  
  // 合計値
  totalSteps?: number // 合計歩数
  totalExerciseMinutes?: number // 合計運動時間
  totalCaloriesIntake?: number // 合計摂取カロリー
  totalCaloriesBurned?: number // 合計消費カロリー
  
  // 先月との比較
  weightChange?: number // 体重変化（kg）
  bodyFatChange?: number // 体脂肪率変化（%）
  
  recordCount: number // 記録日数
}

/**
 * アプリ設定のデータ構造
 * チュートリアル状態、ロック設定、表示設定などのアプリケーション設定を保存
 */
export interface AppSettings {
  id: string // 設定ID（固定値 'app-settings' を使用）

  // チュートリアル関連
  hasSeenTutorial: boolean // チュートリアルを見たことがあるか

  // ロック設定関連
  lockEnabled: boolean // ロック機能の有効/無効
  pinHash: string | null // PINコードのハッシュ値
  biometricEnabled: boolean // 生体認証の有効/無効
  biometricCredentialId: string | null // 生体認証のクレデンシャルID
  maxAttempts: number // 最大試行回数
  lockTimeout: number // ロック解除後の再ロックタイムアウト（ミリ秒）

  // 表示設定関連
  darkMode: boolean // ダークモードの有効/無効
  backgroundImage: string | File // 背景画像（パスまたはFileオブジェクト）
  dateChangeLine: number // 日付変更線の時刻（0-23時）
  language: 'ja' | 'en' // 表示言語
  calendarDisplay: {
    showExpense: boolean // 支出合計の表示/非表示
    showIncome: boolean // 収入合計の表示/非表示
    showMainTask: boolean // その日のメインタスクの表示/非表示
    showTaskCount: boolean // タスクの合計数の表示/非表示
  }

  updated_at: Date // 更新日時
}
