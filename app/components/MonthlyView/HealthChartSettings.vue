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
        <UiCheckbox
          v-model="localSettings.spanGaps"
          :label="$t('データの欠けた日を補完する')"
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
}
</style>
