<script setup lang="ts">
/**
 * 設定画面
 * ダークモードの切り替え、背景画像の選択、ロック機能の設定などのアプリ設定を提供します。
 */
import { useSettingsStore } from '~/stores/settings'
import { useLockStore } from '~/stores/lock'
import PinInput from '~/components/shared/PinInput.vue'
import PresetManager from '~/components/settings/PresetManager.vue'

const settingsStore = useSettingsStore()
const lockStore = useLockStore()
const { locale, t, setLocale } = useI18n()

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
const backgroundImages = computed(() => [
  { value: 'none', label: t('なし'), preview: '' },
  { value: '/backgrounds/gradient-1.svg', label: t('グラデーション 1'), preview: '/backgrounds/gradient-1.svg' },
  { value: '/backgrounds/gradient-2.svg', label: t('グラデーション 2'), preview: '/backgrounds/gradient-2.svg' },
  { value: '/backgrounds/gradient-3.svg', label: t('グラデーション 3'), preview: '/backgrounds/gradient-3.svg' },
  { value: '/backgrounds/nature-1.svg', label: t('自然 1'), preview: '/backgrounds/nature-1.svg' },
  { value: '/backgrounds/nature-2.svg', label: t('自然 2'), preview: '/backgrounds/nature-2.svg' },
])

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
    alert(t('画像ファイルを選択してください'))
    return
  }

  // ファイルサイズチェック（5MB以下）
  if (file.size > 5 * 1024 * 1024) {
    alert(t('ファイルサイズは5MB以下にしてください'))
    return
  }

  // Fileオブジェクトをそのまま保存
  settingsStore.setBackgroundImage(file)

  // ファイル入力をリセット
  input.value = ''
}

/**
 * カスタム背景画像かどうかを判定
 */
const isCustomBackground = computed(() => {
  const bg = settingsStore.backgroundImage
  // Fileオブジェクトまたはdata: URLの場合はカスタム画像
  return bg instanceof File || (typeof bg === 'string' && bg.startsWith('data:'))
})

/**
 * ダークモード変更ハンドラ
 */
async function handleDarkModeChange() {
  await nextTick()
  await settingsStore.saveSettings()
}

/**
 * 日付変更線変更ハンドラ
 */
