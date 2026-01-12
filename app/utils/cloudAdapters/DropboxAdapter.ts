/**
 * Dropboxストレージアダプター
 * Dropbox APIを使用したバックアップ・復元機能
 */

import { BaseCloudAdapter } from './BaseCloudAdapter'
import type { BackupData, CloudBackupConfig } from '~/types/cloudBackup'
import { decrypt } from '~/utils/encryption'

export class DropboxAdapter extends BaseCloudAdapter {
  private config: CloudBackupConfig

  constructor(config: CloudBackupConfig) {
    super()
    this.config = config
  }

  /**
   * アクセストークンを取得
   */
  private async getAccessToken(): Promise<string> {
    const token = this.config.accessKeyId ? await decrypt(this.config.accessKeyId) : ''
    if (!token) {
      throw new Error('アクセストークンが設定されていません')
    }
    return token
  }

  /**
   * データをアップロード
   */
  async upload(data: BackupData, filename: string): Promise<string> {
    const accessToken = await this.getAccessToken()
    const path = `/tasket-backups/${filename}`
    const body = JSON.stringify(data, null, 2)

    const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path,
          mode: 'add',
          autorename: true,
          mute: false,
        }),
      },
      body,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`アップロードに失敗しました: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    return result.path_display
  }

  /**
   * データをダウンロード
   */
  async download(path: string): Promise<BackupData> {
    const accessToken = await this.getAccessToken()

    const response = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ path }),
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`ダウンロードに失敗しました: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    return data as BackupData
  }

  /**
   * バックアップファイルのリストを取得
   */
  async list(): Promise<Array<{ path: string, size: number, lastModified: Date }>> {
    const accessToken = await this.getAccessToken()

    const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: '/tasket-backups',
        recursive: false,
        include_deleted: false,
      }),
    })

    if (!response.ok) {
      // フォルダが存在しない場合は空配列を返す
      if (response.status === 409) {
        return []
      }
      const errorText = await response.text()
      throw new Error(`リスト取得に失敗しました: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    const files: Array<{ path: string, size: number, lastModified: Date }> = []

    if (data.entries) {
      for (const entry of data.entries) {
        if (entry['.tag'] === 'file') {
          files.push({
            path: entry.path_display,
            size: entry.size,
            lastModified: new Date(entry.server_modified),
          })
        }
      }
    }

    return files
  }

  /**
   * 接続テスト
   */
  async testConnection(): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken()

      // アカウント情報を取得して接続確認
      const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      return response.ok
    }
    catch (error) {
      console.error('接続テストに失敗しました:', error)
      return false
    }
  }
}
