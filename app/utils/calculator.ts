const operatorTokens = ['+', '-', '*', '/']

/**
 * 電卓入力式を評価して数値結果を返す
 */
export function evaluateCalculatorExpression(expression: string): number | null {
  const normalized = expression
    .replaceAll('×', '*')
    .replaceAll('÷', '/')
    .replace(/\s+/g, '')

  if (!normalized)
    return null

  const parsed = tokenizeExpression(normalized)
  if (!parsed)
    return null

  const { numbers, operators } = parsed
  const productResult = evaluateByPrecedence(numbers, operators, ['*', '/'])
  if (!productResult)
    return null

  const sumResult = evaluateByPrecedence(
    productResult.numbers,
    productResult.operators,
    ['+', '-'],
  )
  if (!sumResult)
    return null

  const result = sumResult.numbers[0]
  if (!Number.isFinite(result))
    return null

  return Number(result.toFixed(10))
}

/**
 * バックスペース操作後の表示文字列を返す
 */
export function backspaceCalculatorExpression(expression: string): string {
  if (!expression || expression === '0')
    return '0'

  const next = expression.slice(0, -1)
  return next || '0'
}

/**
 * 入力式を数値と演算子に分解する
 */
function tokenizeExpression(expression: string): { numbers: number[], operators: string[] } | null {
  const numbers: number[] = []
  const parsedOperators: string[] = []
  let current = ''

  for (let i = 0; i < expression.length; i++) {
    const char = expression[i]
    const isOperator = operatorTokens.includes(char)

    if (!isOperator) {
      if ((char < '0' || char > '9') && char !== '.')
        return null
      current += char
      continue
    }

    // 先頭または演算子の直後の - は符号として扱う
    if (char === '-' && (i === 0 || operatorTokens.includes(expression[i - 1] ?? ''))) {
      current += char
      continue
    }

    if (!current)
      return null

    const parsedNumber = Number(current)
    if (!Number.isFinite(parsedNumber))
      return null

    numbers.push(parsedNumber)
    parsedOperators.push(char)
    current = ''
  }

  if (!current)
    return null

  const lastNumber = Number(current)
  if (!Number.isFinite(lastNumber))
    return null

  numbers.push(lastNumber)
  return { numbers, operators: parsedOperators }
}

/**
 * 優先順位ごとに式を評価する
 */
function evaluateByPrecedence(
  numbers: number[],
  operators: string[],
  targetOperators: string[],
): { numbers: number[], operators: string[] } | null {
  if (numbers.length === 0)
    return null

  const nextNumbers = [numbers[0]]
  const nextOperators: string[] = []

  for (let i = 0; i < operators.length; i++) {
    const operator = operators[i]
    const right = numbers[i + 1]
    const left = nextNumbers.pop()

    if (left === undefined || right === undefined)
      return null

    if (!targetOperators.includes(operator)) {
      nextNumbers.push(left, right)
      nextOperators.push(operator)
      continue
    }

    if (operator === '/' && right === 0)
      return null

    const result = calculate(left, right, operator)
    if (!Number.isFinite(result))
      return null

    nextNumbers.push(result)
  }

  return {
    numbers: nextNumbers,
    operators: nextOperators,
  }
}

/**
 * 2項演算を実行する
 */
function calculate(left: number, right: number, operator: string): number {
  switch (operator) {
    case '+':
      return left + right
    case '-':
      return left - right
    case '*':
      return left * right
    case '/':
      return left / right
    default:
      return Number.NaN
  }
}
