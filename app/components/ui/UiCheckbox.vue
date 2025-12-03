<script setup lang="ts">
/**
 * チェックボックスコンポーネント
 * タスクの完了状態などを表すチェックボックス
 */
defineProps<{
  /** v-modelで使用する値 */
  modelValue: boolean
  /** ラベルテキスト */
  label?: string
  /** 無効状態かどうか */
  disabled?: boolean
  /** id属性 */
  id?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

/**
 * チェック状態の変更を処理
 */
function handleChange(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.checked)
}
</script>

<template>
  <label
    class="ui-checkbox"
    :class="{ 'ui-checkbox--disabled': disabled }"
  >
    <input
      :id="id"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      class="ui-checkbox__input"
      @change="handleChange"
    >
    <span class="ui-checkbox__box">
      <Icon
        v-if="modelValue"
        name="mdi:check"
        class="ui-checkbox__icon"
      />
    </span>
    <span
      v-if="label || $slots.default"
      class="ui-checkbox__label"
    >
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>

<style lang="scss" scoped>
.ui-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;

  &--disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &__input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  &__box {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: 2px solid #e0e0e0;
    border-radius: 4px;
    background-color: white;
    transition: all 0.15s ease;

    .ui-checkbox__input:checked + & {
      background-color: #4a90d9;
      border-color: #4a90d9;
    }

    .ui-checkbox__input:focus + & {
      border-color: #4a90d9;
      box-shadow: 0 0 0 2px rgba(74, 144, 217, 0.2);
    }
  }

  &__icon {
    color: white;
    font-size: 16px;
  }

  &__label {
    font-size: 14px;
    color: #333;
  }

  @media (max-width: 600px) {
    &__box {
      width: 28px;
      height: 28px;
    }

    &__icon {
      font-size: 18px;
    }
  }
}
</style>