async function handleDateChangeLineChange() {
  await nextTick()
  await settingsStore.saveSettings()
}

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
      pinError.value = t('PINコードは4桁以上で入力してください')
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
      pinError.value = t('PINコードが一致しません')
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
      alert(t('PINコードを設定しました'))
    }
    catch (e) {
      pinError.value = e instanceof Error ? e.message : t('PIN設定に失敗しました')
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
  const confirmed = confirm(t('ロック機能を無効化しますか？\nPINコードもリセットされます。'))
  if (confirmed) {
    lockStore.resetPin()
    alert(t('ロック機能を無効化しました'))
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
      alert(t('生体認証の登録に失敗しました。デバイスが生体認証に対応しているか確認してください。'))
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
    throw new Error(t('このブラウザは生体認証に対応していません'))
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
      alert(t('生体認証を登録しました'))
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

/**
 * 言語を変更
 */
async function handleLanguageChange(lang: 'ja' | 'en') {
  await setLocale(lang)
  await settingsStore.setLanguage(lang)
}

// 初期化時に保存された言語設定を適用
onMounted(async () => {
  if (settingsStore.language) {
    await setLocale(settingsStore.language)
  }
})
</script>

<template>
  <div class="container">
    <!-- ヘッダー -->
    <header class="settings-header">
      <h1>
        <Icon name="mdi:cog" />
        {{ $t('設定') }}
      </h1>
    </header>

    <!-- ダークモード設定 -->
    <section class="settings-section card">
      <h2>
        <Icon name="mdi:theme-light-dark" />
        {{ $t('表示設定') }}
      </h2>
      <div class="setting-item">
        <div class="setting-info">
          <h3>{{ $t('ダークモード') }}</h3>
          <p>{{ $t('画面を暗い色調で表示します') }}</p>
        </div>
        <label class="toggle-switch">
          <input
            v-model="settingsStore.darkMode"
            type="checkbox"
            @change="handleDarkModeChange"
          >
          <span class="slider" />
        </label>
      </div>
    </section>

    <!-- 言語設定 -->
    <section class="settings-section card">
      <h2>
        <Icon name="mdi:translate" />
        {{ $t('言語') }}
      </h2>
      <p class="section-description">
        {{ $t('アプリの表示言語を選択できます') }}
      </p>
      <div class="language-options">
        <div
          class="language-option"
          :class="{ active: settingsStore.language === 'ja' }"
          @click="handleLanguageChange('ja')"
        >
          <Icon
            name="mdi:check-circle"
            class="check-icon"
          />
          <span>{{ $t('日本語') }}</span>
        </div>
        <div
          class="language-option"
          :class="{ active: settingsStore.language === 'en' }"
          @click="handleLanguageChange('en')"
        >
          <Icon
            name="mdi:check-circle"
            class="check-icon"
          />
          <span>{{ $t('英語') }}</span>
        </div>
      </div>
    </section>

    <!-- 日付変更線設定 -->
    <section class="settings-section card">
      <h2>
        <Icon name="mdi:clock-outline" />
        {{ $t('日付変更線') }}
      </h2>
      <p class="section-description">
        {{ $t('日付変更線を設定すると、指定した時刻から翌日同時刻の直前までを1日として扱います。深夜作業が多い場合に便利です。') }}
      </p>
      <div class="setting-item">
        <div class="setting-info">
          <h3>{{ $t('日付変更線の時刻') }}</h3>
          <p>
            {{ settingsStore.dateChangeLine }}{{ $t('時') }}
            {{ settingsStore.dateChangeLine > 0 ? $t('（当日{hour}時〜翌日{nextHour}時台）', { hour: settingsStore.dateChangeLine, nextHour: settingsStore.dateChangeLine - 1 }) : $t('（通常の日付変更）') }}
          </p>
        </div>
        <div class="date-line-input">
          <input
            v-model.number="settingsStore.dateChangeLine"
            type="range"
            min="0"
            max="23"
            class="date-line-slider"
            @change="handleDateChangeLineChange"
          >
        </div>
      </div>
      <div class="date-line-example">
        <Icon name="mdi:information-outline" />
        <span>
          {{ $t('例: 4時に設定した場合、12月12日は当日4:00から翌日3:59までを指します') }}
        </span>
      </div>
    </section>

    <!-- プリセット管理 -->
    <section class="settings-section card">
      <PresetManager />
    </section>

    <!-- ロック設定 -->
    <section class="settings-section card">
      <h2>
        <Icon name="mdi:lock" />
        {{ $t('セキュリティ') }}
      </h2>
      <p class="section-description">
        {{ $t('PINコードまたは生体認証でアプリをロックできます') }}
      </p>

      <!-- ロック機能が未設定の場合 -->
      <div
        v-if="!lockStore.isLockConfigured"
        class="lock-setup"
      >
        <p class="lock-info">
          {{ $t('ロック機能を有効にすると、アプリ起動時にPINコードの入力が必要になります。') }}
        </p>
        <UiButton
          variant="primary"
          block
          @click="openPinSetup"
        >
          <Icon name="mdi:lock-plus" />
          {{ $t('PINコードを設定') }}
        </UiButton>
      </div>

      <!-- ロック機能が設定済みの場合 -->
      <div
        v-else
        class="lock-settings"
      >
        <div class="setting-item">
          <div class="setting-info">
            <h3>{{ $t('ロック機能') }}</h3>
            <p>{{ $t('有効') }}</p>
          </div>
          <Icon
            name="mdi:check-circle"
            class="status-icon enabled"
          />
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <h3>{{ $t('生体認証') }}</h3>
            <p>
              {{ lockStore.biometricCredentialId ? $t('登録済み - 指紋認証・顔認証を使用する') : $t('指紋認証・顔認証を使用する') }}
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
            {{ $t('ロック機能を無効化') }}
          </UiButton>
        </div>
      </div>
    </section>

    <!-- 背景画像設定 -->
    <section class="settings-section card">
      <h2>
        <Icon name="mdi:image" />
        {{ $t('背景画像') }}
      </h2>
      <p class="section-description">
        {{ $t('アプリの背景に表示する画像を選択できます') }}
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
            :style="isCustomBackground ? { backgroundImage: `url(${settingsStore.backgroundImageDisplay})` } : {}"
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
          <span class="background-label">{{ $t('カスタム画像') }}</span>
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
        {{ $t('戻る') }}
      </UiButton>
    </div>

    <!-- PIN設定モーダル -->
    <UiModal
      :show="showPinSetupModal"
      :title="$t('PINコード設定')"
      @close="closePinSetupModal"
    >
      <div class="pin-setup-modal">
        <p class="pin-setup-instruction">
          {{ pinSetupStep === 'initial' ? $t('PINコードを入力してください（4桁以上）') : $t('もう一度PINコードを入力してください') }}
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

// 日付変更線設定
.date-line-input {
  width: 200px;
  display: flex;
  align-items: center;

  .date-line-slider {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: #e0e0e0;
    outline: none;
    appearance: none;
    cursor: pointer;

    &::-webkit-slider-thumb {
      appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #4a90d9;
      cursor: pointer;
      transition: background 0.15s ease;

      &:hover {
        background: #3a7bc8;
      }
    }

    &::-moz-range-thumb {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #4a90d9;
      cursor: pointer;
      border: none;
      transition: background 0.15s ease;

      &:hover {
        background: #3a7bc8;
      }
    }

    // ダークモード対応
    .dark-mode & {
      background: #444;
    }
  }
}

.date-line-example {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background-color: rgba(74, 144, 217, 0.1);
  border-radius: 8px;
  font-size: 13px;
  color: #555;
  margin-top: 12px;
  border: 1px solid rgba(74, 144, 217, 0.3);

  // ダークモード対応
  .dark-mode & {
    background-color: rgba(74, 144, 217, 0.15);
    color: #b0b0b0;
  }
}

// 言語選択
.language-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.language-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #4a90d9;
    background-color: rgba(74, 144, 217, 0.05);
  }

  &.active {
    border-color: #4a90d9;
    background-color: rgba(74, 144, 217, 0.1);

    .check-icon {
      color: #4a90d9;
    }
  }

  .check-icon {
    font-size: 24px;
    color: transparent;
    transition: color 0.2s ease;
  }

  span {
    font-size: 16px;
    font-weight: 500;

    // ダークモード対応
    .dark-mode & {
      color: #e0e0e0;
    }
  }

  // ダークモード対応
  .dark-mode & {
    border-color: #444;

    &:hover {
      border-color: #4a90d9;
      background-color: rgba(74, 144, 217, 0.1);
    }

    &.active {
      background-color: rgba(74, 144, 217, 0.15);
    }
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

  .date-line-input {
    width: 150px;
  }

  .date-line-example {
    font-size: 12px;
    padding: 10px;
  }
}
</style>
