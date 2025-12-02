/**
 * 金額フォーマットユーティリティ
 * 日本円形式での金額表示を提供します。
 */

/**
 * 金額を日本円形式にフォーマット（例: ¥1,234）
 * @param amount - フォーマットする金額
 * @returns 日本円形式の文字列
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
  }).format(amount)
}

/**
 * 数値をカンマ区切りにフォーマット（例: 1,234）
 * @param amount - フォーマットする数値
 * @returns カンマ区切りの文字列
 */
export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('ja-JP').format(amount)
}

/**
 * 金額を符号付き日本円形式にフォーマット（例: +¥1,234）
 * 正の数には + を付け、負の数はそのまま - が付く
 * @param amount - フォーマットする金額
 * @returns 符号付き日本円形式の文字列
 */
export function formatCurrencyWithSign(amount: number): string {
  const prefix = amount >= 0 ? '+' : ''
  return prefix + formatCurrency(amount)
}
