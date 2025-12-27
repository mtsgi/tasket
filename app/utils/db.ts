/**
 * IndexedDB データベース操作ユーティリティ
 * アプリケーションのデータ永続化を担当します。
 * idb ライブラリを使用してIndexedDBを操作します。
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Item, DayTitle, Routine, RoutineLog, Preset } from '~/types/item'

/**
 * データベーススキーマの型定義
 * itemsストア、dayTitlesストア、routinesストア、routineLogsストア、presetsストアを定義
 */
interface TasketDB extends DBSchema {
  items: {
    key: string
    value: Item
    indexes: {
      'by-scheduled-at': Date // 予定日時でのインデックス
      'by-type': string // 種別でのインデックス
      'by-is-completed': boolean // 完了状態でのインデックス
    }
  }
  dayTitles: {
    key: string
    value: DayTitle
    indexes: {
      'by-date': string // 日付でのインデックス
    }
  }
  routines: {
    key: string
    value: Routine
    indexes: {
      'by-yearMonth': string // 年月でのインデックス
    }
  }
  routineLogs: {
    key: string
    value: RoutineLog
    indexes: {
      'by-routineId': string // 日課IDでのインデックス
      'by-date': string // 日付でのインデックス
    }
  }
  presets: {
    key: string
    value: Preset
    indexes: {
      'by-type': string // 種別でのインデックス
    }
  }
}

// データベース接続のシングルトンインスタンス
let dbPromise: Promise<IDBPDatabase<TasketDB>> | null = null

/**
 * データベース接続を取得
 * 初回呼び出し時にデータベースを初期化し、以降は同じ接続を再利用
 */
export function getDB(): Promise<IDBPDatabase<TasketDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TasketDB>('tasket-db', 4, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // バージョン1からのアップグレード
        if (oldVersion < 1) {
          // itemsオブジェクトストアを作成
          const itemsStore = db.createObjectStore('items', { keyPath: 'id' })
          itemsStore.createIndex('by-scheduled-at', 'scheduled_at')
          itemsStore.createIndex('by-type', 'type')
          itemsStore.createIndex('by-is-completed', 'is_completed')
        }

        // バージョン2の新機能: 日タイトル、日課、日課ログ
        if (oldVersion < 2) {
          // dayTitlesオブジェクトストアを作成
          const dayTitlesStore = db.createObjectStore('dayTitles', { keyPath: 'id' })
          dayTitlesStore.createIndex('by-date', 'date')

          // routinesオブジェクトストアを作成
          const routinesStore = db.createObjectStore('routines', { keyPath: 'id' })
          routinesStore.createIndex('by-yearMonth', 'yearMonth')

          // routineLogsオブジェクトストアを作成
          const routineLogsStore = db.createObjectStore('routineLogs', { keyPath: 'id' })
          routineLogsStore.createIndex('by-routineId', 'routineId')
          routineLogsStore.createIndex('by-date', 'date')
        }

        // バージョン3の新機能: プリセット
        if (oldVersion < 3) {
          // presetsオブジェクトストアを作成
          const presetsStore = db.createObjectStore('presets', { keyPath: 'id' })
          presetsStore.createIndex('by-type', 'type')
        }

        // バージョン4の新機能: 日課ログのステータス三値化
        if (oldVersion < 4) {
          // 既存の日課ログを新しい形式に移行（バージョン2以降に日課ログが存在）
          if (oldVersion >= 2) {
            const routineLogsStore = transaction.objectStore('routineLogs')
            const request = routineLogsStore.getAll()

            request.onsuccess = () => {
              const logs = request.result as RoutineLog[]
              logs.forEach((log) => {
                // is_completedからstatusに変換
                if ('is_completed' in log && !('status' in log)) {
                  const migratedLog = {
                    ...log,
                    status: log.is_completed ? ('achieved' as const) : ('not_achieved' as const),
                  }
                  // 後方互換性のためis_completedは保持
                  routineLogsStore.put(migratedLog)
                }
              })
            }
          }
        }
      },
    })
  }
  return dbPromise
}

// ============================================
// Items（アイテム）関連の操作
// ============================================

/**
 * すべてのアイテムを取得
 * 日付型を適切に復元して返す
 */
