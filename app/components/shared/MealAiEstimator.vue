<script setup lang="ts">
/**
 * オンデバイスAI（Gemini Nano / ML Kit GenAI Prompt API）食事写真栄養推定コンポーネント
 * Androidアプリ版でのみ表示され、モデル状態確認・初回ダウンロード・栄養素推定・
 * 結果バナー表示（タイトル・食事メモへのワンタップ反映付き）を提供します。
 */
import {
  analyzeMealPhotoWithAi,
  buildMealAiHintText,
  checkMealAiAvailability,
  downloadMealAiModel,
  extractMealAiErrorCode,
  formatMealAiDiagnosticsSummary,
  isMealAiSupportedPlatform,
  type MealAiAvailabilityResult,
  type MealAiDownloadProgressEvent,
  type MealAiNutritionEstimation,
} from '~/utils/mealAi'

const props = defineProps<{
  photo?: string
  title?: string
  mealMemo?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'apply-estimation': [estimation: MealAiNutritionEstimation]
  'apply-title': [dishName: string]
  'append-memo': [memoText: string]
  'busy-change': [isBusy: boolean]
}>()

const { t, locale } = useI18n()

const isAndroidApp = computed(() => isMealAiSupportedPlatform())

const availability = ref<MealAiAvailabilityResult>({
  available: false,
  status: 'unavailable',
  platform: 'web',
  retryable: false,
})

const isCheckingStatus = ref(false)
const isDownloading = ref(false)
const isAnalyzing = ref(false)
const downloadProgress = ref<MealAiDownloadProgressEvent | null>(null)
const estimationResult = ref<MealAiNutritionEstimation | null>(null)
const errorMessage = ref('')
const errorDiagnosticsSummary = ref('')

// 古い推論結果の破棄用リクエスト世代カウンタとアンマウントフラグ
const requestGeneration = ref(0)
const isUnmounted = ref(false)

const isBusy = computed(() => isAnalyzing.value || isDownloading.value)

watch(isBusy, (busy) => {
  emit('busy-change', busy)
})

const downloadPercent = computed(() => {
  const prog = downloadProgress.value
  if (!prog || prog.bytesToDownload <= 0) {
    return null
  }
  const pct = Math.round((prog.totalBytesDownloaded / prog.bytesToDownload) * 100)
  return Math.max(0, Math.min(100, pct))
})

const formattedDownloadSize = computed(() => {
  const prog = downloadProgress.value
  if (!prog || prog.totalBytesDownloaded <= 0) {
    return ''
  }
  const downloadedMb = (prog.totalBytesDownloaded / (1024 * 1024)).toFixed(1)
  if (prog.bytesToDownload > 0) {
    const totalMb = (prog.bytesToDownload / (1024 * 1024)).toFixed(1)
    return `${downloadedMb} MB / ${totalMb} MB`
  }
  return `${downloadedMb} MB`
})

const formattedRecognizedItems = computed(() => {
  if (!estimationResult.value) {
    return ''
  }
  return estimationResult.value.recognizedItems.join('、')
})

/**
 * 進行中のリクエストを無効化し、推定結果・エラー表示をリセットする
 */
function reset() {
  requestGeneration.value += 1
  isAnalyzing.value = false
  estimationResult.value = null
  errorMessage.value = ''
  errorDiagnosticsSummary.value = ''
}

defineExpose({
  reset,
})

// 写真が差し替え・削除された場合は進行中の推論結果を破棄して表示をクリアする
watch(
  () => props.photo,
  async (newPhoto, oldPhoto) => {
    if (newPhoto !== oldPhoto) {
      reset()
      if (newPhoto && isAndroidApp.value) {
        await refreshAvailability()
      }
    }
  },
)

onMounted(async () => {
  if (isAndroidApp.value) {
    await refreshAvailability()
  }
})

onBeforeUnmount(() => {
  isUnmounted.value = true
  requestGeneration.value += 1
  if (isBusy.value) {
    emit('busy-change', false)
  }
})

/**
 * モデル利用可否・準備状態を確認
 */
