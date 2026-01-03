<script setup lang="ts">
/**
 * PWAインストールセクションコンポーネント
 * メニュー画面でPWAのインストール状態を表示し、インストールを促します
 */

const { canInstall, isStandalone, promptInstall } = usePWAInstall()

// インストール中フラグ
const installing = ref(false)

// 表示状態
const showInstallSection = computed(() => {
  // インストール可能、またはすでにインストール済み（スタンドアロンモード）の場合に表示
  return canInstall.value || isStandalone.value
})

/**
 * インストールボタンをクリック
 */
async function handleInstall() {
  installing.value = true

  try {
    await promptInstall()
  }
  finally {
    installing.value = false
  }
}

// iOS判定
const isIOS = computed(() => {
  if (!import.meta.client) return false

  const userAgent = window.navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(userAgent)
})

// iOS Safari判定（スタンドアロンモードでない場合）
const isIOSSafari = computed(() => {
  if (!import.meta.client || isStandalone.value) return false

  return isIOS.value && !window.navigator.userAgent.includes('CriOS') && !window.navigator.userAgent.includes('FxiOS')
})
</script>

<template>
  <div
    v-if="showInstallSection"
    class="pwa-install-section"
  >
    <!-- インストール済みの場合 -->
    <div
      v-if="isStandalone"
      class="install-status installed"
    >
      <div class="status-icon">
        <Icon name="mdi:check-circle" />
      </div>
      <div class="status-text">
        <h3>{{ $t('アプリとしてインストール済み') }}</h3>
        <p>{{ $t('Tasketをアプリとして使用しています') }}</p>
      </div>
    </div>

    <!-- インストール可能な場合（iOS Safari） -->
    <div
      v-else-if="isIOSSafari"
      class="install-guide ios"
    >
      <div class="guide-icon">
        <Icon name="mdi:apple" />
      </div>
      <div class="guide-text">
        <h3>{{ $t('ホーム画面に追加') }}</h3>
        <p>{{ $t('iOS/iPadOSでホーム画面に追加するには:') }}</p>
        <ol class="install-steps">
          <li>
            <Icon name="mdi:export-variant" />
            {{ $t('画面下部の共有ボタンをタップ') }}
          </li>
          <li>
            <Icon name="mdi:plus-box" />
            {{ $t('「ホーム画面に追加」を選択') }}
          </li>
          <li>
            <Icon name="mdi:check" />
            {{ $t('「追加」をタップして完了') }}
          </li>
        </ol>
      </div>
    </div>

    <!-- インストール可能な場合（その他のブラウザ） -->
    <div
      v-else-if="canInstall"
      class="install-available"
    >
      <div class="available-icon">
        <Icon name="mdi:application-import" />
      </div>
      <div class="available-text">
        <h3>{{ $t('アプリとしてインストール') }}</h3>
        <p>{{ $t('Tasketをホーム画面に追加して、アプリのように使えます。オフラインでも動作し、起動が高速になります。') }}</p>
        <div class="install-features">
          <div class="feature-item">
            <Icon name="mdi:wifi-off" />
            <span>{{ $t('オフライン対応') }}</span>
          </div>
          <div class="feature-item">
            <Icon name="mdi:rocket-launch" />
            <span>{{ $t('高速起動') }}</span>
          </div>
          <div class="feature-item">
            <Icon name="mdi:fullscreen" />
            <span>{{ $t('フルスクリーン') }}</span>
          </div>
        </div>
      </div>
      <UiButton
        variant="primary"
        block
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
        {{ installing ? $t('インストール中') + '...' : $t('今すぐインストール') }}
      </UiButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.pwa-install-section {
  // 共通スタイルは親の.menu-sectionから継承
}

.install-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;

  &.installed {
    background-color: rgba(76, 175, 80, 0.1);
    border: 1px solid #4caf50;

    .status-icon {
      font-size: 32px;
      color: #4caf50;
    }
  }

  .status-text {
    flex: 1;

    h3 {
      font-size: 16px;
      font-weight: 600;
      margin: 0 0 4px 0;
      color: #4caf50;
    }

    p {
      font-size: 14px;
      margin: 0;
      color: #666;

      // ダークモード対応
      .dark-mode & {
        color: #b0b0b0;
      }
    }
  }
}

.install-guide {
  &.ios {
    .guide-icon {
      text-align: center;
      font-size: 48px;
      color: #4a90d9;
      margin-bottom: 16px;
    }

    .guide-text {
      h3 {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 12px 0;
        text-align: center;
        color: #333;

        // ダークモード対応
        .dark-mode & {
          color: #e0e0e0;
        }
      }

      p {
        font-size: 14px;
        color: #666;
        margin: 0 0 16px 0;
        text-align: center;

        // ダークモード対応
        .dark-mode & {
          color: #b0b0b0;
        }
      }
    }

    .install-steps {
      list-style: none;
      padding: 0;
      margin: 0;

      li {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        margin-bottom: 8px;
        background-color: #f5f7fa;
        border-radius: 8px;
        font-size: 14px;
        color: #333;

        // ダークモード対応
        .dark-mode & {
          background-color: #333;
          color: #e0e0e0;
        }

        &:last-child {
          margin-bottom: 0;
        }

        svg {
          font-size: 20px;
          color: #4a90d9;
          flex-shrink: 0;
        }
      }
    }
  }
}

.install-available {
  .available-icon {
    text-align: center;
    font-size: 48px;
    color: #4a90d9;
    margin-bottom: 16px;
  }

  .available-text {
    h3 {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 12px 0;
      text-align: center;
      color: #333;

      // ダークモード対応
      .dark-mode & {
        color: #e0e0e0;
      }
    }

    p {
      font-size: 14px;
      color: #666;
      margin: 0 0 16px 0;
      line-height: 1.6;

      // ダークモード対応
      .dark-mode & {
        color: #b0b0b0;
      }
    }
  }

  .install-features {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-bottom: 20px;
    flex-wrap: wrap;

    .feature-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;

      svg {
        font-size: 28px;
        color: #4a90d9;
      }

      span {
        font-size: 12px;
        color: #666;

        // ダークモード対応
        .dark-mode & {
          color: #b0b0b0;
        }
      }
    }
  }
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 600px) {
  .install-guide.ios {
    .guide-icon {
      font-size: 40px;
      margin-bottom: 12px;
    }

    .guide-text {
      h3 {
        font-size: 16px;
      }

      p {
        font-size: 13px;
      }
    }

    .install-steps li {
      font-size: 13px;
      padding: 10px;

      svg {
        font-size: 18px;
      }
    }
  }

  .install-available {
    .available-icon {
      font-size: 40px;
      margin-bottom: 12px;
    }

    .available-text {
      h3 {
        font-size: 16px;
      }

      p {
        font-size: 13px;
      }
    }

    .install-features {
      gap: 12px;

      .feature-item {
        svg {
          font-size: 24px;
        }

        span {
          font-size: 11px;
        }
      }
    }
  }
}
</style>
