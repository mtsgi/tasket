<script setup lang="ts">
/**
 * 設定画面
 * ダークモードの切り替え、背景画像の選択、ロック機能の設定などのアプリ設定を提供します。
 */
import { useSettingsStore } from '~/stores/settings'
import { useLockStore } from '~/stores/lock'
import PinInput from '~/components/shared/PinInput.vue'

const settingsStore = useSettingsStore()
const lockStore = useLockStore()

// ファイル入力用ref
const fileInputRef = ref<HTMLInputElement | null>(null)

// PIN入力コンポーネントのref
const pinInputRef = ref<InstanceType<typeof PinInput> | null>(null)

// ロック設定のモーダル状態
const showPinSetupModal = ref(false)
const pinSetupStep = ref<'initial' | 'confirm'>('initial')
const initialPin = ref('')
const pinError = ref('')
const isSettingPin = ref(false)

// 利用可能な背景画像のリスト
const backgroundImages = [
  { value: 'none', label: 'なし', preview: '' },
  { value: '/backgrounds/gradient-1.svg', label: 'グラデーション 1', preview: '/backgrounds/gradient-1.svg' },
  { value: '/backgrounds/gradient-2.svg', label: 'グラデーション 2', preview: '/backgrounds/gradient-2.svg' },
  { value: '/backgrounds/gradient-3.svg', label: 'グラデーション 3', preview: '/backgrounds/gradient-3.svg' },
  { value: '/backgrounds/nature-1.svg', label: '自然 1', preview: '/backgrounds/nature-1.svg' },
  { value: '/backgrounds/nature-2.svg', label: '自然 2', preview: '/backgrounds/nature-2.svg' },
]

/**
 * 背景画像を選択
 */
function selectBackground(value: string) {
  settingsStore.setBackgroundImage(value)
}

/**
 * カスタム背景画像のアップロードダイアログを開く
 */
function openCustomImageDialog() {
  fileInputRef.value?.click()
}

/**
 * カスタム背景画像をアップロード
 */
function uploadCustomImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  // 画像ファイルかチェック
  if (!file.type.startsWith('image/')) {
    alert('画像ファイルを選択してください')
    return
  }

  // ファイルサイズチェック（5MB以下）
  if (file.size > 5 * 1024 * 1024) {
    alert('ファイルサイズは5MB以下にしてください')
    return
  }

  // FileReaderで画像をBase64に変換
  const reader = new FileReader()

  reader.onload = (e) => {
    const base64 = e.target?.result as string
    if (base64) {
      settingsStore.setBackgroundImage(base64)
    }
  }

  reader.onerror = () => {
    console.error('画像の読み込みに失敗しました')
    alert('画像の読み込みに失敗しました')
  }

  reader.readAsDataURL(file)

  // ファイル入力をリセット
  input.value = ''
}

/**
 * カスタム背景画像かどうかを判定
 */
const isCustomBackground = computed(() => {
  return settingsStore.backgroundImage.startsWith('data:')
})

/**
 * PIN設定モーダルを開く
 */
function openPinSetup() {
  pinSetupStep.value = 'initial'
  initialPin.value = ''
  pinError.value = ''
  showPinSetupModal.value = true
}

/**
 * PIN設定モーダルを閉じる
 */
function closePinSetupModal() {
  showPinSetupModal.value = false
  pinSetupStep.value = 'initial'
  initialPin.value = ''
  pinError.value = ''
  // PIN入力をクリア
  nextTick(() => {
    pinInputRef.value?.clear()
  })
}

/**
 * PIN入力完了（設定時）
 */
