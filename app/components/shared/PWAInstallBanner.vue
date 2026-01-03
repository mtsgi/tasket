<script setup lang="ts">
/**
 * PWAインストールバナーコンポーネント
 * アプリをホーム画面に追加するための案内を表示します
 */

const { t } = useI18n()
const { canInstall, isInstalled, isStandalone, promptInstall } = usePWAInstall()

// バナーを閉じたかどうか（セッションストレージで管理）
const dismissed = ref(false)

// インストール中フラグ
const installing = ref(false)

// バナーを表示するかどうか
const shouldShow = computed(() => {
  return canInstall.value && !isInstalled.value && !isStandalone.value && !dismissed.value
})

/**
 * インストールボタンをクリック
 */
async function handleInstall() {
  installing.value = true
  
  try {
    const result = await promptInstall()
    
    if (result === 'accepted') {
      // インストールが受け入れられた
      dismissed.value = true
    }
    else if (result === 'dismissed') {
      // インストールが拒否された
      dismissed.value = true
    }
  }
  finally {
    installing.value = false
  }
}

/**
 * バナーを閉じる
 */
function handleDismiss() {
  dismissed.value = true
  
  // セッションストレージに保存（ページをリロードするまで再表示しない）
  if (import.meta.client) {
    sessionStorage.setItem('pwa-banner-dismissed', 'true')
  }
}

// マウント時にセッションストレージをチェック
onMounted(() => {
  if (import.meta.client) {
    const wasDismissed = sessionStorage.getItem('pwa-banner-dismissed')
    if (wasDismissed === 'true') {
      dismissed.value = true
    }
  }
})
</script>

<template>
  <Transition name="slide-down">
    <div
      v-if="shouldShow"
      class="pwa-install-banner"
    >
      <div class="banner-content">
        <div class="banner-icon">
          <Icon name="mdi:application-import" />
        </div>
        <div class="banner-text">
          <h3 class="banner-title">
            {{ $t('ホーム画面に追加') }}
          </h3>
          <p class="banner-description">
            {{ $t('Tasketをホーム画面に追加して、アプリのように使えます') }}
          </p>
        </div>
        <div class="banner-actions">
          <button
            class="install-button"
            :disabled="installing"
            @click="handleInstall"
          >
            <Icon
              v-if="!installing"
              name="mdi:download"
            />
            <Icon
              v-else
              name="mdi:loading"
              class="spinning"
            />
            {{ installing ? $t('インストール中') + '...' : $t('インストール') }}
          </button>
          <button
            class="dismiss-button"
            :disabled="installing"
            @click="handleDismiss"
          >
            <Icon name="mdi:close" />
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.pwa-install-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: linear-gradient(135deg, #4a90d9 0%, #357abd 100%);
  color: white;
  padding: 12px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  
  .banner-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .banner-icon {
    font-size: 32px;
    flex-shrink: 0;
  }
  
  .banner-text {
    flex: 1;
    min-width: 0;
    
    .banner-title {
      font-size: 14px;
      font-weight: 600;
      margin: 0 0 4px 0;
    }
    
    .banner-description {
      font-size: 12px;
      margin: 0;
      opacity: 0.9;
    }
  }
  
  .banner-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  
  .install-button {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 16px;
    background: white;
    color: #4a90d9;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    
    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.9);
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    &:active:not(:disabled) {
      transform: translateY(0);
    }
    
    &:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
    
    .spinning {
      animation: spin 1s linear infinite;
    }
  }
  
  .dismiss-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    border-radius: 50%;
    color: white;
    font-size: 20px;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.3);
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

// アニメーション
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}

.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

// レスポンシブ対応
@media (max-width: 600px) {
  .pwa-install-banner {
    padding: 10px 12px;
    
    .banner-content {
      gap: 8px;
    }
    
    .banner-icon {
      font-size: 28px;
    }
    
    .banner-text {
      .banner-title {
        font-size: 13px;
      }
      
      .banner-description {
        font-size: 11px;
      }
    }
    
    .install-button {
      padding: 6px 12px;
      font-size: 13px;
    }
    
    .dismiss-button {
      width: 28px;
      height: 28px;
      font-size: 18px;
    }
  }
}
</style>
