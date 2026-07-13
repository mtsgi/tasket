import { backspaceCalculatorExpression, evaluateCalculatorExpression } from '~/utils/calculator'
import { describe, expect, it } from 'vitest'

describe('calculator utils', () => {
  describe('evaluateCalculatorExpression', () => {
    it('四則演算の優先順位を考慮して計算できる', () => {
      expect(evaluateCalculatorExpression('1+2×3-4÷2')).toBe(5)
    })

    it('小数計算ができる', () => {
      expect(evaluateCalculatorExpression('0.1+0.2')).toBe(0.3)
    })

    it('ゼロ除算の場合はnullを返す', () => {
      expect(evaluateCalculatorExpression('10÷0')).toBeNull()
    })

    it('不正な式の場合はnullを返す', () => {
      expect(evaluateCalculatorExpression('1++2')).toBeNull()
    })
  })

  describe('backspaceCalculatorExpression', () => {
    it('末尾1文字を削除できる', () => {
      expect(backspaceCalculatorExpression('123')).toBe('12')
    })

    it('空になったら0を返す', () => {
      expect(backspaceCalculatorExpression('5')).toBe('0')
    })
  })
})
