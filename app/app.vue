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
}
</style>
