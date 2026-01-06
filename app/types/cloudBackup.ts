/**
 * クラウドバックアップ機能の型定義
 * クラウドストレージへのデータバックアップ・復元を管理
 */

/**
 * サポートするクラウドプロバイダー
 */
export type CloudProvider = 's3-compatible' | 'webdav' | 'google-drive' | 'dropbox' | 'azure-blob' | 'custom'

/**
 * クラウドバックアップ設定のデータ構造
 */
export interface CloudBackupConfig {
  id: string // 設定ID（UUID）
  provider: CloudProvider // プロバイダー種別
  name: string // 設定名（ユーザーが識別しやすい名前）

  // S3互換の設定
  endpoint?: string // エンドポイントURL（例: https://s3.amazonaws.com）
  region?: string // リージョン（例: us-east-1）
  bucket?: string // バケット名
  accessKeyId?: string // アクセスキーID（暗号化済み）
  secretAccessKey?: string // シークレットアクセスキー（暗号化済み）

  // カスタムプロバイダーの設定
  customEndpoint?: string // カスタムエンドポイント
  customHeaders?: Record<string, string> // カスタムヘッダー（暗号化済み）

  isEnabled: boolean // この設定を有効にするか
  autoBackup: boolean // 自動バックアップを有効にするか
  autoBackupInterval?: number // 自動バックアップの間隔（時間）

  created_at: Date // 作成日時
  updated_at: Date // 更新日時
  last_backup_at?: Date // 最終バックアップ日時
}

/**
 * バックアップ履歴のデータ構造
 */
export interface BackupHistory {
  id: string // 履歴ID（UUID）
  configId: string // 使用した設定のID
  status: 'success' | 'failed' | 'in-progress' // バックアップ状態
  type: 'manual' | 'auto' // バックアップ種別
  size?: number // バックアップサイズ（バイト）
  itemCount?: number // バックアップしたアイテム数
  error?: string // エラーメッセージ（失敗時）
  remotePath?: string // リモートパス
  created_at: Date // バックアップ実行日時
}

/**
 * バックアップデータの構造（エクスポートと同じ形式）
 */
export interface BackupData {
  version: number
  exportedAt: string
  items: unknown[]
  routines?: unknown[]
  routineLogs?: unknown[]
  dayTitles?: unknown[]
  appSettings?: unknown[]
  healthData?: unknown[]
}
