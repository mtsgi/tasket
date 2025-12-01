export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
  }).format(amount)
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('ja-JP').format(amount)
}

export function formatCurrencyWithSign(amount: number): string {
  const prefix = amount >= 0 ? '+' : ''
  return prefix + formatCurrency(amount)
}