async function handlePinSetup(pin: string) {
  if (isSettingPin.value) return

  if (pinSetupStep.value === 'initial') {
    // 初回入力
    if (pin.length < 4) {
      pinError.value = 'PINコードは4桁以上で入力してください'
      return
    }
    initialPin.value = pin
    pinSetupStep.value = 'confirm'
    pinError.value = ''
    // 次のステップのためにPIN入力をクリア
    nextTick(() => {
      pinInputRef.value?.clear()
    })
  }
  else {
    // 確認入力
    if (pin !== initialPin.value) {
      pinError.value = 'PINコードが一致しません'
      pinSetupStep.value = 'initial'
      initialPin.value = ''
      // エラー時はPIN入力を自動的にクリア
      return
    }

    // PIN設定
    isSettingPin.value = true
    try {
      await lockStore.setPin(pin)
      lockStore.enableLock()
      // 成功時にモーダルを閉じてリセット
      showPinSetupModal.value = false
      pinSetupStep.value = 'initial'
      initialPin.value = ''
      pinError.value = ''
      // 成功メッセージを表示
      alert('PINコードを設定しました')
    }
    catch (e) {
      pinError.value = e instanceof Error ? e.message : 'PIN設定に失敗しました'
      pinSetupStep.value = 'initial'
      initialPin.value = ''
    }
    finally {
      isSettingPin.value = false
    }
  }
}

/**
 * ロック機能を無効化
 */
function disableLock() {
  const confirmed = confirm('ロック機能を無効化しますか？\nPINコードもリセットされます。')
  if (confirmed) {
    lockStore.resetPin()
    alert('ロック機能を無効化しました')
  }
}

/**
 * 生体認証の切り替え
 */
async function toggleBiometric() {
  // チェックボックスの値はすでに更新されているので、そのまま保存
  const enabled = lockStore.biometricEnabled

  if (enabled) {
    // 生体認証を有効化する場合はパスキーを登録
    try {
      await registerBiometric()
    }
    catch (error) {
      // 登録に失敗した場合はトグルを戻す
      lockStore.biometricEnabled = false
      console.error('生体認証の登録に失敗しました:', error)
      alert('生体認証の登録に失敗しました。デバイスが生体認証に対応しているか確認してください。')
    }
  }
  else {
    // 無効化する場合はクレデンシャルをクリア
    lockStore.clearBiometricCredential()
  }
}

/**
 * 生体認証（パスキー）を登録
 */
async function registerBiometric() {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    throw new Error('このブラウザは生体認証に対応していません')
  }

  // チャレンジを生成
  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)

  // ユーザーIDを生成（アプリ固有のID）
  const userId = new Uint8Array(16)
  crypto.getRandomValues(userId)

  try {
    // パスキーを作成
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'Tasket',
          id: window.location.hostname,
        },
        user: {
          id: userId,
          name: 'tasket-user',
          displayName: 'Tasket User',
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
      },
    }) as PublicKeyCredential

    if (credential && credential.rawId) {
      // クレデンシャルIDをBase64エンコードして保存
      const credentialIdArray = new Uint8Array(credential.rawId)
      const credentialId = btoa(Array.from(credentialIdArray, byte => String.fromCharCode(byte)).join(''))
      lockStore.setBiometricCredential(credentialId)
      lockStore.toggleBiometric(true)
      alert('生体認証を登録しました')
    }
  }
  catch (error) {
    console.error('パスキーの作成に失敗しました:', error)
    throw error
  }
}

// ステップが変わったときにPIN入力をクリア
watch(pinSetupStep, () => {
  nextTick(() => {
    pinInputRef.value?.clear()
  })
})
</script>

