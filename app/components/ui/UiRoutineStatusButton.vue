<script setup lang="ts">
/**
 * 日課ステータスボタンコンポーネント
 * 日課のステータス（未確認・達成・未達成）を表示し、クリックで循環的に変更するボタン
 */
import type { RoutineStatus } from '~/types/item'

const props = defineProps<{
  /** 現在のステータス */
  status: RoutineStatus
  /** ラベルテキスト */
  label?: string
  /** 無効状態かどうか */
  disabled?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

/**
 * ステータスに応じたアイコン名を取得
 */
const iconName = computed(() => {
  switch (props.status) {
    case 'achieved':
      return 'mdi:check-circle'
    case 'not_achieved':
      return 'mdi:close-circle'
    case 'unconfirmed':
    default:
      return 'mdi:checkbox-blank-circle-outline'
  }
})

/**
 * ステータスに応じたラベルを取得
 */
const statusLabel = computed(() => {
  switch (props.status) {
    case 'achieved':
      return '達成'
    case 'not_achieved':
      return '未達成'
    case 'unconfirmed':
    default:
      return '未確認'
  }
})

/**
 * クリックイベントを処理
 */
function handleClick() {
  if (!props.disabled) {
    emit('click')
  }
}
</script>

<template>
  <button
    type="button"
    class="ui-routine-status-button"
    :class="[
      `ui-routine-status-button--${status}`,
      { 'ui-routine-status-button--disabled': disabled },
    ]"
    :disabled="disabled"
    :aria-label="`${label || '日課'}: ${statusLabel}`"
    @click="handleClick"
  >
    <Icon
      :name="iconName"
      class="ui-routine-status-button__icon"
    />
    <span
      v-if="label || $slots.default"
      class="ui-routine-status-button__label"
    >
      <slot>{{ label }}</slot>
    </span>
  </button>
</template>

<style lang="scss" scoped>
.ui-routine-status-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  background-color: transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 14px;
  width: 100%;
  text-align: left;

  &:hover:not(&--disabled) {
    background-color: #f5f7fa;
  }

  &--disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  // 未確認状態のスタイル
  &--unconfirmed {
    .ui-routine-status-button__icon {
      color: #999;
    }

    .ui-routine-status-button__label {
      color: #666;
    }
  }

  // 達成状態のスタイル
  &--achieved {
    .ui-routine-status-button__icon {
      color: #4caf50;
    }

    .ui-routine-status-button__label {
      color: #333;
      text-decoration: line-through;
      opacity: 0.7;
    }
  }

  // 未達成状態のスタイル
  &--not_achieved {
    .ui-routine-status-button__icon {
      color: #f44336;
    }

    .ui-routine-status-button__label {
      color: #666;
    }
  }

  &__icon {
    font-size: 24px;
    flex-shrink: 0;
  }

  &__label {
    flex: 1;
    font-size: 14px;
    font-weight: 400;
    transition: all 0.15s ease;
  }

  // ダークモード対応
  .dark-mode & {
    &:hover:not(&--disabled) {
      background-color: #2a2a2a;
    }

    &--unconfirmed {
      .ui-routine-status-button__label {
        color: #999;
      }
    }

    &--achieved {
      .ui-routine-status-button__label {
        color: #e0e0e0;
      }
    }

    &--not_achieved {
      .ui-routine-status-button__label {
        color: #999;
      }
    }
  }

  // モバイル対応
  @media (max-width: 600px) {
    padding: 4px;

    &__icon {
      font-size: 28px;
    }

    &__label {
      font-size: 14px;
    }
  }
}
</style>
