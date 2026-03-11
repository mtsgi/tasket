<script setup lang="ts">
/**
 * バックアップ履歴アイテムコンポーネント
 * バックアップ履歴の1件分の表示を担当
 */
import type { BackupHistory } from '~/types/cloudBackup'

defineProps<{
  history: BackupHistory
}>()

const { t } = useI18n()

/**
 * 日時をフォーマット
 */
function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString()
}

/**
 * ファイルサイズをフォーマット
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <div class="history-item">
    <div class="history-icon">
      <Icon
        :name="history.status === 'success' ? 'mdi:check-circle' : history.status === 'failed' ? 'mdi:alert-circle' : 'mdi:loading'"
        :class="history.status"
      />
    </div>
    <div class="history-info">
      <div class="history-header">
        <span class="history-type">{{ t(history.type === 'manual' ? '手動' : '自動') }}</span>
        <span class="history-status">{{ t(history.status === 'success' ? '成功' : history.status === 'failed' ? '失敗' : '実行中') }}</span>
      </div>
      <div class="history-details">
        <span>{{ formatDateTime(history.created_at) }}</span>
        <span v-if="history.size !== undefined">{{ formatFileSize(history.size) }}</span>
        <span v-if="history.itemCount !== undefined">{{ history.itemCount }}{{ t('件') }}</span>
      </div>
      <div
        v-if="history.error"
        class="history-error"
      >
        {{ history.error }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.history-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: #fff;

  .dark-mode & {
    background-color: #2a2a2a;
    border-color: #444;
  }
}

.history-icon {
  font-size: 24px;

  .success {
    color: #4caf50;
  }

  .failed {
    color: #f44336;
  }

  .in-progress {
    color: #4a90d9;
  }
}

.history-info {
  flex: 1;
}

.history-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;

  .history-type,
  .history-status {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .history-type {
    background-color: #f5f5f5;
    color: #666;

    .dark-mode & {
      background-color: #333;
      color: #b0b0b0;
    }
  }
}

.history-details {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #999;
}

.history-error {
  font-size: 12px;
  color: #f44336;
  margin-top: 4px;
}
</style>