<template>
  <div class="container">
    <!-- ヘッダー -->
    <header class="settings-header">
      <h1>
        <Icon name="mdi:cog" />
        設定
      </h1>
    </header>

    <!-- ダークモード設定 -->
    <section class="settings-section card">
      <h2>
        <Icon name="mdi:theme-light-dark" />
        表示設定
      </h2>
      <div class="setting-item">
        <div class="setting-info">
          <h3>ダークモード</h3>
          <p>画面を暗い色調で表示します</p>
        </div>
        <label class="toggle-switch">
          <input
            v-model="settingsStore.darkMode"
            type="checkbox"
            @change="settingsStore.saveSettings()"
          >
          <span class="slider" />
        </label>
      </div>
    </section>

    <!-- ロック設定 -->
    <section class="settings-section card">
      <h2>
        <Icon name="mdi:lock" />
        セキュリティ
      </h2>
      <p class="section-description">
        PINコードまたは生体認証でアプリをロックできます
      </p>

      <!-- ロック機能が未設定の場合 -->
      <div
        v-if="!lockStore.isLockConfigured"
        class="lock-setup"
      >
        <p class="lock-info">
          ロック機能を有効にすると、アプリ起動時にPINコードの入力が必要になります。
        </p>
        <UiButton
          variant="primary"
          block
          @click="openPinSetup"
        >
          <Icon name="mdi:lock-plus" />
          PINコードを設定
        </UiButton>
      </div>

      <!-- ロック機能が設定済みの場合 -->
      <div
        v-else
        class="lock-settings"
      >
        <div class="setting-item">
          <div class="setting-info">
            <h3>ロック機能</h3>
            <p>有効</p>
          </div>
          <Icon
            name="mdi:check-circle"
            class="status-icon enabled"
          />
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <h3>生体認証</h3>
            <p>
              {{ lockStore.biometricCredentialId ? '登録済み - 指紋認証・顔認証を使用する' : '指紋認証・顔認証を使用する' }}
            </p>
          </div>
          <label class="toggle-switch">
            <input
              v-model="lockStore.biometricEnabled"
              type="checkbox"
              @change="toggleBiometric"
            >
            <span class="slider" />
          </label>
        </div>

        <div class="lock-actions">
          <UiButton
            variant="danger"
            block
            @click="disableLock"
          >
            <Icon name="mdi:lock-off" />
            ロック機能を無効化
          </UiButton>
        </div>
      </div>
    </section>

    <!-- 背景画像設定 -->
    <section class="settings-section card">
      <h2>
        <Icon name="mdi:image" />
        背景画像
      </h2>
      <p class="section-description">
        アプリの背景に表示する画像を選択できます
      </p>
      <div class="background-grid">
        <div
          v-for="bg in backgroundImages"
          :key="bg.value"
          class="background-option"
          :class="{ active: settingsStore.backgroundImage === bg.value }"
          @click="selectBackground(bg.value)"
        >
          <div
            class="background-preview"
            :style="bg.value !== 'none' ? { backgroundImage: `url(${bg.preview})` } : {}"
          >
            <Icon
              v-if="bg.value === 'none'"
              name="mdi:close"
              class="no-background-icon"
            />
            <Icon
              v-if="settingsStore.backgroundImage === bg.value"
              name="mdi:check-circle"
              class="selected-icon"
            />
          </div>
          <span class="background-label">{{ bg.label }}</span>
        </div>

        <!-- カスタム背景画像 -->
        <div
          class="background-option"
          :class="{ active: isCustomBackground }"
          @click="openCustomImageDialog"
        >
          <div
            class="background-preview"
            :style="isCustomBackground ? { backgroundImage: `url(${settingsStore.backgroundImage})` } : {}"
          >
            <Icon
              v-if="!isCustomBackground"
              name="mdi:upload"
              class="no-background-icon"
            />
            <Icon
              v-if="isCustomBackground"
              name="mdi:check-circle"
              class="selected-icon"
            />
          </div>
          <span class="background-label">カスタム画像</span>
        </div>
      </div>

      <!-- ファイル入力（非表示） -->
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        style="display: none"
        @change="uploadCustomImage"
      >
    </section>

    <!-- 戻るボタン -->
    <div class="back-button">
      <UiButton
        variant="secondary"
        block
        @click="$router.back()"
      >
        <Icon name="mdi:arrow-left" />
        戻る
      </UiButton>
    </div>

    <!-- PIN設定モーダル -->
    <UiModal
      :show="showPinSetupModal"
      title="PINコード設定"
      @close="closePinSetupModal"
    >
      <div class="pin-setup-modal">
        <p class="pin-setup-instruction">
          {{ pinSetupStep === 'initial' ? 'PINコードを入力してください（4桁以上）' : 'もう一度PINコードを入力してください' }}
        </p>

        <div
          v-if="pinError"
          class="pin-setup-error"
        >
          <Icon name="mdi:alert-circle" />
          {{ pinError }}
        </div>

        <PinInput
          ref="pinInputRef"
          :disabled="isSettingPin"
          :error="!!pinError"
          @complete="handlePinSetup"
        />
      </div>
    </UiModal>
  </div>
