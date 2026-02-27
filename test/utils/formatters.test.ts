/**
 * formatters.ts のユニットテスト
 */
import { describe, it, expect } from 'vitest'
import { formatCurrency, formatNumber, formatCurrencyWithSign, normalizeKana } from '~/utils/formatters'

describe('formatCurrency', () => {
  it('正の数値を日本円形式にフォーマットする', () => {
    expect(formatCurrency(1234)).toBe('￥1,234')
  })

  it('0をフォーマットする', () => {
    expect(formatCurrency(0)).toBe('￥0')
  })

  it('負の数値をフォーマットする', () => {
    expect(formatCurrency(-500)).toBe('-￥500')
  })

  it('大きな数値をフォーマットする', () => {
    expect(formatCurrency(1000000)).toBe('￥1,000,000')
  })

  it('小数を含む数値は整数に丸められる', () => {
    // JPYは小数点以下を丸める
    const result = formatCurrency(1234.56)
    expect(result).toBe('￥1,235')
  })
})

describe('formatNumber', () => {
  it('正の数値をカンマ区切りにフォーマットする', () => {
    expect(formatNumber(1234)).toBe('1,234')
  })

  it('0をフォーマットする', () => {
    expect(formatNumber(0)).toBe('0')
  })

  it('負の数値をフォーマットする', () => {
    expect(formatNumber(-1234)).toBe('-1,234')
  })

  it('大きな数値をフォーマットする', () => {
    expect(formatNumber(1000000)).toBe('1,000,000')
  })
})

describe('formatCurrencyWithSign', () => {
  it('正の数値に+記号を付ける', () => {
    expect(formatCurrencyWithSign(1000)).toBe('+￥1,000')
  })

  it('0に+記号を付ける', () => {
    expect(formatCurrencyWithSign(0)).toBe('+￥0')
  })

  it('負の数値はそのまま-記号が付く', () => {
    expect(formatCurrencyWithSign(-500)).toBe('-￥500')
  })
})

describe('normalizeKana', () => {
  it('ひらがなをカタカナに変換する', () => {
    expect(normalizeKana('あいう')).toBe('アイウ')
  })

  it('カタカナはそのまま', () => {
    expect(normalizeKana('アイウ')).toBe('アイウ')
  })

  it('混在した文字列を変換する', () => {
    expect(normalizeKana('あいうABC123')).toBe('アイウABC123')
  })

  it('空文字列を処理する', () => {
    expect(normalizeKana('')).toBe('')
  })

  it('ひらがな以外の文字はそのまま', () => {
    expect(normalizeKana('漢字テスト')).toBe('漢字テスト')
  })
})
