/**
 * IndexedDB 接続管理および v8 → v9 マイグレーション統合テスト
 * fake-indexeddb を使用して実際の IndexedDB ライフサイクルを検証する
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.unmock('~/utils/db')

async function loadDBModule() {
  return await import('~/utils/db')
}

async function resetIndexedDB(dbName: string) {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(dbName)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => resolve()
  })
}

/** v8 相当のスキーマとデータを投入した DB を作成して閉じる */
async function seedVersion8DB(dbName: string): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(dbName, 8)
    req.onupgradeneeded = () => {
      const database = req.result
      const itemsStore = database.createObjectStore('items', { keyPath: 'id' })
      itemsStore.createIndex('by-scheduled-at', 'scheduled_at')
      itemsStore.createIndex('by-type', 'type')
      itemsStore.createIndex('by-is-completed', 'is_completed')
      itemsStore.createIndex('by-is-important', 'is_important')

      const dayTitlesStore = database.createObjectStore('dayTitles', { keyPath: 'id' })
      dayTitlesStore.createIndex('by-date', 'date')

      const routinesStore = database.createObjectStore('routines', { keyPath: 'id' })
      routinesStore.createIndex('by-yearMonth', 'yearMonth')

      const routineLogsStore = database.createObjectStore('routineLogs', { keyPath: 'id' })
      routineLogsStore.createIndex('by-routineId', 'routineId')
      routineLogsStore.createIndex('by-date', 'date')

      const presetsStore = database.createObjectStore('presets', { keyPath: 'id' })
      presetsStore.createIndex('by-type', 'type')

      database.createObjectStore('appSettings', { keyPath: 'id' })

      const healthDataStore = database.createObjectStore('healthData', { keyPath: 'id' })
      healthDataStore.createIndex('by-date', 'date')

      const cloudBackupConfigsStore = database.createObjectStore('cloudBackupConfigs', { keyPath: 'id' })
      cloudBackupConfigsStore.createIndex('by-provider', 'provider')

      const backupHistoryStore = database.createObjectStore('backupHistory', { keyPath: 'id' })
      backupHistoryStore.createIndex('by-configId', 'configId')
      backupHistoryStore.createIndex('by-status', 'status')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      ['items', 'dayTitles', 'routines', 'routineLogs', 'presets', 'appSettings', 'healthData', 'cloudBackupConfigs', 'backupHistory'],
      'readwrite',
    )
    tx.objectStore('items').put({
      id: 'v8-item-1',
      title: 'v8の既存タスク',
      amount: 1200,
      type: 'expense',
      is_completed: true,
      is_important: true,
      scheduled_at: new Date('2026-10-01T10:00:00Z'),
      executed_at: new Date('2026-10-01T10:30:00Z'),
      created_at: new Date('2026-10-01T09:00:00Z'),
      notes: 'v8メモ',
    })
    tx.objectStore('dayTitles').put({
      id: 'v8-title-1',
      date: '2026-10-01',
      title: 'テストの日',
      created_at: new Date('2026-10-01T09:00:00Z'),
    })
    tx.objectStore('routines').put({
      id: 'v8-routine-1',
      title: '朝のストレッチ',
      yearMonth: '2026-10',
      order: 0,
      created_at: new Date('2026-10-01T08:00:00Z'),
    })
    tx.objectStore('routineLogs').put({
      id: 'v8-log-1',
      routineId: 'v8-routine-1',
      date: '2026-10-01',
      status: 'achieved',
      completed_at: new Date('2026-10-01T08:30:00Z'),
    })
    tx.objectStore('presets').put({
      id: 'v8-preset-1',
      title: 'ランチ',
      time: '12:00',
      type: 'expense',
      amount: 900,
      notes: '',
      created_at: new Date('2026-10-01T08:00:00Z'),
    })
    tx.objectStore('appSettings').put({
      id: 'app-settings',
      tutorialCompleted: true,
      darkMode: true,
      dateChangeLine: 4,
      updated_at: new Date('2026-10-01T08:00:00Z'),
    })
    tx.objectStore('healthData').put({
      id: 'v8-health-1',
      date: '2026-10-01',
      weight: 62.5,
      created_at: new Date('2026-10-01T07:00:00Z'),
      updated_at: new Date('2026-10-01T07:00:00Z'),
    })
    tx.objectStore('cloudBackupConfigs').put({
      id: 'v8-config-1',
      provider: 'webdav',
      name: '既存設定',
      isEnabled: true,
      autoBackup: false,
      created_at: new Date('2026-10-01T07:00:00Z'),
      updated_at: new Date('2026-10-01T07:00:00Z'),
    })
    tx.objectStore('backupHistory').put({
      id: 'v8-history-1',
      configId: 'v8-config-1',
      status: 'success',
      type: 'manual',
      created_at: new Date('2026-10-01T07:00:00Z'),
    })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  db.close()
}

