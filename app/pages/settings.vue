<script setup lang="ts">
/**
 * 設定画面
 * ダークモードの切り替え、背景画像の選択、ロック機能の設定などのアプリ設定を提供します。
 */
import { useSettingsStore } from '~/stores/settings'
import { useLockStore } from '~/stores/lock'
import { useHealthDataStore } from '~/stores/healthData'
import PinInput from '~/components/shared/PinInput.vue'
import PresetManager from '~/components/settings/PresetManager.vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import {
  checkHealthConnectAvailability,
  createEmptyPermissionsMap,
  getHealthConnectPermissions,
  isAndroidNativeApp,
  openHealthConnectSettings,
  requestHealthConnectPermissions,
  type HealthConnectAvailabilityResult,
  type HealthConnectMetricKey,
  type HealthConnectPermissionsMap,
} from '~/utils/healthConnect'
import {
  checkMealAiAvailability,
  downloadMealAiModel,
  type MealAiAvailabilityResult,
  type MealAiDownloadProgressEvent,
} from '~/utils/mealAi'

const settingsStore = useSettingsStore()
const lockStore = useLockStore()
const healthDataStore = useHealthDataStore()
const { t, setLocale } = useI18n()
const router = useRouter()

// Health Connect 関連状態
const isAndroidApp = computed(() => isAndroidNativeApp())
const hcAvailability = ref<HealthConnectAvailabilityResult>({
  available: false,
  status: 'unavailable',
  platform: 'web',
})
const hcPermissions = ref<HealthConnectPermissionsMap>(createEmptyPermissionsMap())
const hcAnyReadGranted = ref(false)
const hcAnyWriteGranted = ref(false)
const isCheckingHC = ref(false)
const isSyncingRecentHC = ref(false)

// オンデバイスAI（Gemini Nano）食事写真解析 関連状態
const mealAiAvailability = ref<MealAiAvailabilityResult>({
  available: false,
  status: 'unavailable',
  platform: 'web',
})
const isCheckingMealAi = ref(false)
const isDownloadingMealAi = ref(false)
const mealAiDownloadProgress = ref<MealAiDownloadProgressEvent | null>(null)
const mealAiStatusMessage = ref('')

const mealAiDownloadPercent = computed(() => {
  const prog = mealAiDownloadProgress.value
  if (!prog || prog.bytesToDownload <= 0) {
    return null
  }
  const pct = Math.round((prog.totalBytesDownloaded / prog.bytesToDownload) * 100)
  return Math.max(0, Math.min(100, pct))
})

const mealAiStatusBadgeText = computed(() => {
  switch (mealAiAvailability.value.status) {
    case 'available':
      return t('準備完了（オフライン推論可能）')
    case 'downloadable':
      return t('初回モデルダウンロードが必要')
    case 'downloading':
      return t('モデルダウンロード中')
    default:
      return t('利用不可（非対応端末）')
  }
})

async function refreshMealAiStatus() {
  if (!isAndroidApp.value || isCheckingMealAi.value) {
    return
  }
  isCheckingMealAi.value = true
  mealAiStatusMessage.value = ''
  try {
    mealAiAvailability.value = await checkMealAiAvailability()
  }
  finally {
    isCheckingMealAi.value = false
  }
}

async function handleDownloadMealAiModel() {
  if (!isAndroidApp.value || isDownloadingMealAi.value) {
    return
  }
  isDownloadingMealAi.value = true
  mealAiDownloadProgress.value = null
  mealAiStatusMessage.value = ''
  try {
    await downloadMealAiModel((event) => {
      mealAiDownloadProgress.value = event
    })
    mealAiAvailability.value = {
      available: true,
      status: 'available',
      platform: 'android',
    }
    mealAiStatusMessage.value = t('オンデバイスAIモデルの準備が完了しました（オフラインでも利用可能です）')
  }
  catch {
    mealAiStatusMessage.value = t('オンデバイスAIモデルのダウンロードに失敗しました。ネットワーク接続と空き容量を確認してください')
    await refreshMealAiStatus()
  }
  finally {
    isDownloadingMealAi.value = false
    mealAiDownloadProgress.value = null
  }
}

