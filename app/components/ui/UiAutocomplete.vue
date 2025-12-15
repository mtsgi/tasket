<script setup lang="ts">
/**
 * オートコンプリート機能付き入力コンポーネント
 * 候補リストから選択可能なテキスト入力フィールド
 */
const props = defineProps<{
  /** v-modelで使用する値 */
  modelValue: string
  /** オートコンプリート候補のリスト */
  suggestions: string[]
  /** プレースホルダー */
  placeholder?: string
  /** 必須かどうか */
  required?: boolean
  /** 無効状態かどうか */
  disabled?: boolean
  /** id属性 */
  id?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// 候補リストの表示状態
const showSuggestions = ref(false)
// フォーカス状態
const isFocused = ref(false)
// 選択中の候補のインデックス（キーボード操作用）
const selectedIndex = ref(-1)

/**
 * 入力値でフィルタリングされた候補リスト
 * パフォーマンス最適化のため、入力値がある場合のみフィルタリング
 */
const filteredSuggestions = computed(() => {
  if (!props.modelValue || typeof props.modelValue !== 'string' || props.modelValue.length === 0) {
    return []
  }

  const searchTerm = props.modelValue.toLowerCase()
  return props.suggestions
    .filter(suggestion => suggestion.toLowerCase().includes(searchTerm))
    .slice(0, 10) // 最大10件に制限してパフォーマンスを向上
})

/**
 * 入力値の変更を処理
 */
function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
  showSuggestions.value = true
  selectedIndex.value = -1
}

/**
 * フォーカス時の処理
 */
function handleFocus() {
  isFocused.value = true
  showSuggestions.value = !!(props.modelValue && props.modelValue.length > 0)
}

/**
 * ブラー時の処理
 * 候補選択のクリックイベントを処理するため、少し遅延させる
 */
function handleBlur() {
  setTimeout(() => {
    isFocused.value = false
    showSuggestions.value = false
    selectedIndex.value = -1
  }, 200)
}

/**
 * 候補を選択
 */
function selectSuggestion(suggestion: string) {
  emit('update:modelValue', suggestion)
  showSuggestions.value = false
  selectedIndex.value = -1
}

/**
 * キーボード操作の処理
 */
function handleKeydown(event: KeyboardEvent) {
  if (!showSuggestions.value || filteredSuggestions.value.length === 0) {
    return
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      selectedIndex.value = Math.min(
        selectedIndex.value + 1,
        filteredSuggestions.value.length - 1,
      )
      break
    case 'ArrowUp':
      event.preventDefault()
      selectedIndex.value = Math.max(selectedIndex.value - 1, -1)
      break
    case 'Enter':
      if (selectedIndex.value >= 0) {
        event.preventDefault()
        selectSuggestion(filteredSuggestions.value[selectedIndex.value])
      }
      break
    case 'Escape':
      showSuggestions.value = false
      selectedIndex.value = -1
      break
  }
}
</script>

<template>
  <div class="ui-autocomplete">
    <input
      :id="id"
      :value="modelValue"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      type="text"
      class="ui-autocomplete-input"
      autocomplete="off"
      @input="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
      @keydown="handleKeydown"
    >
    <div
      v-if="showSuggestions && filteredSuggestions.length > 0"
      class="suggestions-list"
    >
      <button
        v-for="(suggestion, index) in filteredSuggestions"
        :key="suggestion"
        type="button"
        class="suggestion-item"
        :class="{ selected: index === selectedIndex }"
        @click="selectSuggestion(suggestion)"
      >
        {{ suggestion }}
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ui-autocomplete {
  position: relative;
  width: 100%;
}

.ui-autocomplete-input {
  width: 100%;
  padding: 8px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 16px;
  background-color: white;
  color: #333;
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

    &::placeholder {
      color: #888;
    }
  }

  @media (max-width: 600px) {
    min-height: 44px;
    font-size: 16px; // iOSのズーム防止
  }
}

.suggestions-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background-color: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;

  // ダークモード対応
  .dark-mode & {
    background-color: #2a2a2a;
    border-color: #444;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  // スクロールバーのスタイリング
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;

    .dark-mode & {
      background: #1a1a1a;
    }
  }

  &::-webkit-scrollbar-thumb {
    background: #ccc;
    border-radius: 4px;

    .dark-mode & {
      background: #555;
    }

    &:hover {
      background: #aaa;

      .dark-mode & {
        background: #666;
      }
    }
  }
}

.suggestion-item {
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  font-size: 14px;
  color: #333;
  transition: background-color 0.15s ease;

  // ダークモード対応
  .dark-mode & {
    color: #e0e0e0;
  }

  &:hover,
  &.selected {
    background-color: #f5f7fa;

    .dark-mode & {
      background-color: #333;
    }
  }

  &:not(:last-child) {
    border-bottom: 1px solid #f0f0f0;

    .dark-mode & {
      border-color: #333;
    }
  }

  @media (max-width: 600px) {
    padding: 12px 16px;
    min-height: 44px; // タッチターゲット確保
  }
}
</style>
