/**
 * クラウドストレージアダプターの基底クラス
 * 各クラウドプロバイダーの実装はこのクラスを継承
 */

import type { BackupData } from '~/types/cloudBackup'

export abstract class BaseCloudAdapter {
  /**
   * データをアップロード
   * @param data - アップロードするデータ
   * @param filename - ファイル名
   * @returns アップロード先のパス
   */
  abstract upload(data: BackupData, filename: string): Promise<string>

  /**
   * データをダウンロード
   * @param path - ダウンロード元のパス
   * @returns ダウンロードしたデータ
   */
  abstract download(path: string): Promise<BackupData>

  /**
   * バックアップファイルのリストを取得
   * @returns バックアップファイルのリスト
   */
  abstract list(): Promise<Array<{ path: string, size: number, lastModified: Date }>>

  /**
   * 接続テスト
   * @returns 接続が成功したかどうか
   */
  abstract testConnection(): Promise<boolean>
}