async function refreshAvailability() {
  if (!isAndroidApp.value || isCheckingStatus.value) {
    return
  }
  isCheckingStatus.value = true
  try {
    const result = await checkMealAiAvailability()
    if (!isUnmounted.value) {
      availability.value = result
    }
  }
  finally {
    if (!isUnmounted.value) {
      isCheckingStatus.value = false
    }
  }
}

/**
 * エラーコードからユーザー向け多言語メッセージへ変換
 */
function resolveErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'MODEL_DOWNLOAD_REQUIRED':
      return t('オンデバイスAIモデルの初回ダウンロードが必要です')
    case 'MODEL_DOWNLOADING':
      return t('オンデバイスAIモデルをダウンロード中です。完了後に再度お試しください')
    case 'MODEL_UNAVAILABLE':
    case 'NOT_SUPPORTED':
    case 'AICORE_INCOMPATIBLE':
      return t('この端末ではGemini Nano（オンデバイスAI）を利用できません。手動で入力してください')
    case 'NOT_ENOUGH_STORAGE':
      return t('端末の空き容量が不足しているため、AIモデルを利用できません')
    case 'QUOTA_EXCEEDED':
    case 'BUSY':
      return t('オンデバイスAIが混雑または一時制限中です。しばらく待ってから再度お試しください')
    case 'INVALID_IMAGE':
      return t('食事写真の読み込みに失敗しました。別の写真を選択するか手動で入力してください')
    case 'TIMEOUT':
      return t('AIによる解析がタイムアウトしました。再度お試しいただくか手動で入力してください')
    case 'SCHEMA_ECHO':
    case 'STRUCTURED_OUTPUT_INVALID_CLASS':
    case 'OUTPUT_TRUNCATED':
    case 'OUT_OF_RANGE':
    case 'INVALID_NUTRITION_VALUE':
    case 'INVALID_DISH_NAME':
    case 'INVALID_FIELD_TYPE':
    case 'MISSING_FIELD':
    case 'INVALID_JSON':
    case 'INVALID_RESPONSE':
    case 'EMPTY_RESPONSE':
      return t('AIの推定結果が不正な形式だったため反映を中止しました。再度お試しいただくか手動で入力してください')
    default:
      return t('AIによる栄養素の推定に失敗しました。手動で入力してください')
  }
}

/**
 * 食事写真のオンデバイス栄養素推定を実行
 */
async function handleEstimate() {
  if (!isAndroidApp.value || !props.photo || isBusy.value || props.disabled) {
    return
  }

  const currentGeneration = ++requestGeneration.value
  const photoSnapshot = props.photo
  const hintSnapshot = buildMealAiHintText(props.title, props.mealMemo)
  const localeSnapshot = typeof locale.value === 'string' ? locale.value : 'ja'

  errorMessage.value = ''
  errorDiagnosticsSummary.value = ''
  estimationResult.value = null
  isAnalyzing.value = true

  try {
    const outcome = await analyzeMealPhotoWithAi({
      photoBase64: photoSnapshot,
      hintText: hintSnapshot,
      locale: localeSnapshot,
    })

    // 写真差し替え・削除・リセット・アンマウント後の古い結果は破棄する
    if (isUnmounted.value || currentGeneration !== requestGeneration.value || props.photo !== photoSnapshot) {
      return
    }

    if (!outcome.ok) {
      if (outcome.errorCode === 'MODEL_DOWNLOAD_REQUIRED') {
        availability.value = {
          ...availability.value,
          available: false,
          status: 'downloadable',
        }
      }
      else if (outcome.errorCode === 'MODEL_DOWNLOADING') {
        availability.value = {
          ...availability.value,
          available: false,
          status: 'downloading',
        }
      }
      errorMessage.value = resolveErrorMessage(outcome.errorCode)
      errorDiagnosticsSummary.value = formatMealAiDiagnosticsSummary(outcome.errorCode, outcome.diagnostics)
      return
    }

    if (!outcome.isFood) {
      errorMessage.value = t('写真から食事・食品を認識できませんでした。手動で入力してください')
      errorDiagnosticsSummary.value = formatMealAiDiagnosticsSummary('NOT_FOOD', outcome.diagnostics)
      return
    }

    // 全項目のバリデーションに成功した推定結果のみを保存・親フォームへ一括反映
    estimationResult.value = outcome.estimation
    emit('apply-estimation', outcome.estimation)
  }
  finally {
    if (!isUnmounted.value && currentGeneration === requestGeneration.value) {
      isAnalyzing.value = false
    }
  }
}

