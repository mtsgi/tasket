/**
 * Azure Blob Storageアダプター
 * Azure Blob Storage APIを使用したバックアップ・復元機能
 */

import { BaseCloudAdapter } from './BaseCloudAdapter'
import type { BackupData, CloudBackupConfig } from '~/types/cloudBackup'
import { decrypt } from '~/utils/encryption'

export class AzureBlobAdapter extends BaseCloudAdapter {
  private config: CloudBackupConfig

  constructor(config: CloudBackupConfig) {
    super()
    this.config = config
  }

  /**
   * SAS署名を生成（簡略版 - 実際にはサーバー側で生成すべき）
   */
  private async getSASToken(): Promise<string> {
    const token = this.config.secretAccessKey ? await decrypt(this.config.secretAccessKey) : ''
    if (!token) {
      throw new Error('SASトークンが設定されていません')
    }
    return token
  }

  /**
   * ストレージアカウント名を取得
   */
  private async getAccountName(): Promise<string> {
    const accountName = this.config.accessKeyId ? await decrypt(this.config.accessKeyId) : ''
    if (!accountName) {
      throw new Error('ストレージアカウント名が設定されていません')
    }
    return accountName
  }

  /**
   * データをアップロード
   */
  async upload(data: BackupData, filename: string): Promise<string> {
    const accountName = await this.getAccountName()
    const sasToken = await this.getSASToken()
    const containerName = this.config.bucket || 'tasket-backups'
    const blobName = `backups/${filename}`

    const url = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`
    const body = JSON.stringify(data, null, 2)

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': 'application/json',
      },
      body,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`アップロードに失敗しました: ${response.status} ${errorText}`)
    }

    return blobName
  }

  /**
   * データをダウンロード
   */
  async download(blobName: string): Promise<BackupData> {
    const accountName = await this.getAccountName()
    const sasToken = await this.getSASToken()
    const containerName = this.config.bucket || 'tasket-backups'

    const url = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`

    const response = await fetch(url, {
      method: 'GET',
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
    const accountName = await this.getAccountName()
    const sasToken = await this.getSASToken()
    const containerName = this.config.bucket || 'tasket-backups'

    const url = `https://${accountName}.blob.core.windows.net/${containerName}?${sasToken}&restype=container&comp=list&prefix=backups/`

    const response = await fetch(url, {
      method: 'GET',
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`リスト取得に失敗しました: ${response.status} ${errorText}`)
    }

    const xml = await response.text()

    // XMLをパース
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'text/xml')

    // パースエラーをチェック
    const parserError = doc.querySelector('parsererror')
    if (parserError) {
      throw new Error('XMLパースエラー: ' + parserError.textContent)
    }

    const blobs = doc.getElementsByTagName('Blob')
    const files: Array<{ path: string, size: number, lastModified: Date }> = []

    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i]
      if (!blob) continue

      const nameElement = blob.getElementsByTagName('Name')[0]
      const propertiesElement = blob.getElementsByTagName('Properties')[0]

      if (nameElement && propertiesElement) {
        const sizeElement = propertiesElement.getElementsByTagName('Content-Length')[0]
        const modifiedElement = propertiesElement.getElementsByTagName('Last-Modified')[0]

        const name = nameElement.textContent || ''
        const size = sizeElement ? parseInt(sizeElement.textContent || '0', 10) : 0
        const lastModified = modifiedElement ? new Date(modifiedElement.textContent || '') : new Date()

        // 有効なデータのみ追加
        if (name && !isNaN(size) && !isNaN(lastModified.getTime())) {
          files.push({
            path: name,
            size,
            lastModified,
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
      const accountName = await this.getAccountName()
      const sasToken = await this.getSASToken()
      const containerName = this.config.bucket || 'tasket-backups'

      // コンテナのプロパティを取得して接続確認
      const url = `https://${accountName}.blob.core.windows.net/${containerName}?${sasToken}&restype=container`

      const response = await fetch(url, {
        method: 'GET',
      })

      return response.ok || response.status === 404 // コンテナが存在しなくても接続は成功
    }
    catch (error) {
      console.error('接続テストに失敗しました:', error)
      return false
    }
  }
}
