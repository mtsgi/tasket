<script setup lang="ts">
/**
 * アプリケーションのルートコンポーネント
 * 設定（ダークモード、背景画像）を全体に適用します
 * ロック機能を統合し、認証されるまでコンテンツをブロックします
 */
import { useSettingsStore } from '~/stores/settings'
import { useLockStore } from '~/stores/lock'
import { useTutorialStore } from '~/stores/tutorial'
import LockScreen from '~/components/shared/LockScreen.vue'
import TutorialModal from '~/components/shared/TutorialModal.vue'

const settingsStore = useSettingsStore()
const lockStore = useLockStore()
const tutorialStore = useTutorialStore()
const { locale } = useI18n()

// 初期化時に設定を読み込む
onMounted(async () => {
  await settingsStore.loadSettings()
  await lockStore.loadSettings()
  await tutorialStore.loadTutorialState()

  // 言語設定を適用
  if (settingsStore.language) {
    locale.value = settingsStore.language
  }

  // 初回起動チェック（チュートリアル自動表示）
  await tutorialStore.checkFirstLaunch()

  // タイムアウトチェック（バックグラウンドから復帰時など）
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        lockStore.checkTimeout()
      }
    })
  }
})

// クリーンアップ: Object URLを解放
onUnmounted(() => {
  if (settingsStore.backgroundImageUrl && settingsStore.backgroundImage instanceof File) {
    URL.revokeObjectURL(settingsStore.backgroundImageUrl)
  }
})

// 背景画像のスタイルを算出
const backgroundStyle = computed(() => {
  const bgDisplay = settingsStore.backgroundImageDisplay
  if (bgDisplay === 'none') {
    return {}
  }
  return {
    backgroundImage: `url(${bgDisplay})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  }
})

// ロック画面を表示するかどうか
const showLockScreen = computed(() => {
  return lockStore.isLockConfigured && lockStore.isLocked
})
</script>

<template>
  <div
    class="page"
    :class="{ 'dark-mode': settingsStore.darkMode }"
    :style="backgroundStyle"
  >
    <!-- ロック画面 -->
    <LockScreen v-if="showLockScreen" />

    <!-- メインコンテンツ -->
    <NuxtPage v-show="!showLockScreen" />

    <!-- チュートリアルモーダル -->
    <TutorialModal />
  </div>
</template>

<style lang="scss" scoped>
.page {
  transition: background-color 0.3s ease, color 0.3s ease;
}
</style>
