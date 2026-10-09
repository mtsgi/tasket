<script setup lang="ts">
/**
 * アプリケーションのルートコンポーネント
 * 設定（ダークモード、背景画像）を全体に適用します
 * ロック機能を統合し、認証されるまでコンテンツをブロックします
 */
import LockScreen from '~/components/shared/LockScreen.vue'
import TutorialModal from '~/components/shared/TutorialModal.vue'
import PWAInstallBanner from '~/components/shared/PWAInstallBanner.vue'
import DailyStreakModal from '~/components/shared/DailyStreakModal.vue'
import { useStreakStore } from '~/stores/streak'
import { addDays, getEffectiveDateForTime, getStartOfEffectiveDay } from '~/utils/dateHelpers'

const settingsStore = useSettingsStore()
const lockStore = useLockStore()
const tutorialStore = useTutorialStore()
const streakStore = useStreakStore()
const { setLocale } = useI18n()
const initialized = ref(false)
let checkInTimer: ReturnType<typeof setTimeout> | undefined

// 日付境界、復帰時、ロック解除時にも判定。非表示・ロック中の利用は数えない。
async function checkDailyActivity() {
  if (!initialized.value) return
  clearTimeout(checkInTimer)
  if (document.visibilityState !== 'hidden' && !(lockStore.isLockConfigured && lockStore.isLocked)) {
    await streakStore.checkIn()
  }
  if (!initialized.value) return
  clearTimeout(checkInTimer)
  const now = new Date()
  const date = getEffectiveDateForTime(now, settingsStore.dateChangeLine)
  const next = getStartOfEffectiveDay(addDays(date, 1), settingsStore.dateChangeLine)
  checkInTimer = setTimeout(checkDailyActivity, Math.max(100, next.getTime() - now.getTime() + 100))
}

function handleVisibilityChange() {
  if (document.visibilityState !== 'hidden') {
    lockStore.checkTimeout()
    void checkDailyActivity()
  }
}

watch(() => [lockStore.isLocked, lockStore.isLockConfigured, settingsStore.dateChangeLine], () => {
  void checkDailyActivity()
})

// Service Workerの登録（本番環境のみ）
if (import.meta.client && import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .then((registration) => {
      console.log('Service Worker registered:', registration.scope)

      // 更新チェック
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // 新しいService Workerが利用可能
              console.log('New Service Worker available')
            }
          })
        }
      })
    })
    .catch((error) => {
      console.error('Service Worker registration failed:', error)
    })
}

// 初期化時に設定を読み込む
onMounted(async () => {
  await settingsStore.loadSettings()
  await lockStore.loadSettings()
  await tutorialStore.loadTutorialState()

  // 言語設定を適用
  if (settingsStore.language) {
    await setLocale(settingsStore.language)
  }

  // 初回起動チェック（チュートリアル自動表示）
  await tutorialStore.checkFirstLaunch()
  initialized.value = true
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('focus', handleVisibilityChange)
  await checkDailyActivity()
})

// クリーンアップ: Object URLを解放
onUnmounted(() => {
  initialized.value = false
  clearTimeout(checkInTimer)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('focus', handleVisibilityChange)
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
    <!-- PWAインストールバナー -->
    <PWAInstallBanner />

    <!-- ロック画面 -->
    <LockScreen v-if="showLockScreen" />

    <!-- メインコンテンツ -->
    <NuxtPage v-show="!showLockScreen" />

    <!-- チュートリアルモーダル -->
    <TutorialModal v-if="!showLockScreen" />
    <DailyStreakModal
      :show="initialized && !showLockScreen && tutorialStore.hasSeenTutorial && !tutorialStore.isActive && streakStore.showDailyModal"
    />
  </div>
</template>

<style lang="scss" scoped>
.page {
  transition: background-color 0.3s ease, color 0.3s ease;
}
</style>
