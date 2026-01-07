/**
 * S3互換ストレージアダプター
 * AWS S3、MinIO、Wasabi、Cloudflare R2などのS3互換APIを使用
 */

import { BaseCloudAdapter } from './BaseCloudAdapter'
import type { BackupData, CloudBackupConfig } from '~/types/cloudBackup'
import { decrypt } from '~/utils/encryption'

export class S3CompatibleAdapter extends BaseCloudAdapter {
  private config: CloudBackupConfig

  constructor(config: CloudBackupConfig) {
    super()
    this.config = config
  }

  /**
   * AWS Signature Version 4を使用してリクエストに署名
   */
  private async signRequest(
    method: string,
    url: string,
    body?: string,
    headers: Record<string, string> = {},
  ): Promise<{ url: string, headers: Record<string, string> }> {
    // 認証情報を復号化
    const accessKeyId = this.config.accessKeyId ? await decrypt(this.config.accessKeyId) : ''
    const secretAccessKey = this.config.secretAccessKey ? await decrypt(this.config.secretAccessKey) : ''

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('認証情報が設定されていません')
    }

    // 日時の取得
    const now = new Date()
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '')
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')

    // ヘッダーの準備
    const urlObj = new URL(url)
    const host = urlObj.hostname
    const canonicalUri = urlObj.pathname || '/'
    
    // クエリパラメータをソートして正規化
    const queryParams = new URLSearchParams(urlObj.search)
    const sortedParams = Array.from(queryParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&')
    const canonicalQueryString = sortedParams

    // ペイロードのハッシュを先に計算
    const payloadHash = body
      ? await this.sha256(body)
      : await this.sha256('')

    const requestHeaders: Record<string, string> = {
      'host': host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      ...headers,
    }

    if (body && method !== 'GET') {
      requestHeaders['content-type'] = 'application/json'
    }

    // 正規化されたヘッダー
    const sortedHeaderKeys = Object.keys(requestHeaders).sort()
    const canonicalHeaders = sortedHeaderKeys
      .map(key => `${key.toLowerCase()}:${requestHeaders[key].trim()}\n`)
      .join('')

    const signedHeaders = sortedHeaderKeys.map(key => key.toLowerCase()).join(';')

    // 正規リクエスト
    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n')

    // 署名文字列
    const region = this.config.region || 'us-east-1'
    const service = 's3'
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      await this.sha256(canonicalRequest),
    ].join('\n')

    // 署名キーの導出
    const signingKey = await this.getSignatureKey(secretAccessKey, dateStamp, region, service)

    // 署名の計算
    const signature = await this.hmac(signingKey, stringToSign)

    // 認証ヘッダー
    const authorizationHeader = [
      `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`,
    ].join(', ')

    requestHeaders['authorization'] = authorizationHeader

    return { url, headers: requestHeaders }
  }

  /**
   * SHA256ハッシュを計算
   */
  private async sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message)
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * HMAC-SHA256を計算
   */
  private async hmac(key: CryptoKey | Uint8Array, message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message)

    let cryptoKey: CryptoKey
    if (key instanceof Uint8Array) {
      cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      )
    }
    else {
      cryptoKey = key
    }

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgBuffer)
    const signatureArray = Array.from(new Uint8Array(signature))
    return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * HMAC-SHA256を計算（バイナリ出力）
   */
  private async hmacBinary(key: Uint8Array, message: string): Promise<Uint8Array> {
    const msgBuffer = new TextEncoder().encode(message)
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgBuffer)
    return new Uint8Array(signature)
  }

  /**
   * 署名キーを導出
   */
  private async getSignatureKey(
    key: string,
    dateStamp: string,
    region: string,
    service: string,
  ): Promise<CryptoKey> {
    const kDate = await this.hmacBinary(new TextEncoder().encode('AWS4' + key), dateStamp)
    const kRegion = await this.hmacBinary(kDate, region)
    const kService = await this.hmacBinary(kRegion, service)
    const kSigning = await this.hmacBinary(kService, 'aws4_request')

    return await crypto.subtle.importKey(
      'raw',
      kSigning,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
  }

  /**
   * データをアップロード
   */
  async upload(data: BackupData, filename: string): Promise<string> {
    const endpoint = this.config.endpoint || 'https://s3.amazonaws.com'
    const bucket = this.config.bucket

    if (!bucket) {
      throw new Error('バケット名が設定されていません')
    }

    const path = `tasket-backups/${filename}`
    const url = `${endpoint}/${bucket}/${path}`

    const body = JSON.stringify(data, null, 2)

    // PUTリクエストではcontent-typeを明示的に指定
    const { url: signedUrl, headers } = await this.signRequest('PUT', url, body)

    const response = await fetch(signedUrl, {
      method: 'PUT',
      headers,
      body,
      mode: 'cors',
      credentials: 'omit',
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`アップロードに失敗しました: ${response.status} ${errorText}`)
    }

    return path
  }

  /**
   * データをダウンロード
   */
  async download(path: string): Promise<BackupData> {
    const endpoint = this.config.endpoint || 'https://s3.amazonaws.com'
    const bucket = this.config.bucket

    if (!bucket) {
      throw new Error('バケット名が設定されていません')
    }

    const url = `${endpoint}/${bucket}/${path}`

    const { url: signedUrl, headers } = await this.signRequest('GET', url)

    const response = await fetch(signedUrl, {
      method: 'GET',
      headers,
      mode: 'cors',
      credentials: 'omit',
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Download request failed:', {
        status: response.status,
        url: signedUrl,
        path,
        error: errorText,
      })
      throw new Error(`ダウンロードに失敗しました: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    return data as BackupData
  }

  /**
   * バックアップファイルのリストを取得
   */
  async list(): Promise<Array<{ path: string, size: number, lastModified: Date }>> {
    const endpoint = this.config.endpoint || 'https://s3.amazonaws.com'
    const bucket = this.config.bucket

    if (!bucket) {
      throw new Error('バケット名が設定されていません')
    }

    // クエリパラメータをURLエンコードして追加
    const prefix = encodeURIComponent('tasket-backups/')
    const url = `${endpoint}/${bucket}?list-type=2&prefix=${prefix}`

    const { url: signedUrl, headers } = await this.signRequest('GET', url)

    const response = await fetch(signedUrl, {
      method: 'GET',
      headers,
      mode: 'cors',
      credentials: 'omit',
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('List request failed:', {
        status: response.status,
        url: signedUrl,
        error: errorText,
      })
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

    const contents = doc.getElementsByTagName('Contents')

    const files: Array<{ path: string, size: number, lastModified: Date }> = []

    for (let i = 0; i < contents.length; i++) {
      const content = contents[i]
      if (!content) continue

      const keyElement = content.getElementsByTagName('Key')[0]
      const sizeElement = content.getElementsByTagName('Size')[0]
      const lastModifiedElement = content.getElementsByTagName('LastModified')[0]

      if (keyElement && sizeElement && lastModifiedElement) {
        const key = keyElement.textContent || ''
        const size = parseInt(sizeElement.textContent || '0', 10)
        const lastModified = new Date(lastModifiedElement.textContent || '')

        // 有効なデータのみ追加
        if (key && !isNaN(size) && !isNaN(lastModified.getTime())) {
          files.push({
            path: key,
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
      await this.list()
      return true
    }
    catch (error) {
      console.error('接続テストに失敗しました:', error)
      return false
    }
  }
}
