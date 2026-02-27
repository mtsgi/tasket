/**
 * テスト用ファクトリ関数
 * テストデータの生成に使用するヘルパー
 */
import type { Item, ItemType, HealthData, Preset, Routine, RoutineLog, RoutineStatus, DayTitle, MealLog } from '../../app/types/item'

let counter = 0

/** テスト用にユニークなIDを生成 */
function generateId(): string {
  counter++
  return `test-id-${counter}`
}

/** カウンターをリセット（テスト間で呼び出す） */
export function resetIdCounter(): void {
  counter = 0
}

/** テスト用Itemを生成 */
export function createItem(overrides: Partial<Item> = {}): Item {
  return {
    id: generateId(),
    title: 'テストアイテム',
    amount: 0,
    type: 'todo' as ItemType,
    is_completed: false,
    is_important: false,
    scheduled_at: new Date('2025-12-15T10:00:00'),
    executed_at: null,
    created_at: new Date('2025-12-01T00:00:00'),
    notes: '',
    ...overrides,
  }
}

/** テスト用の支出Itemを生成 */
export function createExpenseItem(overrides: Partial<Item> = {}): Item {
  return createItem({
    type: 'expense',
    amount: 1000,
    title: '支出テスト',
    ...overrides,
  })
}

/** テスト用の収入Itemを生成 */
export function createIncomeItem(overrides: Partial<Item> = {}): Item {
  return createItem({
    type: 'income',
    amount: 5000,
    title: '収入テスト',
    ...overrides,
  })
}

/** テスト用の食事ログ付きItemを生成 */
export function createMealItem(overrides: Partial<Item> = {}, mealOverrides: Partial<MealLog> = {}): Item {
  return createItem({
    type: 'todo',
    title: '食事テスト',
    mealLog: {
      calories: 500,
      protein: 20,
      carbs: 60,
      fat: 15,
      memo: '',
      ...mealOverrides,
    },
    ...overrides,
  })
}

/** テスト用HealthDataを生成 */
export function createHealthData(overrides: Partial<HealthData> = {}): HealthData {
  return {
    id: generateId(),
    date: '2025-12-15',
    weight: 70,
    bodyFatPercentage: 20,
    created_at: new Date('2025-12-15T00:00:00'),
    updated_at: new Date('2025-12-15T00:00:00'),
    ...overrides,
  }
}

/** テスト用Presetを生成 */
export function createPreset(overrides: Partial<Preset> = {}): Preset {
  return {
    id: generateId(),
    title: 'テストプリセット',
    time: '09:00',
    type: 'todo' as ItemType,
    amount: 0,
    notes: '',
    created_at: new Date('2025-12-01T00:00:00'),
    ...overrides,
  }
}

/** テスト用Routineを生成 */
export function createRoutine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: generateId(),
    title: 'テスト日課',
    yearMonth: '2025-12',
    order: 0,
    created_at: new Date('2025-12-01T00:00:00'),
    ...overrides,
  }
}

/** テスト用RoutineLogを生成 */
export function createRoutineLog(overrides: Partial<RoutineLog> = {}): RoutineLog {
  return {
    id: generateId(),
    routineId: 'routine-1',
    date: '2025-12-15',
    status: 'unconfirmed' as RoutineStatus,
    completed_at: null,
    ...overrides,
  }
}

/** テスト用DayTitleを生成 */
export function createDayTitle(overrides: Partial<DayTitle> = {}): DayTitle {
  return {
    id: generateId(),
    date: '2025-12-15',
    title: 'テストタイトル',
    created_at: new Date('2025-12-01T00:00:00'),
    ...overrides,
  }
}
