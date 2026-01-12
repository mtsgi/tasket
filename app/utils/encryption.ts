/**
 * 暗号化ユーティリティ
 * Web Crypto APIを使用して認証情報を安全に暗号化・復号化
 */

/**
 * 暗号化キーを生成または取得
 * ブラウザのlocalStorageに保存（初回のみ生成）
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyName = 'tasket-encryption-key'

  // 既存のキーを取得
  const storedKey = localStorage.getItem(keyName)

  if (storedKey) {
    // 保存されているキーをインポート
    const keyData = Uint8Array.from(atob(storedKey), c => c.charCodeAt(0))
    return await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    )
  }

  // 新しいキーを生成
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )

  // キーをエクスポートして保存
  const exportedKey = await crypto.subtle.exportKey('raw', key)
  const keyData = new Uint8Array(exportedKey)
  const keyString = btoa(String.fromCharCode(...keyData))
  localStorage.setItem(keyName, keyString)

  return key
}

/**
 * データを暗号化
 * @param data - 暗号化する文字列
 * @returns 暗号化されたデータ（Base64エンコード）
 */
export async function encrypt(data: string): Promise<string> {
  const key = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBuffer,
  )

  // IVと暗号化データを結合
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encryptedBuffer), iv.length)

  // Base64エンコード
  return btoa(String.fromCharCode(...combined))
}

/**
 * データを復号化
 * @param encryptedData - 暗号化されたデータ（Base64エンコード）
 * @returns 復号化された文字列
 */
export async function decrypt(encryptedData: string): Promise<string> {
  try {
    const key = await getEncryptionKey()

    // Base64デコード
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0))

    // IVと暗号化データを分離
    const iv = combined.slice(0, 12)
    const data = combined.slice(12)

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data,
    )

    const decoder = new TextDecoder()
    return decoder.decode(decryptedBuffer)
  }
  catch (error) {
    console.error('復号化に失敗しました:', error)
    throw new Error('復号化に失敗しました')
  }
}

/**
 * 暗号化キーをリセット（すべての暗号化データが使用不可になる）
 */
export function resetEncryptionKey(): void {
  localStorage.removeItem('tasket-encryption-key')
}