const healthConnectMetricLabels = computed<Array<{ key: HealthConnectMetricKey, label: string }>>(() => [
  { key: 'steps', label: t('歩数') },
  { key: 'sleep', label: t('睡眠時間') },
  { key: 'heartRate', label: t('心拍数') },
  { key: 'weight', label: t('体重') },
  { key: 'bodyFatPercentage', label: t('体脂肪率') },
  { key: 'waterIntake', label: t('水分摂取量') },
  { key: 'exerciseMinutes', label: t('運動時間') },
])

const formattedLastSyncedAt = computed(() => {
  const raw = settingsStore.healthConnectSettings?.lastSyncedAt
  if (!raw) {
    return t('未同期')
  }
  const parsed = dayjs(raw)
  return parsed.isValid() ? parsed.format('YYYY/MM/DD HH:mm') : t('未同期')
})

async function refreshHealthConnectStatus() {
  if (!isAndroidApp.value) {
    return
  }
  isCheckingHC.value = true
  try {
    hcAvailability.value = await checkHealthConnectAvailability()
    if (hcAvailability.value.available) {
      const permResult = await getHealthConnectPermissions()
      hcPermissions.value = permResult.permissions
      hcAnyReadGranted.value = permResult.anyReadGranted
      hcAnyWriteGranted.value = permResult.anyWriteGranted
    }
  }
  catch (e) {
    console.error('Failed to check Health Connect status:', e)
  }
  finally {
    isCheckingHC.value = false
  }
}

async function handleHealthConnectToggle() {
  await nextTick()
  const enabled = settingsStore.healthConnectSettings.enabled
  await settingsStore.updateHealthConnectSettings({ enabled })

  if (enabled && isAndroidApp.value && hcAvailability.value.available) {
    if (!hcAnyReadGranted.value && !hcAnyWriteGranted.value) {
      await handleRequestHealthConnectPermissions()
    }
  }
}

async function handleRequestHealthConnectPermissions() {
  if (!isAndroidApp.value) {
    return
  }
  isCheckingHC.value = true
  try {
    const permResult = await requestHealthConnectPermissions()
    hcPermissions.value = permResult.permissions
    hcAnyReadGranted.value = permResult.anyReadGranted
    hcAnyWriteGranted.value = permResult.anyWriteGranted
  }
  catch (e) {
    console.error('Failed to request Health Connect permissions:', e)
    alert(t('Health Connectの権限要求に失敗しました'))
  }
  finally {
    isCheckingHC.value = false
  }
}

async function handleOpenHealthConnectSettings() {
  try {
    await openHealthConnectSettings()
  }
  catch (e) {
    console.error('Failed to open Health Connect settings:', e)
  }
}

async function handleBulkSyncHealthConnect() {
  if (!isAndroidApp.value) {
    return
  }
  isSyncingRecentHC.value = true
  try {
    const result = await healthDataStore.syncRecentFromHealthConnect(30)
    if (result.allPermissionDenied) {
      alert(t('Health Connectの読み取り権限が許可されていません'))
      return
    }
    if (result.allFailed) {
      alert(t('Health Connectからのデータ取得に失敗しました'))
      return
    }

    await settingsStore.updateHealthConnectSettings({
      lastSyncedAt: new Date().toISOString(),
    })

    if (result.partialFailedFieldsCount > 0 || result.failedDaysCount > 0) {
      alert(t('直近30日分のデータを一部同期しました（更新日数: {days}日）', { days: result.syncedDaysCount }))
    }
    else {
      alert(t('直近30日分のデータを同期しました（更新日数: {days}日）', { days: result.syncedDaysCount }))
    }
  }
  catch (e) {
    console.error('Failed to bulk sync from Health Connect:', e)
    alert(t('Health Connectからのデータ取得に失敗しました'))
  }
  finally {
    isSyncingRecentHC.value = false
  }
}

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
 * ダークモード同期変更ハンドラ
 */
