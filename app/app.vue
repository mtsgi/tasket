<script setup lang="ts">
/**
 * アプリケーションのルートコンポーネント
 * 設定（ダークモード、背景画像）を全体に適用します
 */
import { useSettingsStore } from '~/stores/settings'

const settingsStore = useSettingsStore()

// 初期化時に設定を読み込む
onMounted(() => {
  settingsStore.loadSettings()
})

// 背景画像のスタイルを算出
const backgroundStyle = computed(() => {
  if (settingsStore.backgroundImage === 'none') {
    return {}
  }
  return {
    backgroundImage: `url(${settingsStore.backgroundImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  }
})
</script>

<template>
  <div
    class="page"
    :class="{ 'dark-mode': settingsStore.darkMode }"
    :style="backgroundStyle"
  >
    <NuxtPage />
  </div>
</template>

<style lang="scss" scoped>
.page {
  transition: background-color 0.3s ease, color 0.3s ease;

  // ダークモードのスタイル
  &.dark-mode {
    background-color: #1a1a1a;
    color: #e0e0e0;

    // グローバルなダークモードスタイルを:deep()で適用
    :deep(.card) {
      background-color: #2a2a2a;
      color: #e0e0e0;
    }

    :deep(.ui-btn--secondary) {
      background-color: #2a2a2a;
      color: #e0e0e0;
      border-color: #444;

      &:hover:not(:disabled) {
        background-color: #333;
      }
    }

    :deep(.form-control),
    :deep(.ui-select) {
      background-color: #2a2a2a;
      color: #e0e0e0;
      border-color: #444;
    }

    :deep(.section-description),
    :deep(.setting-info p),
    :deep(.background-label),
    :deep(h2),
    :deep(h3) {
      color: #b0b0b0 !important;
    }

    :deep(.background-preview) {
      border-color: #444;
      background-color: #333;
    }

    :deep(.notification.success) {
      background-color: rgba(76, 175, 80, 0.2);
      border-color: #4caf50;
    }

    :deep(.notification.error) {
      background-color: rgba(244, 67, 54, 0.2);
      border-color: #f44336;
    }
  }
}
</style>