export async function getAllItems(): Promise<Item[]> {
  const db = await getDB()
  const items = await db.getAll('items')
  // IndexedDBから取得した日付文字列をDateオブジェクトに変換
  return items.map(item => ({
    ...item,
    scheduled_at: new Date(item.scheduled_at),
    executed_at: item.executed_at ? new Date(item.executed_at) : null,
    created_at: new Date(item.created_at),
    notes: item.notes || '', // 既存データの互換性のため
  }))
}

/**
 * IDでアイテムを取得
 * @param id - アイテムのID
 * @returns アイテム、または見つからない場合はundefined
 */
export async function getItemById(id: string): Promise<Item | undefined> {
  const db = await getDB()
  const item = await db.get('items', id)
  if (item) {
    return {
      ...item,
      scheduled_at: new Date(item.scheduled_at),
      executed_at: item.executed_at ? new Date(item.executed_at) : null,
      created_at: new Date(item.created_at),
      notes: item.notes || '', // 既存データの互換性のため
    }
  }
  return undefined
}

/**
 * アイテムを追加
 * @param item - 追加するアイテム
 */
export async function addItem(item: Item): Promise<void> {
  const db = await getDB()
  await db.add('items', item)
}

/**
 * アイテムを更新
 * @param item - 更新するアイテム
 */
export async function updateItem(item: Item): Promise<void> {
  const db = await getDB()
  await db.put('items', item)
}

/**
 * アイテムを削除
 * @param id - 削除するアイテムのID
 */
export async function deleteItem(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('items', id)
}

/**
 * 日付範囲でアイテムを取得
 * @param startDate - 開始日
 * @param endDate - 終了日
 * @returns 範囲内のアイテムリスト
 */
export async function getItemsByDateRange(startDate: Date, endDate: Date): Promise<Item[]> {
  const items = await getAllItems()
  return items.filter((item) => {
    const scheduledAt = new Date(item.scheduled_at)
    return scheduledAt >= startDate && scheduledAt < endDate
  })
}

// ============================================
// DayTitles（日タイトル）関連の操作
// ============================================

/**
 * 日付で日タイトルを取得
 * @param date - 日付文字列（YYYY-MM-DD形式）
 * @returns 日タイトル、または見つからない場合はundefined
 */
export async function getDayTitleByDate(date: string): Promise<DayTitle | undefined> {
  const db = await getDB()
  const titles = await db.getAllFromIndex('dayTitles', 'by-date', date)
  if (titles.length > 0) {
    return {
      ...titles[0],
      created_at: new Date(titles[0].created_at),
    }
  }
  return undefined
}

/**
 * 日タイトルを追加または更新
 * @param dayTitle - 日タイトル
 */
export async function saveDayTitle(dayTitle: DayTitle): Promise<void> {
  const db = await getDB()
  await db.put('dayTitles', dayTitle)
}

/**
 * 日タイトルを削除
 * @param id - 日タイトルのID
 */
export async function deleteDayTitle(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('dayTitles', id)
}

/**
 * すべての日タイトルを取得
 * @returns すべての日タイトルリスト
 */
export async function getAllDayTitles(): Promise<DayTitle[]> {
  const db = await getDB()
  const titles = await db.getAll('dayTitles')
  return titles.map(title => ({
    ...title,
    created_at: new Date(title.created_at),
  }))
}

// ============================================
// Routines（日課）関連の操作
// ============================================

/**
 * 年月で日課を取得
 * @param yearMonth - 年月文字列（YYYY-MM形式）
 * @returns その月の日課リスト（順序順）
 */
export async function getRoutinesByYearMonth(yearMonth: string): Promise<Routine[]> {
  const db = await getDB()
  const routines = await db.getAllFromIndex('routines', 'by-yearMonth', yearMonth)
  return routines
    .map(routine => ({
      ...routine,
      created_at: new Date(routine.created_at),
    }))
    .sort((a, b) => a.order - b.order)
}

/**
 * すべての日課を取得
 * @returns すべての日課リスト
 */
export async function getAllRoutines(): Promise<Routine[]> {
  const db = await getDB()
  const routines = await db.getAll('routines')
  return routines.map(routine => ({
    ...routine,
    created_at: new Date(routine.created_at),
  }))
}

/**
 * 日課を追加
 * @param routine - 追加する日課
 */
export async function addRoutine(routine: Routine): Promise<void> {
  const db = await getDB()
  await db.add('routines', routine)
}

