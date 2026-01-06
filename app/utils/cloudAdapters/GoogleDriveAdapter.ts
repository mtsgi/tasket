/**
 * Google Driveストレージアダプター
 * Google Drive APIを使用したバックアップ・復元機能
 */

import { BaseCloudAdapter } from './BaseCloudAdapter'
import type { BackupData, CloudBackupConfig } from '~/types/cloudBackup'
import { decrypt } from '~/utils/encryption'

export class GoogleDriveAdapter extends BaseCloudAdapter {
  private config: CloudBackupConfig
  private accessToken: string | null = null

  constructor(config: CloudBackupConfig) {
    super()
    this.config = config
  }

  /**
   * アクセストークンを取得
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken
    }

    // OAuth2アクセストークンを復号化
    const token = this.config.accessKeyId ? await decrypt(this.config.accessKeyId) : ''
    if (!token) {
      throw new Error('アクセストークンが設定されていません')
    }

    this.accessToken = token
    return token
  }

  /**
   * フォルダを検索または作成
   */
  private async ensureFolder(folderName: string, accessToken: string): Promise<string> {
    // フォルダを検索
    const searchUrl = 'https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
    })

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!searchResponse.ok) {
      throw new Error(`フォルダ検索に失敗しました: ${searchResponse.status}`)
    }

    const searchData = await searchResponse.json()

    // フォルダが存在する場合はそのIDを返す
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id
    }

    // フォルダが存在しない場合は作成
    const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    })

    if (!createResponse.ok) {
      throw new Error(`フォルダ作成に失敗しました: ${createResponse.status}`)
    }

    const createData = await createResponse.json()
    return createData.id
  }

  /**
   * データをアップロード
   */
  async upload(data: BackupData, filename: string): Promise<string> {
    const accessToken = await this.getAccessToken()

    // tasket-backupsフォルダを確保
    const folderId = await this.ensureFolder('tasket-backups', accessToken)

    // メタデータとコンテンツを準備
    const metadata = {
      name: filename,
      parents: [folderId],
      mimeType: 'application/json',
    }

    const body = JSON.stringify(data, null, 2)

    // マルチパートアップロード
    const boundary = '-------tasket-backup-boundary'
    const multipartBody = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      body,
      `--${boundary}--`,
    ].join('\r\n')

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`アップロードに失敗しました: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    return result.id
  }

  /**
   * データをダウンロード
   */
  async download(fileId: string): Promise<BackupData> {
    const accessToken = await this.getAccessToken()

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
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

    // tasket-backupsフォルダを検索
    const folderId = await this.ensureFolder('tasket-backups', accessToken)

    // フォルダ内のファイルを取得
    const listUrl = 'https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, size, modifiedTime)',
      orderBy: 'modifiedTime desc',
    })

    const response = await fetch(listUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`リスト取得に失敗しました: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    const files: Array<{ path: string, size: number, lastModified: Date }> = []

    if (data.files) {
      for (const file of data.files) {
        files.push({
          path: file.id,
          size: parseInt(file.size || '0', 10),
          lastModified: new Date(file.modifiedTime),
        })
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

      // ユーザー情報を取得して接続確認
      const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
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
