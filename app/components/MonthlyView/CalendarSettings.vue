<script setup lang="ts">
/**
 * カレンダー表示設定コンポーネント
 * カレンダーに表示する項目をカスタマイズするための設定モーダル
 */
import { useSettingsStore } from '~/stores/settings'
import type { CalendarDisplaySettings } from '~/stores/settings'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const settingsStore = useSettingsStore()

// ローカルコピーで設定を管理
const localSettings = ref<CalendarDisplaySettings>({
  ...settingsStore.calendarDisplay,
})

// モーダルが開かれたときに最新の設定をロード
watch(() => props.show, (show) => {
  if (show) {
    localSettings.value = { ...settingsStore.calendarDisplay }
  }
})

/**
 * 設定を保存して閉じる
 */
function saveAndClose() {
  settingsStore.updateCalendarDisplay(localSettings.value)
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
    title="カレンダー表示設定"
    @close="handleClose"
  >
    <div class="calendar-settings">
      <p class="description">
        カレンダーに表示する項目を選択してください
      </p>

      <div class="settings-list">
        <UiCheckbox
          v-model="localSettings.showExpense"
          label="支出合計を表示"
        />

        <UiCheckbox
          v-model="localSettings.showIncome"
          label="収入合計を表示"
        />

        <UiCheckbox
          v-model="localSettings.showMainTask"
          label="その日のメインタスクを表示"
        />

        <UiCheckbox
          v-model="localSettings.showTaskCount"
          label="タスクの合計数を表示"
        />
      </div>
    </div>

    <template #footer>
      <UiButton
        variant="secondary"
        @click="handleClose"
      >
        キャンセル
      </UiButton>
      <UiButton
        variant="primary"
        @click="saveAndClose"
      >
        保存
      </UiButton>
    </template>
  </UiModal>
</template>

<style lang="scss" scoped>
.calendar-settings {
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
