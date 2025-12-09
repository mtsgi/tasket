<script setup lang="ts">
/**
 * ロック画面コンポーネント
 * PINコード入力と生体認証によるアプリのロック解除UI
 */
import { useLockStore } from '~/stores/lock'
import PinInput from '~/components/shared/PinInput.vue'

const lockStore = useLockStore()
const pinInputRef = ref<InstanceType<typeof PinInput> | null>(null)

// UI状態
const errorMessage = ref<string>('')
const isVerifying = ref(false)
const showError = ref(false)
const isBiometricAvailable = ref(false)

/**
 * PINコード入力完了時の処理
 */
async function handlePinComplete(pin: string) {
  if (isVerifying.value) return

  isVerifying.value = true
  errorMessage.value = ''
  showError.value = false

  try {
    const isValid = await lockStore.verifyPin(pin)

    if (!isValid) {
      showError.value = true
      const remainingAttempts = lockStore.maxAttempts - lockStore.failedAttempts

      if (remainingAttempts > 0) {
        errorMessage.value = `PINコードが正しくありません（残り${remainingAttempts}回）`
      }
      else {
        errorMessage.value = '試行回数が上限に達しました'
      }
    }
  }
  catch {
    showError.value = true
    errorMessage.value = '認証エラーが発生しました'
  }
  finally {
    isVerifying.value = false
  }
}

/**
 * 生体認証を試行
 */
async function tryBiometric() {
  if (!isBiometricAvailable.value) return

  try {
    // Web Authentication APIを使用
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: new Uint8Array(32), // ダミーのチャレンジ
        timeout: 60000,
        userVerification: 'required',
      },
    })

    if (credential) {
      lockStore.unlock()
    }
  }
  catch {
    // ユーザーがキャンセルした場合やエラー時
    errorMessage.value = '生体認証に失敗しました'
    showError.value = true
    setTimeout(() => {
      showError.value = false
      errorMessage.value = ''
    }, 3000)
  }
}

/**
 * 生体認証が利用可能かチェック
 */
async function checkBiometricAvailability() {
  if (typeof window === 'undefined') return

  // PublicKeyCredentialがサポートされているか確認
  if (window.PublicKeyCredential) {
    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      isBiometricAvailable.value = available && lockStore.biometricEnabled
    }
    catch {
      isBiometricAvailable.value = false
    }
  }
}

onMounted(() => {
  checkBiometricAvailability()
})
</script>

<template>
  <div class="lock-screen">
    <div class="lock-screen__content">
      <!-- アプリアイコン -->
      <div class="lock-screen__logo">
        <Icon
          name="mdi:lock"
          class="logo-icon"
        />
      </div>

      <!-- タイトル -->
      <h1 class="lock-screen__title">
        Tasket
      </h1>

      <p class="lock-screen__subtitle">
        PINコードを入力してください
      </p>

      <!-- エラーメッセージ -->
      <Transition name="error">
        <div
          v-if="errorMessage"
          class="lock-screen__error"
        >
          <Icon name="mdi:alert-circle" />
          {{ errorMessage }}
        </div>
      </Transition>

      <!-- PIN入力 -->
      <PinInput
        ref="pinInputRef"
        :disabled="isVerifying || !lockStore.canAttempt"
        :error="showError"
        @complete="handlePinComplete"
      />

      <!-- 生体認証ボタン -->
      <div
        v-if="isBiometricAvailable"
        class="lock-screen__biometric"
      >
        <UiButton
          variant="secondary"
          :disabled="isVerifying"
          @click="tryBiometric"
        >
          <Icon name="mdi:fingerprint" />
          生体認証で解除
        </UiButton>
      </div>

      <!-- 試行回数制限に達した場合 -->
      <div
        v-if="!lockStore.canAttempt"
        class="lock-screen__blocked"
      >
        <Icon name="mdi:lock-alert" />
        <p>試行回数が上限に達しました</p>
        <p class="blocked-hint">
          アプリを再起動してください
        </p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.lock-screen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;

  // ダークモード対応
  .dark-mode & {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  }

  &__content {
    width: 100%;
    max-width: 400px;
    padding: 32px;
    text-align: center;
  }

  &__logo {
    margin-bottom: 24px;

    .logo-icon {
      font-size: 80px;
      color: white;
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
    }
  }

  &__title {
    font-size: 32px;
    font-weight: 700;
    color: white;
    margin-bottom: 8px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  &__subtitle {
    font-size: 16px;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 32px;
  }

  &__error {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    background-color: rgba(244, 67, 54, 0.9);
    color: white;
    border-radius: 8px;
    font-size: 14px;
    margin-bottom: 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  &__biometric {
    margin-top: 24px;
  }

  &__blocked {
    margin-top: 24px;
    padding: 20px;
    background-color: rgba(244, 67, 54, 0.9);
    border-radius: 12px;
    color: white;

    > :first-child {
      font-size: 48px;
      margin-bottom: 12px;
    }

    p {
      margin: 8px 0;
      font-size: 16px;
      font-weight: 500;
    }

    .blocked-hint {
      font-size: 14px;
      opacity: 0.9;
      font-weight: normal;
    }
  }
}

// エラーアニメーション
.error-enter-active,
.error-leave-active {
  transition: all 0.3s ease;
}

.error-enter-from,
.error-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@media (max-width: 600px) {
  .lock-screen {
    &__content {
      padding: 24px 16px;
    }

    &__logo {
      .logo-icon {
        font-size: 64px;
      }
    }

    &__title {
      font-size: 28px;
    }

    &__subtitle {
      font-size: 14px;
      margin-bottom: 24px;
    }

    &__blocked {
      padding: 16px;

      > :first-child {
        font-size: 40px;
      }

      p {
        font-size: 14px;
      }

      .blocked-hint {
        font-size: 12px;
      }
    }
  }
}
</style>
