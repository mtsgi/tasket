/**
 * IndexedDB データベース操作ユーティリティ
 * アプリケーションのデータ永続化を担当します。
 * idb ライブラリを使用してIndexedDBを操作します。
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Item } from '~/types/item'

/**
 * データベーススキーマの型定義
 * itemsストアとそのインデックスを定義
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
}

// データベース接続のシングルトンインスタンス
let dbPromise: Promise<IDBPDatabase<TasketDB>> | null = null

/**
 * データベース接続を取得
 * 初回呼び出し時にデータベースを初期化し、以降は同じ接続を再利用
 */
export function getDB(): Promise<IDBPDatabase<TasketDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TasketDB>('tasket-db', 1, {
      upgrade(db) {
        // itemsオブジェクトストアを作成
        const store = db.createObjectStore('items', { keyPath: 'id' })
        // インデックスを作成（検索の高速化のため）
        store.createIndex('by-scheduled-at', 'scheduled_at')
        store.createIndex('by-type', 'type')
        store.createIndex('by-is-completed', 'is_completed')
      },
    })
  }
  return dbPromise
}

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