/**
 * 日課を更新
 * @param routine - 更新する日課
 */
export async function updateRoutine(routine: Routine): Promise<void> {
  const db = await getDB()
  await db.put('routines', routine)
}

/**
 * 日課を削除
 * @param id - 削除する日課のID
 */
export async function deleteRoutine(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('routines', id)
  // 関連する日課ログも削除
  const logs = await db.getAllFromIndex('routineLogs', 'by-routineId', id)
  for (const log of logs) {
    await db.delete('routineLogs', log.id)
  }
}

// ============================================
// RoutineLogs（日課ログ）関連の操作
// ============================================

/**
 * 日付で日課ログを取得
 * @param date - 日付文字列（YYYY-MM-DD形式）
 * @returns その日の日課ログリスト
 */
export async function getRoutineLogsByDate(date: string): Promise<RoutineLog[]> {
  const db = await getDB()
  const logs = await db.getAllFromIndex('routineLogs', 'by-date', date)
  return logs.map(log => ({
    ...log,
    completed_at: log.completed_at ? new Date(log.completed_at) : null,
  }))
}

/**
 * 日課IDと日付で日課ログを取得
 * @param routineId - 日課ID
 * @param date - 日付文字列（YYYY-MM-DD形式）
 * @returns 日課ログ、または見つからない場合はundefined
 */
export async function getRoutineLog(routineId: string, date: string): Promise<RoutineLog | undefined> {
  const db = await getDB()
  const logs = await db.getAllFromIndex('routineLogs', 'by-date', date)
  const log = logs.find(l => l.routineId === routineId)
  if (log) {
    return {
      ...log,
      completed_at: log.completed_at ? new Date(log.completed_at) : null,
    }
  }
  return undefined
}

/**
 * 日課ログを追加または更新
 * @param log - 日課ログ
 */
export async function saveRoutineLog(log: RoutineLog): Promise<void> {
  const db = await getDB()
  await db.put('routineLogs', log)
}

/**
 * すべての日課ログを取得
 * @returns すべての日課ログリスト
 */
export async function getAllRoutineLogs(): Promise<RoutineLog[]> {
  const db = await getDB()
  const logs = await db.getAll('routineLogs')
  return logs.map(log => ({
    ...log,
    completed_at: log.completed_at ? new Date(log.completed_at) : null,
  }))
}

/**
 * 日付範囲で日課ログを取得
 * @param startDate - 開始日（YYYY-MM-DD形式）
 * @param endDate - 終了日（YYYY-MM-DD形式）
 * @returns 指定期間の日課ログリスト
 */
export async function getRoutineLogsByDateRange(startDate: string, endDate: string): Promise<RoutineLog[]> {
  const db = await getDB()
  const range = IDBKeyRange.bound(startDate, endDate)
  const logs = await db.getAllFromIndex('routineLogs', 'by-date', range)
  return logs.map(log => ({
    ...log,
    completed_at: log.completed_at ? new Date(log.completed_at) : null,
  }))
}

// ============================================
// Presets（プリセット）関連の操作
// ============================================

/**
 * すべてのプリセットを取得
 * @returns すべてのプリセットリスト（作成日時の新しい順）
 */
export async function getAllPresets(): Promise<Preset[]> {
  const db = await getDB()
  const presets = await db.getAll('presets')
  return presets
    .map(preset => ({
      ...preset,
      created_at: new Date(preset.created_at),
    }))
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
}

/**
 * IDでプリセットを取得
 * @param id - プリセットのID
 * @returns プリセット、または見つからない場合はundefined
 */
export async function getPresetById(id: string): Promise<Preset | undefined> {
  const db = await getDB()
  const preset = await db.get('presets', id)
  if (preset) {
    return {
      ...preset,
      created_at: new Date(preset.created_at),
    }
  }
  return undefined
}

/**
 * プリセットを追加
 * @param preset - 追加するプリセット
 */
export async function addPreset(preset: Preset): Promise<void> {
  const db = await getDB()
  await db.add('presets', preset)
}

/**
 * プリセットを更新
 * @param preset - 更新するプリセット
 */
export async function updatePreset(preset: Preset): Promise<void> {
  const db = await getDB()
  await db.put('presets', preset)
}

/**
 * プリセットを削除
 * @param id - 削除するプリセットのID
 */
export async function deletePreset(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('presets', id)
}