async function handleDarkModeSyncChange() {
  await nextTick()
  await settingsStore.updateDarkModeSync()
}

/**
 * 日付変更線変更ハンドラ
 */
async function handleDateChangeLineChange() {
  await nextTick()
  await settingsStore.saveSettings()
}

/**
 * 身長変更ハンドラ
 */
async function handleHeightChange() {
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
  await Promise.all([
    refreshHealthConnectStatus(),
    refreshMealAiStatus(),
  ])
})

function goBack() {
  router.back()
}
</script>

<template>
  <div class="container">
    <!-- ヘッダー -->
    <header class="settings-header">
      <button
        class="btn btn-secondary btn-icon"
        :aria-label="$t('戻る')"
        @click="goBack"
      >
        <Icon name="mdi:arrow-left" />
      </button>
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
            :disabled="settingsStore.darkModeSync"
            @change="handleDarkModeChange"
          >
          <span class="slider" />
        </label>
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <h3>{{ $t('システムと同期') }}</h3>
          <p>{{ $t('システム(OS)のダークモード設定と同期します') }}</p>
        </div>
        <label class="toggle-switch">
          <input
            v-model="settingsStore.darkModeSync"
            type="checkbox"
            @change="handleDarkModeSyncChange"
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

    <!-- 健康管理設定 -->
    <section class="settings-section card">
      <h2>
        <Icon name="mdi:heart-pulse" />
        {{ $t('健康管理') }}
      </h2>
      <p class="section-description">
        {{ $t('健康データの管理に必要な情報を設定します') }}
      </p>
      <div class="setting-item">
        <div class="setting-info">
          <h3>{{ $t('身長') }}</h3>
          <p>{{ $t('BMI計算に使用されます') }}</p>
        </div>
        <div class="height-input">
          <input
            v-model.number="settingsStore.height"
            type="number"
            min="100"
            max="250"
            step="0.1"
            :placeholder="$t('170')"
            @change="handleHeightChange"
          >
          <span class="unit">cm</span>
        </div>
      </div>

      <!-- Health Connect連携設定 -->
      <div class="health-connect-settings-block">
        <div class="setting-item">
          <div class="setting-info">
            <h3>
              <Icon name="mdi:sync" />
              {{ $t('Health Connect連携') }}
            </h3>
            <p>
              {{ $t('AndroidのHealth Connectと健康データ（歩数・睡眠時間・心拍数・体重・体脂肪率・水分摂取量・運動時間）を双方向連携します') }}
            </p>
          </div>
          <label
            v-if="isAndroidApp && hcAvailability.available"
            class="toggle-switch"
          >
            <input
              v-model="settingsStore.healthConnectSettings.enabled"
              type="checkbox"
              @change="handleHealthConnectToggle"
            >
            <span class="slider" />
          </label>
        </div>

        <!-- Web/PWA版での案内表示 -->
        <div
          v-if="!isAndroidApp"
          class="hc-info-banner"
        >
          <Icon name="mdi:cellphone-information" />
          <span>
            {{ $t('Androidアプリ版でのみ利用可能です（Web/PWA版では手動での健康データ記録を引き続きご利用いただけます）') }}
          </span>
        </div>

        <!-- Android版: Health Connect未インストール・要更新時 -->
        <div
          v-else-if="hcAvailability.status === 'provider_update_required'"
          class="hc-info-banner warning"
        >
          <Icon name="mdi:alert-circle-outline" />
          <span>
            {{ $t('Health Connectアプリのインストールまたはアップデートが必要です') }}
          </span>
        </div>

        <!-- Android版: Health Connect非対応端末時 -->
        <div
          v-else-if="!hcAvailability.available"
          class="hc-info-banner warning"
        >
          <Icon name="mdi:alert-circle-outline" />
          <span>
            {{ $t('この端末ではHealth Connectを利用できません') }}
          </span>
        </div>

        <!-- Android版: Health Connect利用可能時 -->
        <div
          v-else
          class="hc-android-controls"
        >
          <div class="hc-sync-meta">
            <span>{{ $t('最終同期日時') }}: {{ formattedLastSyncedAt }}</span>
          </div>

          <!-- 項目ごとの権限状態バッジ -->
          <div class="hc-permissions-grid">
            <div
              v-for="metric in healthConnectMetricLabels"
              :key="metric.key"
              class="hc-permission-item"
            >
              <span class="metric-name">{{ metric.label }}</span>
              <div class="permission-badges">
                <span
                  class="perm-badge"
                  :class="{ granted: hcPermissions[metric.key]?.read }"
                >
                  {{ $t('読取') }}: {{ hcPermissions[metric.key]?.read ? $t('許可') : $t('未許可') }}
                </span>
                <span
                  class="perm-badge"
                  :class="{ granted: hcPermissions[metric.key]?.write }"
                >
                  {{ $t('書込') }}: {{ hcPermissions[metric.key]?.write ? $t('許可') : $t('未許可') }}
                </span>
              </div>
            </div>
          </div>

          <div class="hc-control-buttons">
            <UiButton
              variant="secondary"
              block
              :disabled="isCheckingHC || isSyncingRecentHC"
              @click="handleRequestHealthConnectPermissions"
            >
              <Icon name="mdi:shield-check-outline" />
              {{ $t('アクセス権限を許可・確認') }}
            </UiButton>

            <UiButton
              variant="secondary"
              block
              :disabled="isCheckingHC || isSyncingRecentHC"
              @click="handleOpenHealthConnectSettings"
            >
              <Icon name="mdi:open-in-new" />
              {{ $t('Health Connect設定を開く') }}
            </UiButton>

            <UiButton
              v-if="settingsStore.healthConnectSettings.enabled"
              variant="primary"
              block
              :disabled="isCheckingHC || isSyncingRecentHC"
              @click="handleBulkSyncHealthConnect"
            >
              <Icon name="mdi:cloud-download-outline" />
              {{ isSyncingRecentHC ? $t('同期中') + '...' : $t('直近30日分をHealth Connectから一括取得') }}
            </UiButton>
          </div>
        </div>
      </div>

      <!-- オンデバイスAI食事写真解析（Gemini Nano）設定 -->
      <div class="health-connect-settings-block meal-ai-settings-block">
        <div class="setting-item">
          <div class="setting-info">
            <h3>
              <Icon name="mdi:creation" />
              {{ $t('オンデバイスAI食事写真解析（Gemini Nano）') }}
            </h3>
            <p>
              {{ $t('食事写真を端末内のGemini Nano（ML Kit GenAI Prompt API）で解析し、写真を外部サーバーへ送信せずにカロリー・PFCを推定します') }}
            </p>
          </div>
        </div>

        <!-- Web/PWA版での案内表示 -->
        <div
          v-if="!isAndroidApp"
          class="hc-info-banner"
        >
          <Icon name="mdi:cellphone-information" />
          <span>
            {{ $t('Androidアプリ版（Gemini Nano対応端末）でのみ利用可能です（Web/PWA版では手動での食事ログ記録を引き続きご利用いただけます）') }}
          </span>
        </div>

        <!-- Android版: モデルステータスと事前ダウンロード操作 -->
        <div
          v-else
          class="hc-android-controls"
        >
          <div class="hc-permissions-grid">
            <div class="hc-permission-item">
              <span class="metric-name">{{ $t('モデル状態') }}</span>
              <div class="permission-badges">
                <span
                  class="perm-badge"
                  :class="{ granted: mealAiAvailability.status === 'available' }"
                >
                  {{ mealAiStatusBadgeText }}
                </span>
              </div>
            </div>
          </div>

          <div
            v-if="isDownloadingMealAi && mealAiDownloadPercent !== null"
            class="hc-info-banner"
          >
            <Icon name="mdi:cloud-download-outline" />
            <span>
              {{ $t('オンデバイスAIモデルをダウンロード中...') }} ({{ mealAiDownloadPercent }}%)
            </span>
          </div>

          <div
            v-if="mealAiStatusMessage"
            class="hc-info-banner"
            :class="{ warning: mealAiAvailability.status !== 'available' }"
          >
            <Icon :name="mealAiAvailability.status === 'available' ? 'mdi:check-circle-outline' : 'mdi:alert-circle-outline'" />
            <span>{{ mealAiStatusMessage }}</span>
          </div>

          <div class="hc-control-buttons">
            <UiButton
              v-if="mealAiAvailability.status === 'downloadable'"
              variant="primary"
              block
              :disabled="isCheckingMealAi || isDownloadingMealAi"
              @click="handleDownloadMealAiModel"
            >
              <Icon name="mdi:cloud-download-outline" />
              {{ isDownloadingMealAi ? $t('オンデバイスAIモデルをダウンロード中...') : $t('AIモデルを事前にダウンロード') }}
            </UiButton>

            <UiButton
              variant="secondary"
              block
              :disabled="isCheckingMealAi || isDownloadingMealAi"
              @click="refreshMealAiStatus"
            >
              <Icon name="mdi:refresh" />
              {{ $t('モデル状態を再確認') }}
            </UiButton>
          </div>
        </div>
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
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;

  h1 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 24px;
    font-weight: 600;

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

    &:disabled + .slider {
      opacity: 0.5;
      cursor: not-allowed;
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

// 身長入力
.height-input {
  display: flex;
  align-items: center;
  gap: 8px;

  input[type="number"] {
    width: 100px;
    padding: 8px 12px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    font-size: 14px;
    text-align: right;

    &:focus {
      outline: none;
      border-color: #4a90d9;
    }

    .dark-mode & {
      background-color: #333;
      border-color: #444;
      color: #e0e0e0;
    }
  }

  .unit {
    font-size: 14px;
    color: #666;

    .dark-mode & {
      color: #b0b0b0;
    }
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

.health-connect-settings-block {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;

  .dark-mode & {
    border-color: #444;
  }

  .setting-info h3 {
    display: flex;
    align-items: center;
    gap: 6px;
  }
}

.hc-info-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background-color: rgba(74, 144, 217, 0.1);
  border: 1px solid rgba(74, 144, 217, 0.3);
  border-radius: 8px;
  font-size: 13px;
  color: #555;
  margin-top: 8px;

  .dark-mode & {
    background-color: rgba(74, 144, 217, 0.15);
    color: #b0b0b0;
  }

  &.warning {
    background-color: rgba(255, 152, 0, 0.1);
    border-color: rgba(255, 152, 0, 0.35);
    color: #d97706;

    .dark-mode & {
      color: #fbbf24;
    }
  }
}

.hc-android-controls {
  margin-top: 12px;

  .hc-sync-meta {
    font-size: 12px;
    color: #666;
    margin-bottom: 12px;

    .dark-mode & {
      color: #b0b0b0;
    }
  }

  .hc-permissions-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
    padding: 12px;
    background-color: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #e0e0e0;

    .dark-mode & {
      background-color: #222;
      border-color: #444;
    }
  }

  .hc-permission-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 13px;

    .metric-name {
      font-weight: 500;
      color: #333;

      .dark-mode & {
        color: #e0e0e0;
      }
    }

    .permission-badges {
      display: flex;
      gap: 6px;
    }

    .perm-badge {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      background-color: #e0e0e0;
      color: #666;

      .dark-mode & {
        background-color: #333;
        color: #999;
      }

      &.granted {
        background-color: rgba(76, 175, 80, 0.15);
        color: #2e7d32;

        .dark-mode & {
          background-color: rgba(76, 175, 80, 0.25);
          color: #81c784;
        }
      }
    }
  }

  .hc-control-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
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
