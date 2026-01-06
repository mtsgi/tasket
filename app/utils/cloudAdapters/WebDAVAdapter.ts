/**
 * WebDAVストレージアダプター
 * WebDAV対応のクラウドストレージ（Nextcloud、ownCloud、Box、など）に対応
 */

import { BaseCloudAdapter } from './BaseCloudAdapter'
import type { BackupData, CloudBackupConfig } from '~/types/cloudBackup'
import { decrypt } from '~/utils/encryption'

export class WebDAVAdapter extends BaseCloudAdapter {
  private config: CloudBackupConfig

  constructor(config: CloudBackupConfig) {
    super()
    this.config = config
  }

  /**
   * Basic認証ヘッダーを生成
   */
  private async getAuthHeader(): Promise<string> {
    const username = this.config.accessKeyId ? await decrypt(this.config.accessKeyId) : ''
    const password = this.config.secretAccessKey ? await decrypt(this.config.secretAccessKey) : ''

    if (!username || !password) {
      throw new Error('認証情報が設定されていません')
    }

    const credentials = btoa(`${username}:${password}`)
    return `Basic ${credentials}`
  }

  /**
   * WebDAVディレクトリを作成
   */
  private async ensureDirectory(url: string, authHeader: string): Promise<void> {
    try {
      // PROPFINDでディレクトリの存在確認
      const checkResponse = await fetch(url, {
        method: 'PROPFIND',
        headers: {
          'Authorization': authHeader,
          'Depth': '0',
        },
      })

      // ディレクトリが存在しない場合は作成
      if (checkResponse.status === 404) {
        const mkcolResponse = await fetch(url, {
          method: 'MKCOL',
          headers: {
            'Authorization': authHeader,
          },
        })

        if (!mkcolResponse.ok && mkcolResponse.status !== 405) { // 405は既に存在する場合
          throw new Error(`ディレクトリの作成に失敗しました: ${mkcolResponse.status}`)
        }
      }
    }
    catch (error) {
      console.error('ディレクトリの作成/確認中にエラー:', error)
      // エラーは無視して続行（既に存在する可能性がある）
    }
  }

  /**
   * データをアップロード
   */
  async upload(data: BackupData, filename: string): Promise<string> {
    const endpoint = this.config.endpoint
    if (!endpoint) {
      throw new Error('エンドポイントが設定されていません')
    }

    const authHeader = await this.getAuthHeader()

    // tasket-backupsディレクトリを確保
    const baseUrl = endpoint.endsWith('/') ? endpoint : `${endpoint}/`
    const dirUrl = `${baseUrl}tasket-backups`
    await this.ensureDirectory(dirUrl, authHeader)

    // ファイルをアップロード
    const fileUrl = `${dirUrl}/${filename}`
    const body = JSON.stringify(data, null, 2)

    const response = await fetch(fileUrl, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`アップロードに失敗しました: ${response.status} ${errorText}`)
    }

    return `tasket-backups/${filename}`
  }

  /**
   * データをダウンロード
   */
  async download(path: string): Promise<BackupData> {
    const endpoint = this.config.endpoint
    if (!endpoint) {
      throw new Error('エンドポイントが設定されていません')
    }

    const authHeader = await this.getAuthHeader()
    const baseUrl = endpoint.endsWith('/') ? endpoint : `${endpoint}/`
    const fileUrl = `${baseUrl}${path}`

    const response = await fetch(fileUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
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
    const endpoint = this.config.endpoint
    if (!endpoint) {
      throw new Error('エンドポイントが設定されていません')
    }

    const authHeader = await this.getAuthHeader()
    const baseUrl = endpoint.endsWith('/') ? endpoint : `${endpoint}/`
    const dirUrl = `${baseUrl}tasket-backups`

    const response = await fetch(dirUrl, {
      method: 'PROPFIND',
      headers: {
        'Authorization': authHeader,
        'Depth': '1',
        'Content-Type': 'application/xml',
      },
      body: `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:getcontentlength/>
    <D:getlastmodified/>
  </D:prop>
</D:propfind>`,
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

    const responses = doc.getElementsByTagNameNS('DAV:', 'response')
    const files: Array<{ path: string, size: number, lastModified: Date }> = []

    for (let i = 0; i < responses.length; i++) {
      const responseElement = responses[i]
      if (!responseElement) continue

      const hrefElement = responseElement.getElementsByTagNameNS('DAV:', 'href')[0]
      if (!hrefElement) continue

      const href = hrefElement.textContent || ''

      // ディレクトリ自体はスキップ
      if (href.endsWith('/tasket-backups') || href.endsWith('/tasket-backups/')) {
        continue
      }

      // ファイル名を抽出
      const pathParts = href.split('/')
      const fileName = pathParts[pathParts.length - 1]
      if (!fileName || fileName === 'tasket-backups') {
        continue
      }

      const propstatElement = responseElement.getElementsByTagNameNS('DAV:', 'propstat')[0]
      if (!propstatElement) continue

      const propElement = propstatElement.getElementsByTagNameNS('DAV:', 'prop')[0]
      if (!propElement) continue

      const sizeElement = propElement.getElementsByTagNameNS('DAV:', 'getcontentlength')[0]
      const modifiedElement = propElement.getElementsByTagNameNS('DAV:', 'getlastmodified')[0]

      const size = sizeElement ? parseInt(sizeElement.textContent || '0', 10) : 0
      const lastModified = modifiedElement ? new Date(modifiedElement.textContent || '') : new Date()

      // 有効なデータのみ追加
      if (fileName && !isNaN(size) && !isNaN(lastModified.getTime())) {
        files.push({
          path: `tasket-backups/${fileName}`,
          size,
          lastModified,
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
      const endpoint = this.config.endpoint
      if (!endpoint) {
        return false
      }

      const authHeader = await this.getAuthHeader()

      // OPTIONSメソッドで接続確認
      const response = await fetch(endpoint, {
        method: 'OPTIONS',
        headers: {
          'Authorization': authHeader,
        },
      })

      return response.ok || response.status === 200
    }
    catch (error) {
      console.error('接続テストに失敗しました:', error)
      return false
    }
  }
}