/**
 * モデルが未ダウンロード（downloadable）の場合にダウンロードしてから推定を実行
 */
async function handleDownloadAndEstimate() {
  if (!isAndroidApp.value || isBusy.value || props.disabled) {
    return
  }

  const currentGeneration = ++requestGeneration.value
  const photoSnapshot = props.photo
  errorMessage.value = ''
  errorDiagnosticsSummary.value = ''
  downloadProgress.value = null
  isDownloading.value = true

  try {
    await downloadMealAiModel((event) => {
      if (!isUnmounted.value) {
        downloadProgress.value = event
      }
    })

    if (isUnmounted.value) {
      return
    }

    availability.value = {
      available: true,
      status: 'available',
      platform: 'android',
    }
  }
  catch (err) {
    if (!isUnmounted.value) {
      const errCode = extractMealAiErrorCode(err, 'DOWNLOAD_FAILED')
      errorMessage.value = t('オンデバイスAIモデルのダウンロードに失敗しました。ネットワーク接続と空き容量を確認してください')
      errorDiagnosticsSummary.value = formatMealAiDiagnosticsSummary(errCode, {
        stage: 'model_download',
        errorCode: errCode,
      })
      await refreshAvailability()
    }
    return
  }
  finally {
    if (!isUnmounted.value) {
      isDownloading.value = false
      downloadProgress.value = null
    }
  }

  // ダウンロード中に写真が変更・削除されておらず、同じ世代であれば続けて推論を実行
  if (!isUnmounted.value && currentGeneration === requestGeneration.value && props.photo && props.photo === photoSnapshot) {
    await handleEstimate()
  }
}

/**
 * 認識した料理名をアイテムの「タイトル」へ反映
 */
function handleApplyTitle() {
  if (!estimationResult.value?.dishName || isBusy.value || props.disabled) {
    return
  }
  emit('apply-title', estimationResult.value.dishName)
}

/**
 * 認識した料理・食品を「食事メモ」へ追記
 */
function handleAppendMemo() {
  if (!estimationResult.value || isBusy.value || props.disabled) {
    return
  }
  const { dishName, recognizedItems } = estimationResult.value
  const itemsText = recognizedItems.length > 0 && !(recognizedItems.length === 1 && recognizedItems[0] === dishName)
    ? `${dishName}（${recognizedItems.join('、')}）`
    : dishName
  emit('append-memo', itemsText)
}
</script>