</template>

<style lang="scss" scoped>
.settings-header {
  margin-bottom: 24px;

  h1 {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 24px;
    font-weight: 600;
    text-align: center;

    // ダークモード対応
    .dark-mode & {
      color: #e0e0e0;
    }
  }
}

.settings-section {
  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: #666;
    margin-bottom: 12px;

    // ダークモード対応
    .dark-mode & {
      color: #b0b0b0;
    }
  }
}

.section-description {
  font-size: 14px;
  color: #666;
  margin-bottom: 16px;
  line-height: 1.5;

  // ダークモード対応
  .dark-mode & {
    color: #b0b0b0;
  }
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;

  .setting-info {
    flex: 1;

    h3 {
      font-size: 16px;
      font-weight: 500;
      margin-bottom: 4px;

      // ダークモード対応
      .dark-mode & {
        color: #e0e0e0;
      }
    }

    p {
      font-size: 14px;
      color: #666;

      // ダークモード対応
      .dark-mode & {
        color: #b0b0b0;
      }
    }
  }
}

// トグルスイッチ
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 52px;
  height: 28px;
  cursor: pointer;

  input {
    opacity: 0;
    width: 0;
    height: 0;

    &:checked + .slider {
      background-color: #4a90d9;
    }

    &:checked + .slider:before {
      transform: translateX(24px);
    }
  }

  .slider {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    border-radius: 28px;
    transition: 0.3s;

    &:before {
      content: '';
      position: absolute;
      height: 20px;
      width: 20px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      border-radius: 50%;
      transition: 0.3s;
    }
  }
}

// 背景画像グリッド
.background-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}

.background-option {
  cursor: pointer;
  text-align: center;
  transition: transform 0.15s ease;

  &:hover {
    transform: translateY(-2px);
  }

  &.active .background-preview {
    border-color: #4a90d9;
    box-shadow: 0 0 0 2px rgba(74, 144, 217, 0.2);
  }

  .background-preview {
    width: 100%;
    aspect-ratio: 1;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    background-color: #f5f5f5;
    background-size: cover;
    background-position: center;
    position: relative;
    overflow: hidden;
    transition: all 0.15s ease;

    .no-background-icon {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 32px;
      color: #ccc;
    }

    .selected-icon {
      position: absolute;
      top: 8px;
      right: 8px;
      font-size: 24px;
      color: #4a90d9;
      background-color: white;
      border-radius: 50%;
    }
  }

  .background-label {
    display: block;
    margin-top: 8px;
    font-size: 14px;
    color: #666;

    // ダークモード対応
    .dark-mode & {
      color: #b0b0b0;
    }
  }
}

.back-button {
  margin-top: 24px;
}

// ロック設定
.lock-setup,
.lock-settings {
  .lock-info {
    font-size: 14px;
    color: #666;
    line-height: 1.6;
    margin-bottom: 16px;

    // ダークモード対応
    .dark-mode & {
      color: #b0b0b0;
    }
  }
}

.lock-actions {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;

  // ダークモード対応
  .dark-mode & {
    border-color: #444;
  }
}

.status-icon {
  font-size: 24px;

  &.enabled {
    color: #4caf50;
  }
}

// PIN設定モーダル
.pin-setup-modal {
  .pin-setup-instruction {
    text-align: center;
    font-size: 14px;
    color: #666;
    margin-bottom: 24px;

    // ダークモード対応
    .dark-mode & {
      color: #b0b0b0;
    }
  }

  .pin-setup-error {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background-color: rgba(244, 67, 54, 0.1);
    color: #f44336;
    border-radius: 8px;
    font-size: 14px;
    margin-bottom: 16px;
    border: 1px solid #f44336;
  }
}

@media (max-width: 600px) {
  .settings-header {
    margin-bottom: 16px;

    h1 {
      font-size: 20px;
    }
  }

  .background-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
  }

  .setting-item {
    padding: 8px 0;

    .setting-info {
      h3 {
        font-size: 14px;
      }

      p {
        font-size: 12px;
      }
    }
  }

  .back-button {
    margin-top: 16px;
  }
}
</style>
