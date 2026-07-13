<script setup lang="ts">
/**
 * 金額入力向けの簡易電卓モーダル
 */
import { backspaceCalculatorExpression, evaluateCalculatorExpression } from '~/utils/calculator'

const props = defineProps<{
  show: boolean
  initialValue?: number
}>()

const emit = defineEmits<{
  close: []
  apply: [value: number]
}>()

const display = ref('0')
const hasError = ref(false)
const operators = ['+', '-', '×', '÷']
const operandSplitter = /[+\-×÷]/

const keypadRows = [
  ['C', '⌫', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['0', '.', '='],
]

// 計算済みの数値のみ反映可能にする（式の入力中は無効）
const canApply = computed(() => !hasError.value && Number.isFinite(Number(display.value)))

watch(
  () => props.show,
  (show) => {
    if (!import.meta.client)
      return

    if (show) {
      display.value = String(props.initialValue ?? 0)
      hasError.value = false
      window.addEventListener('keydown', handleKeydown)
      return
    }

    window.removeEventListener('keydown', handleKeydown)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (!import.meta.client)
    return
  window.removeEventListener('keydown', handleKeydown)
})

/**
 * クリック入力を処理
 */
function handleButtonClick(token: string) {
  switch (token) {
    case 'C':
      clearAll()
      return
    case '⌫':
      backspace()
      return
    case '=':
      calculate()
      return
    default:
      appendToken(token)
  }
}

/**
 * キーボード入力を処理
 */
function handleKeydown(event: KeyboardEvent) {
  if (!props.show)
    return

  const key = event.key

  if (key === 'Escape') {
    emit('close')
    return
  }

  if (key === 'Enter') {
    event.preventDefault()
    calculate()
    return
  }

  if (key === 'Backspace') {
    event.preventDefault()
    backspace()
    return
  }

  if (key.toLowerCase() === 'c') {
    event.preventDefault()
    clearAll()
    return
  }

  if (/^[0-9.]$/.test(key)) {
    event.preventDefault()
    appendToken(key)
    return
  }

  if (['+', '-', '*', '/'].includes(key)) {
    event.preventDefault()
    appendToken(normalizeOperatorToken(key))
  }
}

/**
 * 計算結果を金額欄へ反映する
 */
function applyResult() {
  const value = Number(display.value)
  if (!Number.isFinite(value) || hasError.value)
    return
  emit('apply', value)
}

/**
 * 式全体をクリア
 */
function clearAll() {
  display.value = '0'
  hasError.value = false
}

/**
 * 1文字削除
 */
function backspace() {
  hasError.value = false
  display.value = backspaceCalculatorExpression(display.value)
}

/**
 * 入力トークンを追加
 */
function appendToken(token: string) {
  if (hasError.value) {
    display.value = '0'
    hasError.value = false
  }

  const normalizedToken = normalizeOperatorToken(token)
  const isOperator = operators.includes(normalizedToken)

  if (isOperator) {
    const last = display.value.slice(-1)
    if (operators.includes(last)) {
      display.value = `${display.value.slice(0, -1)}${normalizedToken}`
      return
    }

    if (display.value === '0' && normalizedToken !== '-')
      return

    display.value += normalizedToken
    return
  }

  if (normalizedToken === '.') {
    const lastOperand = display.value.split(operandSplitter).at(-1) ?? ''
    if (lastOperand.includes('.'))
      return

    if (display.value === '0' || operators.includes(display.value.slice(-1))) {
      if (display.value === '0')
        display.value = '0.'
      else
        display.value = `${display.value}0.`
      return
    }
  }

  if (display.value === '0') {
    display.value = normalizedToken
    return
  }

  display.value += normalizedToken
}

/**
 * 演算子トークンを表示用の記号へ正規化
 */
function normalizeOperatorToken(token: string): string {
  return token === '*' ? '×' : token === '/' ? '÷' : token
}

/**
 * 式を評価して表示へ反映
 */
function calculate() {
  const result = evaluateCalculatorExpression(display.value)
  if (result === null) {
    hasError.value = true
    display.value = '0'
    return
  }

  hasError.value = false
  display.value = String(result)
}
</script>

<template>
  <UiModal
    :show="show"
    :title="$t('電卓')"
    @close="emit('close')"
  >
    <div class="calculator">
      <label class="display-label">{{ $t('計算式') }}</label>
      <div
        class="display"
        role="status"
        aria-live="polite"
      >
        {{ display }}
      </div>

      <div class="keypad">
        <div
          v-for="(row, rowIndex) in keypadRows"
          :key="`row-${rowIndex}`"
          class="keypad-row"
        >
          <UiButton
            v-for="key in row"
            :key="key"
            variant="secondary"
            class="keypad-button"
            @click="handleButtonClick(key)"
          >
            {{ key }}
          </UiButton>
        </div>
      </div>
    </div>

    <template #footer>
      <UiButton
        variant="secondary"
        @click="emit('close')"
      >
        {{ $t('閉じる') }}
      </UiButton>
      <UiButton
        variant="primary"
        :disabled="!canApply"
        @click="applyResult"
      >
        {{ $t('計算結果を反映') }}
      </UiButton>
    </template>
  </UiModal>
</template>

<style lang="scss" scoped>
.calculator {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.display-label {
  font-size: 12px;
  color: #666;

  .dark-mode & {
    color: #b0b0b0;
  }
}

.display {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  min-height: 48px;
  padding: 8px 12px;
  font-size: 24px;
  text-align: right;
  word-break: break-all;
  background: #fff;

  .dark-mode & {
    background: #333;
    border-color: #444;
  }
}

.keypad {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.keypad-row {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(4, minmax(0, 1fr));

  &:last-child {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.keypad-button {
  min-height: 44px;
}

@media (max-width: 600px) {
  .display {
    font-size: 20px;
  }
}
</style>
