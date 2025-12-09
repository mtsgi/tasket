<script setup lang="ts">
/**
 * 汎用セレクトコンポーネント
 * ドロップダウン選択に対応した再利用可能なコンポーネント
 */
defineProps<{
  /** v-modelで使用する値 */
  modelValue: string | number
  /** 無効状態かどうか */
  disabled?: boolean
  /** id属性 */
  id?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

/**
 * 選択値の変更を処理
 */
function handleChange(event: Event) {
  const target = event.target as HTMLSelectElement
  emit('update:modelValue', target.value)
}
</script>

<template>
  <select
    :id="id"
    :value="modelValue"
    :disabled="disabled"
    class="ui-select"
    @change="handleChange"
  >
    <slot />
  </select>
</template>

<style lang="scss" scoped>
.ui-select {
  width: 100%;
  padding: 8px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 16px;
  background-color: white;
  color: #333;
  cursor: pointer;
  transition: border-color 0.15s ease;

  &:focus {
    outline: none;
    border-color: #4a90d9;
  }

  &:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }

  // ダークモード対応
  .dark-mode & {
    background-color: #2a2a2a;
    color: #e0e0e0;
    border-color: #444;
  }

  @media (max-width: 600px) {
    min-height: 44px;
    font-size: 16px;
  }
}
</style>
