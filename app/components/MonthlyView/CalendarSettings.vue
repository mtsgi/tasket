<script setup lang="ts">
/**
 * カレンダー表示設定コンポーネント
 * カレンダーに表示する項目をカスタマイズするための設定モーダル
 */
import { useSettingsStore } from '~/stores/settings'
import type { CalendarDisplaySettings } from '~/stores/settings'

const emit = defineEmits<{
  close: []
}>()

const settingsStore = useSettingsStore()

// ローカルコピーで設定を管理
const localSettings = ref<CalendarDisplaySettings>({
  ...settingsStore.calendarDisplay,
})

/**
 * 設定を保存して閉じる
 */
function saveAndClose() {
  settingsStore.updateCalendarDisplay(localSettings.value)
  emit('close')
}

/**
 * 設定を保存せずに閉じる
 */
function cancel() {
  emit('close')
}
</script>

<template>
  <div
    class="modal-overlay"
    @click.self="cancel"
  >
    <div class="modal-content card">
      <header class="modal-header">
        <h2>カレンダー表示設定</h2>
        <button
          class="btn btn-secondary btn-icon"
          aria-label="閉じる"
          @click="cancel"
        >
          <Icon name="mdi:close" />
        </button>
      </header>

      <div class="modal-body">
        <p class="description">
          カレンダーに表示する項目を選択してください
        </p>

        <div class="settings-list">
          <label class="setting-item">
            <input
              v-model="localSettings.showExpense"
              type="checkbox"
            >
            <span>支出合計を表示</span>
          </label>

          <label class="setting-item">
            <input
              v-model="localSettings.showIncome"
              type="checkbox"
            >
            <span>収入合計を表示</span>
          </label>

          <label class="setting-item">
            <input
              v-model="localSettings.showMainTask"
              type="checkbox"
            >
            <span>その日のメインタスクを表示</span>
          </label>

          <label class="setting-item">
            <input
              v-model="localSettings.showTaskCount"
              type="checkbox"
            >
            <span>タスクの合計数を表示</span>
          </label>
        </div>
      </div>

      <footer class="modal-footer">
        <button
          class="btn btn-secondary"
          @click="cancel"
        >
          キャンセル
        </button>
        <button
          class="btn btn-primary"
          @click="saveAndClose"
        >
          保存
        </button>
      </footer>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-content {
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;

  h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }
}

.modal-body {
  padding: 20px;
  flex: 1;
}

.description {
  margin: 0 0 20px;
  font-size: 14px;
  color: #666;
}

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
  padding: 12px;
  border-radius: 8px;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: #f5f7fa;
  }

  input[type="checkbox"] {
    width: 20px;
    height: 20px;
    cursor: pointer;
    accent-color: #4a90d9;
  }

  span {
    font-size: 15px;
    color: #333;
  }
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid #e0e0e0;
}

@media (max-width: 600px) {
  .modal-content {
    max-height: 100vh;
    height: 100%;
    border-radius: 0;
  }

  .modal-header h2 {
    font-size: 16px;
  }

  .setting-item {
    padding: 10px;

    span {
      font-size: 14px;
    }
  }
}
</style>