<template>
  <div
    v-if="isAndroidApp && photo"
    class="meal-ai-estimator"
  >
    <!-- 1. モデル利用可能時: 栄養素推定ボタン -->
    <div
      v-if="availability.status === 'available'"
      class="meal-ai-actions"
    >
      <UiButton
        type="button"
        variant="secondary"
        block
        class="meal-ai-estimate-btn"
        :disabled="isBusy || disabled || isCheckingStatus"
        @click="handleEstimate"
      >
        <Icon
          :name="isAnalyzing ? 'mdi:loading' : 'mdi:creation'"
          :class="{ spinning: isAnalyzing }"
        />
        {{ isAnalyzing ? $t('オンデバイスAIで解析中...') : $t('AIで栄養素を推定（Gemini Nano）') }}
      </UiButton>
    </div>

    <!-- 2. モデル要ダウンロード時 -->
    <div
      v-else-if="availability.status === 'downloadable'"
      class="meal-ai-download-box"
    >
      <div class="meal-ai-status-text">
        <Icon name="mdi:download-circle-outline" />
        <span>{{ $t('オンデバイスAIモデル（Gemini Nano）の初回ダウンロードが必要です') }}</span>
      </div>
      <div class="meal-ai-action-row">
        <UiButton
          type="button"
          variant="secondary"
          block
          class="meal-ai-download-btn"
          :disabled="isBusy || disabled || isCheckingStatus"
          @click="handleDownloadAndEstimate"
        >
          <Icon name="mdi:cloud-download-outline" />
          {{ $t('AIモデルをダウンロードして推定') }}
        </UiButton>
      </div>
    </div>

    <!-- 3. モデルダウンロード中 -->
    <div
      v-else-if="availability.status === 'downloading' || isDownloading"
      class="meal-ai-progress-box"
    >
      <div class="meal-ai-status-text">
        <Icon
          name="mdi:loading"
          class="spinning"
        />
        <span>
          {{ $t('オンデバイスAIモデルをダウンロード中...') }}
          <template v-if="downloadPercent !== null">
            ({{ downloadPercent }}%)
          </template>
        </span>
      </div>
      <div
        v-if="downloadPercent !== null"
        class="meal-ai-progress-bar"
      >
        <div
          class="meal-ai-progress-fill"
          :style="{ width: `${downloadPercent}%` }"
        />
      </div>
      <div
        v-if="formattedDownloadSize"
        class="meal-ai-progress-meta"
      >
        {{ formattedDownloadSize }}
      </div>
    </div>

    <!-- 4. 非対応端末または一時的な確認エラー時 -->
    <div
      v-else
      class="meal-ai-unavailable-box"
    >
      <div class="meal-ai-status-text muted">
        <Icon name="mdi:information-outline" />
        <span>
          {{
            availability.retryable
              ? $t('オンデバイスAI（Gemini Nano）の準備状態を確認できませんでした')
              : $t('この端末ではGemini Nano（オンデバイスAI）を利用できません。手動で入力してください')
          }}
        </span>
      </div>
      <UiButton
        v-if="availability.retryable"
        type="button"
        variant="secondary"
        size="small"
        :disabled="isCheckingStatus || isBusy || disabled"
        @click="refreshAvailability"
      >
        <Icon name="mdi:refresh" />
        {{ $t('状態を再確認') }}
      </UiButton>
    </div>

    <!-- エラーメッセージおよび診断情報（個人情報なし）表示 -->
    <div
      v-if="errorMessage"
      class="meal-ai-error-banner"
      role="alert"
    >
      <Icon name="mdi:alert-circle-outline" />
      <div class="meal-ai-error-content">
        <span>{{ errorMessage }}</span>
        <code
          v-if="errorDiagnosticsSummary"
          class="meal-ai-error-diagnostics"
        >
          {{ errorDiagnosticsSummary }}
        </code>
      </div>
    </div>

    <!-- AI推定結果バナー（認識料理・注意書き・ワンタップ反映ボタン） -->
    <div
      v-if="estimationResult"
      class="meal-ai-result-banner"
    >
      <div class="meal-ai-result-header">
        <Icon
          name="mdi:creation"
          class="ai-icon"
        />
        <span class="ai-badge-title">{{ $t('Gemini NanoによるAI推定結果（オンデバイス）') }}</span>
      </div>

      <div class="meal-ai-recognized-info">
        <div class="recognized-dish">
          <strong>{{ $t('認識した料理') }}:</strong> {{ estimationResult.dishName }}
        </div>
        <div
          v-if="estimationResult.recognizedItems.length > 1 || estimationResult.recognizedItems[0] !== estimationResult.dishName"
          class="recognized-items"
        >
          <strong>{{ $t('内訳') }}:</strong> {{ formattedRecognizedItems }}
        </div>
        <div class="recognized-macros">
          {{ estimationResult.calories }}kcal /
          P: {{ estimationResult.protein }}g /
          F: {{ estimationResult.fat }}g /
          C: {{ estimationResult.carbs }}g
        </div>
      </div>

      <p class="meal-ai-disclaimer">
        <Icon name="mdi:information-outline" />
        <span>{{ $t('AIによる推定値です。上の入力欄で内容を確認・修正してから保存してください。') }}</span>
      </p>

      <div class="meal-ai-quick-actions">
        <UiButton
          type="button"
          variant="secondary"
          size="small"
          class="quick-action-btn"
          :disabled="isBusy || disabled"
          @click="handleApplyTitle"
        >
          <Icon name="mdi:format-title" />
          {{ $t('タイトルに反映') }}
        </UiButton>
        <UiButton
          type="button"
          variant="secondary"
          size="small"
          class="quick-action-btn"
          :disabled="isBusy || disabled"
          @click="handleAppendMemo"
        >
          <Icon name="mdi:note-plus-outline" />
          {{ $t('食事メモに追記') }}
        </UiButton>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.meal-ai-estimator {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.meal-ai-estimate-btn,
.meal-ai-download-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
}

