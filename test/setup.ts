/**
 * Vitest グローバルセットアップファイル
 * すべてのテストファイルの実行前に読み込まれる
 */
import { vi } from 'vitest'

// ~/utils/db モジュール全体をモック化
// IndexedDB が存在しないテスト環境で Store テストを可能にする
vi.mock('~/utils/db', () => ({
  // Item 関連
  getAllItems: vi.fn().mockResolvedValue([]),
  getItemById: vi.fn().mockResolvedValue(undefined),
  addItem: vi.fn().mockResolvedValue(undefined),
  updateItem: vi.fn().mockResolvedValue(undefined),
  deleteItem: vi.fn().mockResolvedValue(undefined),
  getItemsByDateRange: vi.fn().mockResolvedValue([]),

  // DayTitle 関連
  getDayTitleByDate: vi.fn().mockResolvedValue(undefined),
  saveDayTitle: vi.fn().mockResolvedValue(undefined),
  deleteDayTitle: vi.fn().mockResolvedValue(undefined),
  getAllDayTitles: vi.fn().mockResolvedValue([]),

  // Routine 関連
  getRoutinesByYearMonth: vi.fn().mockResolvedValue([]),
  getAllRoutines: vi.fn().mockResolvedValue([]),
  addRoutine: vi.fn().mockResolvedValue(undefined),
  updateRoutine: vi.fn().mockResolvedValue(undefined),
  deleteRoutine: vi.fn().mockResolvedValue(undefined),

  // RoutineLog 関連
  getRoutineLogsByDate: vi.fn().mockResolvedValue([]),
  getRoutineLog: vi.fn().mockResolvedValue(undefined),
  saveRoutineLog: vi.fn().mockResolvedValue(undefined),
  getAllRoutineLogs: vi.fn().mockResolvedValue([]),
  getRoutineLogsByDateRange: vi.fn().mockResolvedValue([]),

  // Preset 関連
  getAllPresets: vi.fn().mockResolvedValue([]),
  getPresetById: vi.fn().mockResolvedValue(undefined),
  addPreset: vi.fn().mockResolvedValue(undefined),
  updatePreset: vi.fn().mockResolvedValue(undefined),
  deletePreset: vi.fn().mockResolvedValue(undefined),

  // AppSettings 関連
  getAppSettings: vi.fn().mockResolvedValue(undefined),
  saveAppSettings: vi.fn().mockResolvedValue(undefined),
  getAllAppSettings: vi.fn().mockResolvedValue([]),

  // HealthData 関連
  getHealthDataByDate: vi.fn().mockResolvedValue(undefined),
  getAllHealthData: vi.fn().mockResolvedValue([]),
  saveHealthData: vi.fn().mockResolvedValue(undefined),
  deleteHealthData: vi.fn().mockResolvedValue(undefined),
  getHealthDataByDateRange: vi.fn().mockResolvedValue([]),

  // CloudBackup 関連
  getAllCloudBackupConfigs: vi.fn().mockResolvedValue([]),
  getCloudBackupConfigById: vi.fn().mockResolvedValue(undefined),
  saveCloudBackupConfig: vi.fn().mockResolvedValue(undefined),
  deleteCloudBackupConfig: vi.fn().mockResolvedValue(undefined),
  getAllBackupHistory: vi.fn().mockResolvedValue([]),
  getBackupHistoryByConfigId: vi.fn().mockResolvedValue([]),
  addBackupHistory: vi.fn().mockResolvedValue(undefined),
  updateBackupHistory: vi.fn().mockResolvedValue(undefined),
  deleteBackupHistory: vi.fn().mockResolvedValue(undefined),

  // ユーザーデータ一括操作
  clearUserData: vi.fn().mockResolvedValue(undefined),

  // DB接続
  getDB: vi.fn(),
}))
