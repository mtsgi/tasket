<script setup lang="ts">
/**
 * 健康データCSV出力コンポーネント
 * 日付範囲を指定して健康データをCSV形式でエクスポート
 */
import { useHealthDataStore } from '~/stores/healthData'
import { useSettingsStore } from '~/stores/settings'
import { convertHealthDataToCSV, downloadCSV, generateHealthDataFilename } from '~/utils/csvExport'
import dayjs from 'dayjs'
import UiButton from '~/components/ui/UiButton.vue'
import UiModal from '~/components/ui/UiModal.vue'

const healthDataStore = useHealthDataStore()
const settingsStore = useSettingsStore()
const { t } = useI18n()

// モーダル表示状態
const showModal = ref(false)

// 日付範囲の入力値
const startDate = ref('')
const endDate = ref('')

// エクスポート中フラグ
const isExporting = ref(false)

// エラーメッセージ
const errorMessage = ref('')

/**
 * モーダルを開く
 */
function openModal() {
  // デフォルト値を設定（過去30日間）
  const today = dayjs()
  endDate.value = today.format('YYYY-MM-DD')
  startDate.value = today.subtract(30, 'day').format('YYYY-MM-DD')

  errorMessage.value = ''
  showModal.value = true
}

/**
 * モーダルを閉じる
 */
function closeModal() {
  showModal.value = false
  errorMessage.value = ''
}

/**
 * CSV出力を実行
 */
async function exportToCSV() {
  errorMessage.value = ''

  // 入力値のバリデーション
  if (!startDate.value || !endDate.value) {
    errorMessage.value = t('開始日と終了日を入力してください')
    return
  }

  // 日付の妥当性チェック
  if (dayjs(startDate.value).isAfter(dayjs(endDate.value))) {
    errorMessage.value = t('開始日は終了日より前の日付を指定してください')
    return
  }

  try {
    isExporting.value = true

    // 日付範囲のデータを取得
    const dataList = await healthDataStore.fetchHealthDataByDateRange(startDate.value, endDate.value)

    // データが存在するか確認
    if (dataList.length === 0) {
      errorMessage.value = t('指定された期間にデータがありません')
      isExporting.value = false
      return
    }

    // CSV形式に変換
    const locale = settingsStore.language
    const csvContent = convertHealthDataToCSV(dataList, locale)

    // ファイル名を生成
    const filename = generateHealthDataFilename(startDate.value, endDate.value, locale)

    // CSVファイルをダウンロード
    downloadCSV(csvContent, filename)

    // 成功メッセージを表示
    // TODO: Replace alert with a toast notification system for better UX
    alert(t('{count}件の健康データをエクスポートしました', { count: dataList.length }))

    // モーダルを閉じる
    closeModal()
  }
  catch (error) {
    console.error('Failed to export health data to CSV:', error)
    errorMessage.value = t('健康データのエクスポートに失敗しました')
  }
  finally {
    isExporting.value = false
  }
}

// 外部からモーダルを開けるように公開
defineExpose({
  openModal,
})
</script>

<template>
  <div class="health-data-csv-export">
    <!-- CSV出力ボタン -->
    <UiButton
      variant="primary"
      @click="openModal"
    >
      <span class="icon">📊</span>
      <span>{{ $t('健康データをCSV出力') }}</span>
    </UiButton>

    <!-- CSV出力モーダル -->
    <UiModal
      :show="showModal"
      :title="$t('健康データのCSV出力')"
      @close="closeModal"
    >
      <div class="modal-body">
        <p class="description">
          {{ $t('日付範囲を指定してCSVファイルをダウンロード') }}
        </p>

        <div class="date-range-inputs">
          <div class="input-group">
            <label for="start-date">{{ $t('開始日') }}</label>
            <input
              id="start-date"
              v-model="startDate"
              type="date"
              class="date-input"
            >
          </div>

          <span class="date-separator">〜</span>

          <div class="input-group">
            <label for="end-date">{{ $t('終了日') }}</label>
            <input
              id="end-date"
              v-model="endDate"
              type="date"
              class="date-input"
            >
          </div>
        </div>

        <!-- エラーメッセージ -->
        <div
          v-if="errorMessage"
          class="error-message"
        >
          {{ errorMessage }}
        </div>
      </div>

      <template #footer>
        <UiButton
          variant="secondary"
          @click="closeModal"
        >
          {{ $t('キャンセル') }}
        </UiButton>
        <UiButton
          variant="primary"
          :disabled="isExporting"
          @click="exportToCSV"
        >
          {{ isExporting ? $t('エクスポート中') : $t('CSVファイルをダウンロード') }}
        </UiButton>
      </template>
    </UiModal>
  </div>
</template>

<style lang="scss" scoped>
.health-data-csv-export {
  .icon {
    font-size: 1.2rem;
  }
}

.modal-body {
  .description {
    margin: 0 0 1.5rem;
    color: var(--color-text-secondary, #666);
    font-size: 0.95rem;
  }

  .date-range-inputs {
    display: flex;
    align-items: flex-end;
    gap: 1rem;
    margin-bottom: 1rem;

    .input-group {
      flex: 1;

      label {
        display: block;
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--color-text, #333);
      }

      .date-input {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid var(--color-border, #ccc);
        border-radius: 0.5rem;
        font-size: 1rem;
        transition: border-color 0.2s;

        &:focus {
          outline: none;
          border-color: var(--color-primary, #007bff);
        }
      }
    }

    .date-separator {
      padding-bottom: 0.75rem;
      color: var(--color-text-secondary, #666);
      font-weight: 500;
    }
  }

  .error-message {
    padding: 0.75rem;
    background: #fee;
    color: #c33;
    border-radius: 0.5rem;
    font-size: 0.9rem;
    margin-top: 1rem;
  }
}

// レスポンシブ対応
@media (max-width: 600px) {
  .modal-body .date-range-inputs {
    flex-direction: column;
    align-items: stretch;

    .date-separator {
      padding-bottom: 0;
      text-align: center;
    }
  }
}
</style>