describe('IndexedDB 接続管理と v8 → v9 マイグレーション', () => {
  beforeEach(async () => {
    const dbMod = await loadDBModule()
    dbMod.closeDB()
    await resetIndexedDB(dbMod.DB_NAME)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    const dbMod = await loadDBModule()
    dbMod.closeDB()
    await resetIndexedDB(dbMod.DB_NAME)
  })

  it('既存の v8 データをすべて保持したまま v9 へ移行でき、dailyActivities を利用できる', async () => {
    const dbMod = await loadDBModule()
    await seedVersion8DB(dbMod.DB_NAME)

    const db = await dbMod.getDB()
    expect(db.version).toBe(9)
    expect(db.objectStoreNames.contains('dailyActivities')).toBe(true)

    const [items, dayTitles, routines, routineLogs, presets, appSettings, healthData, configs, histories] = await Promise.all([
      dbMod.getAllItems(),
      dbMod.getAllDayTitles(),
      dbMod.getAllRoutines(),
      dbMod.getAllRoutineLogs(),
      dbMod.getAllPresets(),
      dbMod.getAppSettings(),
      dbMod.getAllHealthData(),
      dbMod.getAllCloudBackupConfigs(),
      dbMod.getAllBackupHistory(),
    ])

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: 'v8-item-1', title: 'v8の既存タスク', is_important: true, is_completed: true })
    expect(dayTitles).toHaveLength(1)
    expect(dayTitles[0]!.title).toBe('テストの日')
    expect(routines).toHaveLength(1)
    expect(routines[0]!.title).toBe('朝のストレッチ')
    expect(routineLogs).toHaveLength(1)
    expect(routineLogs[0]!.status).toBe('achieved')
    expect(presets).toHaveLength(1)
    expect(presets[0]!.title).toBe('ランチ')
    expect(appSettings).toMatchObject({ darkMode: true, dateChangeLine: 4 })
    expect(healthData).toHaveLength(1)
    expect(healthData[0]!.weight).toBe(62.5)
    expect(configs).toHaveLength(1)
    expect(configs[0]!.name).toBe('既存設定')
    expect(histories).toHaveLength(1)
    expect(histories[0]!.status).toBe('success')

    // 新規 dailyActivities ストアへの記録と重複防止
    const createdFirst = await dbMod.recordDailyActivity({
      date: '2026-10-07',
      firstOpenedAt: new Date('2026-10-07T08:00:00Z'),
      dateChangeLine: 4,
    })
    const createdSecond = await dbMod.recordDailyActivity({
      date: '2026-10-07',
      firstOpenedAt: new Date('2026-10-07T09:00:00Z'),
      dateChangeLine: 4,
    })
    expect(createdFirst).toBe(true)
    expect(createdSecond).toBe(false)
    expect(await dbMod.getAllDailyActivities()).toHaveLength(1)
  })

  it('他タブにより DB アップグレードがブロックされた場合に通知し、解放後に解除して移行完了する', async () => {
    const dbMod = await loadDBModule()
    await seedVersion8DB(dbMod.DB_NAME)

    // 他タブの v8 接続が開いたまま（versionchange で閉じない）状態を再現
    const blockingConn = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbMod.DB_NAME, 8)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    const blockedEvents: boolean[] = []
    const unsubscribe = dbMod.subscribeDBBlocked(blocked => blockedEvents.push(blocked))

    try {
      const upgradePromise = dbMod.getDB()

      // blocked イベント発火まで待機
      await vi.waitFor(() => {
        expect(dbMod.isDBUpgradeBlocked()).toBe(true)
      })
      expect(blockedEvents).toEqual([true])

      // 他タブを閉じると自動でアップグレードが進行・完了する
      blockingConn.close()
      const db = await upgradePromise
      expect(db.version).toBe(9)
      expect(dbMod.isDBUpgradeBlocked()).toBe(false)
      expect(blockedEvents).toEqual([true, false])
    }
    finally {
      unsubscribe()
      blockingConn.close()
    }
  })

  it('blocking 発火時に既存接続を閉じてキャッシュをリセットし、他タブのアップグレードを妨げない', async () => {
    const dbMod = await loadDBModule()
    const v9Db = await dbMod.getDB()
    const closeSpy = vi.spyOn(v9Db, 'close')

    // 別タブがより新しいバージョン (v10) を開こうとする状況を再現
    const v10Db = await new Promise<IDBDatabase>((resolve, reject) => {
      let blocked = false
      const req = indexedDB.open(dbMod.DB_NAME, 10)
      req.onblocked = () => {
        blocked = true
      }
      req.onsuccess = () => {
        expect(blocked).toBe(false)
        resolve(req.result)
      }
      req.onerror = () => reject(req.error)
    })

    expect(closeSpy).toHaveBeenCalledTimes(1)
    v10Db.close()
  })

  it('terminated 発火後にキャッシュがリセットされ、次回の getDB() で再接続できる', async () => {
    const dbMod = await loadDBModule()
    const firstDb = await dbMod.getDB()

    // fake-indexeddb の FakeEventTarget に準拠した close イベントでブラウザ異常切断を再現
    const closeEvent = {
      type: 'close',
      initialized: true,
      dispatched: false,
      eventPath: [],
      bubbles: false,
      cancelable: false,
      defaultPrevented: false,
      propagationStopped: false,
      immediatePropagationStopped: false,
      CAPTURING_PHASE: 1,
      AT_TARGET: 2,
      BUBBLING_PHASE: 3,
    } as unknown as Event
    firstDb.dispatchEvent(closeEvent)

    const secondDb = await dbMod.getDB()
    expect(secondDb).not.toBe(firstDb)
    expect(secondDb.version).toBe(9)
  })

  it('接続失敗後にキャッシュがクリアされ、再試行で接続できる', async () => {
    const dbMod = await loadDBModule()

    // 実際の VersionError を発生させるため一時的に v10 DB を作成
    const futureDb = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbMod.DB_NAME, 10)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    futureDb.close()

    await expect(dbMod.getDB()).rejects.toThrow()
    expect(dbMod.isDBUpgradeBlocked()).toBe(false)

    // 失敗要因を解消するとキャッシュが残らず再試行で接続できる
    await resetIndexedDB(dbMod.DB_NAME)
    const db = await dbMod.getDB()
    expect(db.version).toBe(9)
  })

  it('deleteDB() は他タブでブロックされた場合に成功扱いにせず、解放後に実際の削除を完了する', async () => {
    const dbMod = await loadDBModule()
    await dbMod.addItem({
      id: 'item-to-delete',
      title: '削除対象',
      amount: 0,
      type: 'todo',
      is_completed: false,
      is_important: false,
      scheduled_at: new Date('2026-10-07T10:00:00Z'),
      executed_at: null,
      created_at: new Date('2026-10-07T09:00:00Z'),
      notes: '',
    })

    // 別タブの未クローズ接続を再現
    const otherTabConn = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbMod.DB_NAME, 9)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    let settled = false
    const deletePromise = dbMod.deleteDB().then(() => {
      settled = true
    })

    try {
      await vi.waitFor(() => {
        expect(dbMod.isDBUpgradeBlocked()).toBe(true)
      })
      // ブロック中に成功扱い（resolve）されていないこと
      await new Promise(resolve => setTimeout(resolve, 20))
      expect(settled).toBe(false)

      // 他タブを閉じると実際の削除が完了して resolve する
      otherTabConn.close()
      await deletePromise
      expect(settled).toBe(true)
      expect(dbMod.isDBUpgradeBlocked()).toBe(false)

      // 再度開くとデータが空になっていること
      expect(await dbMod.getAllItems()).toEqual([])
    }
    finally {
      otherTabConn.close()
    }
  })
})