.meal-ai-download-box,
.meal-ai-progress-box,
.meal-ai-unavailable-box {
  padding: 10px 12px;
  border-radius: 8px;
  background-color: rgba(74, 144, 217, 0.08);
  border: 1px solid rgba(74, 144, 217, 0.25);
  display: flex;
  flex-direction: column;
  gap: 8px;

  .dark-mode & {
    background-color: rgba(74, 144, 217, 0.14);
    border-color: rgba(74, 144, 217, 0.35);
  }
}

.meal-ai-unavailable-box {
  background-color: rgba(128, 128, 128, 0.08);
  border-color: rgba(128, 128, 128, 0.25);

  .dark-mode & {
    background-color: rgba(255, 255, 255, 0.05);
    border-color: #444;
  }
}

.meal-ai-status-text {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
  line-height: 1.4;
  color: #333;

  .dark-mode & {
    color: #e0e0e0;
  }

  &.muted {
    color: #666;

    .dark-mode & {
      color: #b0b0b0;
    }
  }
}

.meal-ai-progress-bar {
  width: 100%;
  height: 6px;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 999px;
  overflow: hidden;

  .dark-mode & {
    background-color: rgba(255, 255, 255, 0.15);
  }

  .meal-ai-progress-fill {
    height: 100%;
    background-color: #4a90d9;
    transition: width 0.2s ease;
  }
}

.meal-ai-progress-meta {
  font-size: 11px;
  color: #666;
  text-align: right;

  .dark-mode & {
    color: #b0b0b0;
  }
}

.meal-ai-error-banner {
  padding: 10px 12px;
  border-radius: 8px;
  background-color: rgba(244, 67, 54, 0.08);
  border: 1px solid rgba(244, 67, 54, 0.3);
  color: #d32f2f;
  font-size: 12px;
  line-height: 1.4;
  display: flex;
  align-items: flex-start;
  gap: 6px;

  .dark-mode & {
    background-color: rgba(244, 67, 54, 0.15);
    border-color: rgba(244, 67, 54, 0.4);
    color: #ef9a9a;
  }

  .meal-ai-error-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .meal-ai-error-diagnostics {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    line-height: 1.3;
    opacity: 0.9;
    word-break: break-all;
  }
}

.meal-ai-result-banner {
  padding: 12px;
  border-radius: 8px;
  background-color: rgba(74, 144, 217, 0.1);
  border: 1px solid rgba(74, 144, 217, 0.35);
  display: flex;
  flex-direction: column;
  gap: 8px;

  .dark-mode & {
    background-color: rgba(74, 144, 217, 0.16);
    border-color: rgba(74, 144, 217, 0.45);
  }

  .meal-ai-result-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: #1976d2;

    .dark-mode & {
      color: #64b5f6;
    }

    .ai-icon {
      font-size: 16px;
    }
  }

  .meal-ai-recognized-info {
    font-size: 12px;
    line-height: 1.5;
    color: #333;
    display: flex;
    flex-direction: column;
    gap: 2px;

    .dark-mode & {
      color: #e0e0e0;
    }

    .recognized-macros {
      font-weight: 600;
      color: #ff9800;
      margin-top: 2px;
    }
  }

  .meal-ai-disclaimer {
    margin: 0;
    font-size: 11px;
    line-height: 1.4;
    color: #666;
    display: flex;
    align-items: flex-start;
    gap: 4px;

    .dark-mode & {
      color: #b0b0b0;
    }
  }

  .meal-ai-quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 2px;

    .quick-action-btn {
      font-size: 12px;
    }
  }
}

.spinning {
  animation: meal-ai-spin 1s linear infinite;
}

@keyframes meal-ai-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
