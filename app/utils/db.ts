import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Item } from '~/types/item'

interface TasketDB extends DBSchema {
  items: {
    key: string
    value: Item
    indexes: {
      'by-scheduled-at': Date
      'by-type': string
      'by-is-completed': boolean
    }
  }
}

let dbPromise: Promise<IDBPDatabase<TasketDB>> | null = null

export function getDB(): Promise<IDBPDatabase<TasketDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TasketDB>('tasket-db', 1, {
      upgrade(db) {
        const store = db.createObjectStore('items', { keyPath: 'id' })
        store.createIndex('by-scheduled-at', 'scheduled_at')
        store.createIndex('by-type', 'type')
        store.createIndex('by-is-completed', 'is_completed')
      },
    })
  }
  return dbPromise
}

export async function getAllItems(): Promise<Item[]> {
  const db = await getDB()
  const items = await db.getAll('items')
  return items.map(item => ({
    ...item,
    scheduled_at: new Date(item.scheduled_at),
    executed_at: item.executed_at ? new Date(item.executed_at) : null,
    created_at: new Date(item.created_at),
  }))
}

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

export async function addItem(item: Item): Promise<void> {
  const db = await getDB()
  await db.add('items', item)
}

export async function updateItem(item: Item): Promise<void> {
  const db = await getDB()
  await db.put('items', item)
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('items', id)
}

export async function getItemsByDateRange(startDate: Date, endDate: Date): Promise<Item[]> {
  const items = await getAllItems()
  return items.filter((item) => {
    const scheduledAt = new Date(item.scheduled_at)
    return scheduledAt >= startDate && scheduledAt < endDate
  })
}
