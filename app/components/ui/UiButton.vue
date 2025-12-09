<script setup lang="ts">
/**
 * 汎用ボタンコンポーネント
 * プライマリ、セカンダリ、危険などの種別に対応した再利用可能なボタン
 */
defineProps<{
  /** ボタンの種別 */
  variant?: 'primary' | 'secondary' | 'danger'
  /** アイコンのみのボタンかどうか */
  icon?: boolean
  /** ブロック表示（幅100%）かどうか */
  block?: boolean
  /** 無効状態かどうか */
  disabled?: boolean
  /** ボタンのtype属性 */
  type?: 'button' | 'submit' | 'reset'
  /** aria-label属性 */
  ariaLabel?: string
}>()

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<template>
  <button
    :type="type || 'button'"
    class="ui-btn"
    :class="{
      'ui-btn--primary': variant === 'primary',
      'ui-btn--secondary': variant === 'secondary' || !variant,
      'ui-btn--danger': variant === 'danger',
      'ui-btn--icon': icon,
      'ui-btn--block': block,
    }"
    :disabled="disabled"
    :aria-label="ariaLabel"
    @click="emit('click', $event)"
  >
    <slot />
  </button>
</template>

<style lang="scss" scoped>
.ui-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &--primary {
    background-color: #4a90d9;
    color: white;

    &:hover:not(:disabled) {
      background-color: #3a7bc8;
    }
  }

  &--secondary {
    background-color: transparent;
    color: #333;
    border: 1px solid #e0e0e0;

    &:hover:not(:disabled) {
      background-color: #f5f7fa;
    }

    // ダークモード対応
    .dark-mode & {
      background-color: #2a2a2a;
      color: #e0e0e0;
      border-color: #444;

      &:hover:not(:disabled) {
        background-color: #333;
      }
    }
  }

  &--danger {
    background-color: #f44336;
    color: white;

    &:hover:not(:disabled) {
      background-color: #d32f2f;
    }
  }

  &--icon {
    padding: 8px;
    min-width: 36px;
    height: 36px;
  }

  &--block {
    width: 100%;
  }

  @media (max-width: 600px) {
    padding: 8px 16px;
    min-height: 44px;

    &--icon {
      min-width: 44px;
      height: 44px;
    }
  }
}
</style>
