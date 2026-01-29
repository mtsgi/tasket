<script setup lang="ts">
/**
 * 健康データグラフ表示設定コンポーネント
 * グラフの表示オプションをカスタマイズするための設定モーダル
 */
import { useSettingsStore } from '~/stores/settings'
import type { HealthGraphSettings } from '~/stores/settings'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const settingsStore = useSettingsStore()

// ローカルコピーで設定を管理
const localSettings = ref<HealthGraphSettings>({
  ...settingsStore.healthGraphSettings,
})

// モーダルが開かれたときに最新の設定をロード
watch(() => props.show, (show) => {
  if (show) {
    localSettings.value = { ...settingsStore.healthGraphSettings }
  }
})

/**
 * 設定を保存して閉じる
 */
function saveAndClose() {
  settingsStore.updateHealthGraphSettings(localSettings.value)
  emit('close')
}

/**
 * モーダルを閉じる
 */
function handleClose() {
  emit('close')
}
</script>

<template>
  <UiModal
    :show="show"
    :title="$t('グラフ表示設定')"
    @close="handleClose"
  >
    <div class="health-chart-settings">
      <p class="description">
        {{ $t('健康データグラフの表示オプションを設定してください') }}
      </p>

      <div class="settings-list">
        <!-- データ補完設定 -->
        <UiCheckbox
          v-model="localSettings.spanGaps"
          :label="$t('データの欠けた日を補完する')"
        />

        <!-- グラフの高さ -->
        <div class="setting-item">
          <label class="setting-label">{{ $t('グラフの高さ') }}</label>
          <UiSelect v-model="localSettings.chartHeight">
            <option value="small">
              {{ $t('小') }}
            </option>
            <option value="medium">
              {{ $t('中') }}
            </option>
            <option value="large">
              {{ $t('大') }}
            </option>
          </UiSelect>
        </div>

        <!-- グリッド線表示 -->
        <UiCheckbox
          v-model="localSettings.showGridLines"
          :label="$t('グリッド線を表示')"
        />

        <!-- 折れ線の形状 -->
        <div class="setting-item">
          <label class="setting-label">{{ $t('折れ線の形状') }}</label>
          <UiSelect v-model="localSettings.lineTension">
            <option value="straight">
              {{ $t('直線') }}
            </option>
            <option value="smooth">
              {{ $t('なめらか') }}
            </option>
          </UiSelect>
        </div>

        <!-- データポイントのサイズ -->
        <div class="setting-item">
          <label class="setting-label">{{ $t('データポイントのサイズ') }}</label>
          <UiSelect v-model="localSettings.pointRadius">
            <option value="small">
              {{ $t('小') }}
            </option>
            <option value="medium">
              {{ $t('中') }}
            </option>
            <option value="large">
              {{ $t('大') }}
            </option>
          </UiSelect>
        </div>

        <!-- グラフエリアの塗りつぶし -->
        <UiCheckbox
          v-model="localSettings.fillArea"
          :label="$t('グラフエリアを塗りつぶす')"
        />
      </div>
    </div>

    <template #footer>
      <UiButton
        variant="secondary"
        @click="handleClose"
      >
        {{ $t('キャンセル') }}
      </UiButton>
      <UiButton
        variant="primary"
        @click="saveAndClose"
      >
        {{ $t('保存') }}
      </UiButton>
    </template>
  </UiModal>
</template>

<style lang="scss" scoped>
.health-chart-settings {
  .description {
    margin: 0 0 20px;
    font-size: 14px;
    color: #666;

    // ダークモード対応
    .dark-mode & {
      color: #b0b0b0;
    }
  }

  .settings-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .setting-item {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .setting-label {
      font-size: 14px;
      font-weight: 500;
      color: #333;

      .dark-mode & {
        color: #e0e0e0;
      }
    }
  }
}
</style>
