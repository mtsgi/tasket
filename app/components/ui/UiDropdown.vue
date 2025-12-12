<script setup lang="ts">
/**
 * 汎用ドロップダウンコンポーネント
 * カスタムドロップダウンメニューを提供する再利用可能なコンポーネント
 */
defineProps<{
  /** ドロップダウンが表示されているかどうか */
  show: boolean
  /** 空の状態のメッセージ */
  emptyMessage?: string
}>()

const emit = defineEmits<{
  toggle: []
}>()

/**
 * キーボードイベントハンドラー
 * Enterキーとスペースキーでトグル
 */
function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emit('toggle')
  }
}
</script>

<template>
  <div class="ui-dropdown">
    <div
      class="dropdown-trigger"
      role="button"
      tabindex="0"
      :aria-haspopup="true"
      :aria-expanded="show"
      @click="emit('toggle')"
      @keydown="handleKeyDown"
    >
      <slot name="trigger" />
    </div>
    <div
      v-if="show"
      class="dropdown-content"
      role="menu"
      :aria-hidden="!show"
    >
      <slot name="content">
        <div
          v-if="emptyMessage"
          class="dropdown-empty"
          role="menuitem"
        >
          {{ emptyMessage }}
        </div>
      </slot>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ui-dropdown {
  position: relative;

  .dropdown-trigger {
    cursor: pointer;

    &:focus {
      outline: 2px solid #4a90d9;
      outline-offset: 2px;
    }
  }

  .dropdown-content {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    max-height: 200px;
    overflow-y: auto;
    z-index: 10;

    // ダークモード対応
    .dark-mode & {
      background-color: #2a2a2a;
      border-color: #444;
    }
  }

  .dropdown-empty {
    padding: 16px;
    text-align: center;
    color: #999;
    font-size: 14px;

    .dark-mode & {
      color: #888;
    }
  }
}
</style>
