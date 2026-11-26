<script setup lang="ts">
/**
 * DBアップグレード／削除ブロック警告バナー
 * 他のタブが古いIndexedDB接続を保持して処理が待機中のとき、ユーザーへ案内を表示します。
 */
import { isDBUpgradeBlocked, subscribeDBBlocked } from '~/utils/db'

const isBlocked = ref(isDBUpgradeBlocked())
let unsubscribe: (() => void) | null = null

onMounted(() => {
  isBlocked.value = isDBUpgradeBlocked()
  unsubscribe = subscribeDBBlocked((blocked) => {
    isBlocked.value = blocked
  })
})

onUnmounted(() => {
  unsubscribe?.()
  unsubscribe = null
})

function reloadPage() {
  if (import.meta.client) {
    window.location.reload()
  }
}
</script>

<template>
  <Transition name="slide-down">
    <div
      v-if="isBlocked"
      class="db-blocked-banner"
      role="alert"
    >
      <div class="banner-content">
        <div class="banner-icon">
          <Icon name="mdi:alert-circle-outline" />
        </div>
        <div class="banner-text">
          <h3 class="banner-title">
            {{ $t('データベースの更新が待機中です') }}
          </h3>
          <p class="banner-description">
            {{ $t('他のタブで開いているTasketを閉じてください。閉じると自動的に再開します。') }}
          </p>
        </div>
        <div class="banner-actions">
          <button
            class="reload-button"
            type="button"
            @click="reloadPage"
          >
            <Icon name="mdi:refresh" />
            {{ $t('再読み込み') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.db-blocked-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1001;
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  padding: 12px 16px;
}

.banner-content {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.banner-icon {
  font-size: 28px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.banner-text {
  flex: 1;
  min-width: 0;
}

.banner-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 2px;
}

.banner-description {
  font-size: 13px;
  margin: 0;
  opacity: 0.95;
  line-height: 1.4;
}

.banner-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.reload-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background-color: #ffffff;
  color: #92400e;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s ease, transform 0.1s ease;

  &:hover {
    opacity: 0.92;
  }

  &:active {
    transform: scale(0.98);
  }
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

@media (max-width: 600px) {
  .banner-content {
    flex-wrap: wrap;
  }

  .banner-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
