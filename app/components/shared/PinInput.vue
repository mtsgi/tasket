<script setup lang="ts">
/**
 * PINコード入力コンポーネント
 * 数字キーパッドでPINコードを入力するUI
 */

const props = defineProps<{
  /** PINコードの桁数 */
  length?: number
  /** エラー状態 */
  error?: boolean
  /** 無効状態 */
  disabled?: boolean
}>()

const emit = defineEmits<{
  /** PINコード入力完了 */
  complete: [pin: string]
  /** PINコード変更 */
  change: [pin: string]
}>()

const pinLength = props.length || 4
const pin = ref<string>('')
const dots = computed(() => Array.from({ length: pinLength }))

/**
 * 数字を追加
 */
function addDigit(digit: number) {
  if (props.disabled || pin.value.length >= pinLength) return

  pin.value += digit.toString()
  emit('change', pin.value)

  if (pin.value.length === pinLength) {
    emit('complete', pin.value)
  }
}

/**
 * 最後の数字を削除
 */
function deleteDigit() {
  if (props.disabled || pin.value.length === 0) return
  pin.value = pin.value.slice(0, -1)
  emit('change', pin.value)
}

/**
 * クリア
 */
function clear() {
  pin.value = ''
  emit('change', pin.value)
}

// エラー状態が変わったらクリア
watch(() => props.error, (newError) => {
  if (newError) {
    // アニメーション後にクリア
    setTimeout(() => {
      clear()
    }, 500)
  }
})

// 外部からクリアできるようにする
defineExpose({
  clear,
})
</script>

<template>
  <div class="pin-input">
    <!-- PIN表示ドット -->
    <div
      class="pin-dots"
      :class="{ error: error }"
    >
      <div
        v-for="(_, index) in dots"
        :key="index"
        class="pin-dot"
        :class="{ filled: index < pin.length }"
      />
    </div>

    <!-- 数字キーパッド -->
    <div class="pin-keypad">
      <button
        v-for="digit in [1, 2, 3, 4, 5, 6, 7, 8, 9]"
        :key="digit"
        type="button"
        class="key-button"
        :disabled="disabled"
        @click="addDigit(digit)"
      >
        {{ digit }}
      </button>

      <!-- 0の左側は空 -->
      <div class="key-button empty" />

      <!-- 0 -->
      <button
        type="button"
        class="key-button"
        :disabled="disabled"
        @click="addDigit(0)"
      >
        0
      </button>

      <!-- 削除ボタン -->
      <button
        type="button"
        class="key-button delete"
        :disabled="disabled || pin.length === 0"
        @click="deleteDigit"
      >
        <Icon name="mdi:backspace-outline" />
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.pin-input {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  padding: 20px;
}

.pin-dots {
  display: flex;
  gap: 16px;
  justify-content: center;

  &.error {
    animation: shake 0.5s;
  }
}

.pin-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid #ccc;
  background-color: transparent;
  transition: all 0.2s ease;

  &.filled {
    background-color: #4a90d9;
    border-color: #4a90d9;
  }

  // ダークモード対応
  .dark-mode & {
    border-color: #666;

    &.filled {
      background-color: #4a90d9;
      border-color: #4a90d9;
    }
  }
}

.pin-keypad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  max-width: 300px;
  width: 100%;
}

.key-button {
  aspect-ratio: 1;
  min-height: 60px;
  border: none;
  border-radius: 50%;
  background-color: #f5f7fa;
  color: #333;
  font-size: 24px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover:not(:disabled) {
    background-color: #e8eaf0;
    transform: scale(1.05);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &.empty {
    background-color: transparent;
    cursor: default;
  }

  &.delete {
    font-size: 28px;
  }

  // ダークモード対応
  .dark-mode & {
    background-color: #2a2a2a;
    color: #e0e0e0;

    &:hover:not(:disabled) {
      background-color: #333;
    }

    &.empty {
      background-color: transparent;
    }
  }
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  10%, 30%, 50%, 70%, 90% {
    transform: translateX(-4px);
  }
  20%, 40%, 60%, 80% {
    transform: translateX(4px);
  }
}

@media (max-width: 600px) {
  .pin-input {
    gap: 24px;
    padding: 16px;
  }

  .pin-dots {
    gap: 12px;
  }

  .pin-dot {
    width: 14px;
    height: 14px;
  }

  .pin-keypad {
    gap: 10px;
  }

  .key-button {
    min-height: 55px;
    font-size: 20px;

    &.delete {
      font-size: 24px;
    }
  }
}
</style>
