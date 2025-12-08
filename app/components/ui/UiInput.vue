<script setup lang="ts">
/**
 * 汎用テキスト入力コンポーネント
 * 各種テキスト入力フィールドに対応した再利用可能なコンポーネント
 */
const props = defineProps<{
  /** v-modelで使用する値 */
  modelValue: string | number
  /** 入力タイプ */
  type?: 'text' | 'number' | 'time' | 'date' | 'email' | 'password'
  /** プレースホルダー */
  placeholder?: string
  /** 必須かどうか */
  required?: boolean
  /** 無効状態かどうか */
  disabled?: boolean
  /** 最小値（type=numberの場合） */
  min?: number | string
  /** 最大値（type=numberの場合） */
  max?: number | string
  /** id属性 */
  id?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

/**
 * 入力値の変更を処理
 */
function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  if (props.type === 'number') {
    emit('update:modelValue', target.valueAsNumber || 0)
  }
  else {
    emit('update:modelValue', target.value)
  }
}
</script>

<template>
  <input
    :id="id"
    :type="type || 'text'"
    :value="modelValue"
    :placeholder="placeholder"
    :required="required"
    :disabled="disabled"
    :min="min"
    :max="max"
    class="ui-input"
    @input="handleInput"
  >
</template>

<style lang="scss" scoped>
.ui-input {
  width: 100%;
  padding: 8px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 16px;
  transition: border-color 0.15s ease;

  &:focus {
    outline: none;
    border-color: #4a90d9;
  }

  &:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }

  @media (max-width: 600px) {
    min-height: 44px;
    font-size: 16px; // iOSのズーム防止
  }
}
</style>
