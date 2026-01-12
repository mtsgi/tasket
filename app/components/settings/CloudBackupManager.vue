<script setup lang="ts">
/**
 * クラウドバックアップ管理コンポーネント
 * クラウドストレージへのバックアップ・復元を管理
 */
import { useCloudBackupStore } from '~/stores/cloudBackup'
import type { CloudBackupConfig, CloudProvider } from '~/types/cloudBackup'
import ProviderSetupManual from './ProviderSetupManual.vue'

const cloudBackupStore = useCloudBackupStore()
const { t } = useI18n()

// モーダル状態
const showConfigModal = ref(false)
const showRestoreModal = ref(false)
const showManualModal = ref(false)

// フォーム状態
const editingConfig = ref<CloudBackupConfig | null>(null)
const isTestingConnection = ref(false)
const isBackingUp = ref(false)
const isRestoring = ref(false)

// フォームデータ
const formData = ref({
  name: '',
  provider: 's3-compatible' as CloudProvider,
  endpoint: '',
  region: '',
  bucket: '',
  accessKeyId: '',
  secretAccessKey: '',
  isEnabled: true,
  autoBackup: false,
  autoBackupInterval: 24,
})

// バックアップファイル一覧
const backupFiles = ref<Array<{ path: string, size: number, lastModified: Date }>>([])
const selectedBackupFile = ref<string | null>(null)
const selectedConfigId = ref<string | null>(null)

// 通知
const notification = ref<{ type: 'success' | 'error', message: string } | null>(null)

/**
 * 通知を表示
 */
function showNotification(type: 'success' | 'error', message: string) {
  notification.value = { type, message }
  setTimeout(() => {
    notification.value = null
  }, 3000)
}

/**
 * 設定モーダルを開く
 */
function openConfigModal(config?: CloudBackupConfig) {
  if (config) {
    editingConfig.value = config
    formData.value = {
      name: config.name,
      provider: config.provider,
      endpoint: config.endpoint || '',
      region: config.region || '',
      bucket: config.bucket || '',
      accessKeyId: '',
      secretAccessKey: '',
      isEnabled: config.isEnabled,
      autoBackup: config.autoBackup,
      autoBackupInterval: config.autoBackupInterval || 24,
    }
  }
  else {
    editingConfig.value = null
    formData.value = {
      name: '',
      provider: 's3-compatible',
      endpoint: '',
      region: '',
      bucket: '',
      accessKeyId: '',
      secretAccessKey: '',
      isEnabled: true,
      autoBackup: false,
      autoBackupInterval: 24,
    }
  }
  showConfigModal.value = true
}

/**
 * 設定モーダルを閉じる
 */
function closeConfigModal() {
  showConfigModal.value = false
  editingConfig.value = null
}

/**
 * 設定を保存
 */
async function saveConfig() {
  try {
    if (editingConfig.value) {
      // 更新
      await cloudBackupStore.updateConfig(editingConfig.value.id, {
        name: formData.value.name,
        endpoint: formData.value.endpoint,
        region: formData.value.region,
        bucket: formData.value.bucket,
        accessKeyId: formData.value.accessKeyId || undefined,
        secretAccessKey: formData.value.secretAccessKey || undefined,
        isEnabled: formData.value.isEnabled,
        autoBackup: formData.value.autoBackup,
        autoBackupInterval: formData.value.autoBackupInterval,
      })
    }
    else {
      // 新規作成
      await cloudBackupStore.createConfig(formData.value)
    }

    showNotification('success', t('バックアップ設定が保存されました'))
    closeConfigModal()
  }
  catch {
    showNotification('error', t('バックアップ設定の保存に失敗しました'))
  }
}

/**
 * 設定を削除
 */
async function deleteConfig(id: string) {
  const confirmed = confirm(t('本当にこの設定を削除しますか？'))
  if (!confirmed) return

  try {
    await cloudBackupStore.deleteConfig(id)
    showNotification('success', t('バックアップ設定が削除されました'))
  }
  catch {
    showNotification('error', t('バックアップ設定の削除に失敗しました'))
  }
}

/**
 * 接続テスト
 */
async function testConnection() {
  if (!editingConfig.value) {
    // 新規作成時は一時的に設定を作成してテスト
    try {
      isTestingConnection.value = true
      const tempConfig = await cloudBackupStore.createConfig(formData.value)
      const result = await cloudBackupStore.testConnection(tempConfig.id)

      if (result) {
        showNotification('success', t('接続テストに成功しました'))
      }
      else {
        showNotification('error', t('接続テストに失敗しました'))
        await cloudBackupStore.deleteConfig(tempConfig.id)
      }
    }
    catch {
      showNotification('error', t('接続テストに失敗しました'))
    }
    finally {
      isTestingConnection.value = false
    }
  }
  else {
    // 既存の設定をテスト
    try {
      isTestingConnection.value = true
      const result = await cloudBackupStore.testConnection(editingConfig.value.id)

      if (result) {
        showNotification('success', t('接続テストに成功しました'))
      }
      else {
        showNotification('error', t('接続テストに失敗しました'))
      }
    }
    catch {
      showNotification('error', t('接続テストに失敗しました'))
    }
    finally {
      isTestingConnection.value = false
    }
  }
}

/**
 * バックアップを実行
 */
async function runBackup(configId: string) {
  try {
    isBackingUp.value = true
    await cloudBackupStore.backup(configId, 'manual')
    showNotification('success', t('バックアップに成功しました'))
  }
  catch {
    showNotification('error', t('バックアップに失敗しました'))
  }
  finally {
    isBackingUp.value = false
  }
}

/**
 * 復元モーダルを開く
 */
async function openRestoreModal(configId: string) {
  try {
    backupFiles.value = await cloudBackupStore.listBackupFiles(configId)
    selectedBackupFile.value = null
    selectedConfigId.value = configId
    showRestoreModal.value = true
  }
  catch {
    showNotification('error', t('バックアップファイルの取得に失敗しました'))
  }
}

/**
 * バックアップから復元
 */
async function restore() {
  if (!selectedConfigId.value) {
    showNotification('error', t('設定を選択してください'))
    return
  }

  if (!selectedBackupFile.value) {
    showNotification('error', t('バックアップファイルを選択してください'))
    return
  }

  const confirmed = confirm(t('本当にこのバックアップから復元しますか？'))
  if (!confirmed) return

  try {
    isRestoring.value = true
    await cloudBackupStore.restore(selectedConfigId.value, selectedBackupFile.value)
    showNotification('success', t('復元に成功しました'))
    showRestoreModal.value = false
  }
  catch {
    showNotification('error', t('復元に失敗しました'))
  }
  finally {
    isRestoring.value = false
  }
}

/**
 * ファイルサイズをフォーマット
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * 日時をフォーマット
 */
function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString()
}

/**
 * プロバイダー名を取得
 */
function getProviderDisplayName(provider: CloudProvider): string {
  const names: Record<CloudProvider, string> = {
    's3-compatible': t('S3互換'),
    'webdav': t('WebDAV'),
    'dropbox': t('Dropbox'),
    'azure-blob': t('Azure Blob Storage'),
    'custom': t('カスタム'),
  }
  return names[provider] || t('カスタム')
}

/**
 * セットアップマニュアルを表示
 */
function openManual() {
  showManualModal.value = true
}

/**
 * セットアップマニュアルを閉じる
 */
function closeManual() {
  showManualModal.value = false
}

// 初期化
onMounted(() => {
  cloudBackupStore.fetchConfigs()
  cloudBackupStore.fetchHistories()
})
</script>

<template>
  <!-- 通知（モーダルの上に表示するためTeleportを使用） -->
  <Teleport to="body">
    <Transition name="notification">
      <div
        v-if="notification"
        class="notification"
        :class="notification.type"
      >
        <Icon :name="notification.type === 'success' ? 'mdi:check-circle' : 'mdi:alert-circle'" />
        {{ notification.message }}
      </div>
    </Transition>
  </Teleport>

  <div class="cloud-backup">
    <!-- 設定一覧 -->
    <div class="configs-section">
      <div class="section-header">
        <h3>
          <Icon name="mdi:cog" />
          {{ $t('バックアップ設定') }}
        </h3>
        <UiButton
          variant="primary"
          size="small"
          @click="openConfigModal()"
        >
          <Icon name="mdi:plus" />
          {{ $t('追加') }}
        </UiButton>
      </div>

      <div
        v-if="cloudBackupStore.configs.length === 0"
        class="empty-state"
      >
        <Icon name="mdi:cloud-off-outline" />
        <p>{{ $t('設定がありません') }}</p>
        <p class="empty-state-description">
          {{ $t('クラウドバックアップを使用するには、まず設定を追加してください') }}
        </p>
      </div>

      <div
        v-else
        class="configs-list"
      >
        <div
          v-for="config in cloudBackupStore.configs"
          :key="config.id"
          class="config-card"
        >
          <div class="config-header">
            <div class="config-info">
              <h4>{{ config.name }}</h4>
              <span class="config-provider">
                {{ getProviderDisplayName(config.provider) }}
              </span>
            </div>
            <div class="config-status">
              <span
                class="status-badge"
                :class="config.isEnabled ? 'enabled' : 'disabled'"
              >
                {{ config.isEnabled ? $t('有効') : $t('無効') }}
              </span>
            </div>
          </div>

          <div class="config-details">
            <div
              v-if="config.last_backup_at"
              class="config-detail"
            >
              <Icon name="mdi:clock-outline" />
              <span>{{ $t('最終バックアップ') }}: {{ formatDateTime(config.last_backup_at) }}</span>
            </div>
            <div class="config-detail">
              <Icon name="mdi:server" />
              <span>{{ config.bucket }}</span>
            </div>
          </div>

          <div class="config-actions">
            <UiButton
              variant="primary"
              size="small"
              :disabled="isBackingUp || !config.isEnabled"
              @click="runBackup(config.id)"
            >
              <Icon name="mdi:cloud-upload" />
              {{ isBackingUp ? $t('バックアップ中') + '...' : $t('バックアップを実行') }}
            </UiButton>
            <UiButton
              variant="secondary"
              size="small"
              :disabled="!config.isEnabled"
              @click="openRestoreModal(config.id)"
            >
              <Icon name="mdi:cloud-download" />
              {{ $t('バックアップから復元') }}
            </UiButton>
            <UiButton
              variant="secondary"
              size="small"
              @click="openConfigModal(config)"
            >
              <Icon name="mdi:pencil" />
              {{ $t('編集') }}
            </UiButton>
            <UiButton
              variant="danger"
              size="small"
              @click="deleteConfig(config.id)"
            >
              <Icon name="mdi:delete" />
              {{ $t('削除') }}
            </UiButton>
          </div>
        </div>
      </div>
    </div>

    <!-- バックアップ履歴 -->
    <div class="history-section">
      <div class="section-header">
        <h3>
          <Icon name="mdi:history" />
          {{ $t('バックアップ履歴') }}
        </h3>
      </div>

      <div
        v-if="cloudBackupStore.histories.length === 0"
        class="empty-state"
      >
        <p>{{ $t('バックアップ履歴はありません') }}</p>
      </div>

      <div
        v-else
        class="history-list"
      >
        <div
          v-for="history in cloudBackupStore.histories.slice(0, 5)"
          :key="history.id"
          class="history-item"
        >
          <div class="history-icon">
            <Icon
              :name="history.status === 'success' ? 'mdi:check-circle' : history.status === 'failed' ? 'mdi:alert-circle' : 'mdi:loading'"
              :class="history.status"
            />
          </div>
          <div class="history-info">
            <div class="history-header">
              <span class="history-type">{{ $t(history.type === 'manual' ? '手動' : '自動') }}</span>
              <span class="history-status">{{ $t(history.status === 'success' ? '成功' : history.status === 'failed' ? '失敗' : '実行中') }}</span>
            </div>
            <div class="history-details">
              <span>{{ formatDateTime(history.created_at) }}</span>
              <span v-if="history.size">{{ formatFileSize(history.size) }}</span>
              <span v-if="history.itemCount">{{ history.itemCount }}件</span>
            </div>
            <div
              v-if="history.error"
              class="history-error"
            >
              {{ history.error }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 設定モーダル -->
    <UiModal
      :show="showConfigModal"
      :title="editingConfig ? $t('バックアップ設定を編集') : $t('バックアップ設定を追加')"
      @close="closeConfigModal"
    >
      <div class="config-form">
        <div class="form-group">
          <label>{{ $t('設定名') }}</label>
          <input
            v-model="formData.name"
            type="text"
            :placeholder="$t('例: my-tasket-backup')"
          >
        </div>

        <div class="form-group">
          <label>{{ $t('プロバイダー') }}</label>
          <select v-model="formData.provider">
            <option value="s3-compatible">
              {{ $t('S3互換') }}
            </option>
            <option value="webdav">
              {{ $t('WebDAV') }}
            </option>
            <option value="dropbox">
              {{ $t('Dropbox') }}
            </option>
            <option value="azure-blob">
              {{ $t('Azure Blob Storage') }}
            </option>
          </select>
          <p class="form-help">
            <template v-if="formData.provider === 's3-compatible'">
              {{ $t('AWS S3、MinIO、Wasabi、Cloudflare R2などのS3互換APIをサポート') }}
            </template>
            <template v-else-if="formData.provider === 'webdav'">
              {{ $t('Nextcloud、ownCloud、Boxなどに対応') }}
            </template>
            <template v-else-if="formData.provider === 'dropbox'">
              {{ $t('Dropboxを使用したクラウドバックアップ') }}
            </template>
            <template v-else-if="formData.provider === 'azure-blob'">
              {{ $t('Azure Blob Storageを使用したクラウドバックアップ') }}
            </template>
          </p>
          <UiButton
            variant="secondary"
            size="small"
            style="margin-top: 8px;"
            @click="openManual"
          >
            <Icon name="mdi:book-open-variant" />
            {{ $t('セットアップマニュアルを表示') }}
          </UiButton>
        </div>

        <!-- S3互換の設定 -->
        <template v-if="formData.provider === 's3-compatible'">
          <div class="form-group">
            <label>{{ $t('エンドポイント') }}</label>
            <input
              v-model="formData.endpoint"
              type="text"
              :placeholder="$t('例: https://s3.amazonaws.com')"
            >
          </div>

          <div class="form-group">
            <label>{{ $t('リージョン') }}</label>
            <input
              v-model="formData.region"
              type="text"
              :placeholder="$t('例: us-east-1')"
            >
          </div>

          <div class="form-group">
            <label>{{ $t('バケット名') }}</label>
            <input
              v-model="formData.bucket"
              type="text"
              :placeholder="$t('例: my-tasket-backup')"
            >
          </div>

          <div class="form-group">
            <label>{{ $t('アクセスキーID') }}</label>
            <input
              v-model="formData.accessKeyId"
              type="text"
              :placeholder="editingConfig ? '(変更する場合のみ入力)' : ''"
            >
          </div>

          <div class="form-group">
            <label>{{ $t('シークレットアクセスキー') }}</label>
            <input
              v-model="formData.secretAccessKey"
              type="password"
              :placeholder="editingConfig ? '(変更する場合のみ入力)' : ''"
            >
            <p class="form-help">
              {{ $t('認証情報は安全に暗号化されて保存されます') }}
            </p>
          </div>
        </template>

        <!-- WebDAVの設定 -->
        <template v-else-if="formData.provider === 'webdav'">
          <div class="form-group">
            <label>{{ $t('WebDAV URL') }}</label>
            <input
              v-model="formData.endpoint"
              type="text"
              :placeholder="$t('例: https://cloud.example.com/remote.php/dav/files/username')"
            >
          </div>

          <div class="form-group">
            <label>{{ $t('ユーザー名') }}</label>
            <input
              v-model="formData.accessKeyId"
              type="text"
              :placeholder="editingConfig ? '(変更する場合のみ入力)' : ''"
            >
          </div>

          <div class="form-group">
            <label>{{ $t('パスワード') }}</label>
            <input
              v-model="formData.secretAccessKey"
              type="password"
              :placeholder="editingConfig ? '(変更する場合のみ入力)' : ''"
            >
            <p class="form-help">
              {{ $t('認証情報は安全に暗号化されて保存されます') }}
            </p>
          </div>
        </template>

        <!-- Dropboxの設定 -->
        <template v-else-if="formData.provider === 'dropbox'">
          <div class="form-group">
            <label>{{ $t('アクセストークン') }}</label>
            <input
              v-model="formData.accessKeyId"
              type="password"
              :placeholder="editingConfig ? '(変更する場合のみ入力)' : ''"
            >
            <p class="form-help">
              {{ $t('認証情報は安全に暗号化されて保存されます') }}
            </p>
          </div>
        </template>

        <!-- Azure Blob Storageの設定 -->
        <template v-else-if="formData.provider === 'azure-blob'">
          <div class="form-group">
            <label>{{ $t('ストレージアカウント名') }}</label>
            <input
              v-model="formData.accessKeyId"
              type="text"
              :placeholder="editingConfig ? '(変更する場合のみ入力)' : ''"
            >
          </div>

          <div class="form-group">
            <label>{{ $t('SASトークン') }}</label>
            <input
              v-model="formData.secretAccessKey"
              type="password"
              :placeholder="editingConfig ? '(変更する場合のみ入力)' : ''"
            >
          </div>

          <div class="form-group">
            <label>{{ $t('コンテナ名') }}</label>
            <input
              v-model="formData.bucket"
              type="text"
              placeholder="tasket-backups"
            >
            <p class="form-help">
              {{ $t('認証情報は安全に暗号化されて保存されます') }}
            </p>
          </div>
        </template>

        <div class="form-group">
          <label class="checkbox-label">
            <input
              v-model="formData.isEnabled"
              type="checkbox"
            >
            {{ $t('この設定を有効にする') }}
          </label>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input
              v-model="formData.autoBackup"
              type="checkbox"
            >
            {{ $t('自動バックアップを有効にする') }}
          </label>
        </div>

        <div
          v-if="formData.autoBackup"
          class="form-group"
        >
          <label>{{ $t('自動バックアップ間隔（時間）') }}</label>
          <input
            v-model.number="formData.autoBackupInterval"
            type="number"
            min="1"
            max="168"
          >
        </div>

        <div class="form-actions">
          <UiButton
            variant="secondary"
            :disabled="isTestingConnection"
            @click="testConnection"
          >
            <Icon name="mdi:lan-connect" />
            {{ isTestingConnection ? $t('接続テスト中') + '...' : $t('接続テスト') }}
          </UiButton>
          <UiButton
            variant="primary"
            @click="saveConfig"
          >
            <Icon name="mdi:content-save" />
            {{ $t('保存') }}
          </UiButton>
        </div>
      </div>
    </UiModal>

    <!-- 復元モーダル -->
    <UiModal
      :show="showRestoreModal"
      :title="$t('バックアップから復元')"
      @close="showRestoreModal = false"
    >
      <div class="restore-modal">
        <p class="restore-description">
          {{ $t('バックアップファイルを選択して復元してください') }}
        </p>

        <div
          v-if="backupFiles.length === 0"
          class="empty-state"
        >
          <Icon name="mdi:file-document-outline" />
          <p>{{ $t('バックアップファイルがありません') }}</p>
        </div>

        <div
          v-else
          class="backup-files-list"
        >
          <div
            v-for="file in backupFiles"
            :key="file.path"
            class="backup-file-item"
            :class="{ selected: selectedBackupFile === file.path }"
            @click="selectedBackupFile = file.path"
          >
            <div class="file-icon">
              <Icon name="mdi:file-document" />
            </div>
            <div class="file-info">
              <div class="file-name">
                {{ file.path.split('/').pop() }}
              </div>
              <div class="file-details">
                <span>{{ formatDateTime(file.lastModified) }}</span>
                <span>{{ formatFileSize(file.size) }}</span>
              </div>
            </div>
            <div
              v-if="selectedBackupFile === file.path"
              class="file-selected"
            >
              <Icon name="mdi:check-circle" />
            </div>
          </div>
        </div>

        <div class="restore-actions">
          <UiButton
            variant="primary"
            :disabled="!selectedBackupFile || isRestoring || !selectedConfigId"
            @click="restore"
          >
            <Icon name="mdi:restore" />
            {{ isRestoring ? $t('復元中') + '...' : $t('復元') }}
          </UiButton>
        </div>
      </div>
    </UiModal>

    <!-- セットアップマニュアルモーダル -->
    <UiModal
      :show="showManualModal"
      :title="$t('セットアップマニュアル')"
      @close="closeManual"
    >
      <ProviderSetupManual :provider="formData.provider" />
    </UiModal>
  </div>
</template>

<style lang="scss" scoped>
.cloud-backup {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 1100; // モーダル(z-index: 1000)より上に表示
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-width: 400px;

  &.success {
    background-color: rgba(76, 175, 80, 0.95);
    color: #fff;
    border: 1px solid #4caf50;
  }

  &.error {
    background-color: rgba(244, 67, 54, 0.95);
    color: #fff;
    border: 1px solid #f44336;
  }

  @media (max-width: 600px) {
    top: 10px;
    right: 10px;
    left: 10px;
    max-width: none;
  }
}

.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from,
.notification-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;

  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: #666;

    .dark-mode & {
      color: #b0b0b0;
    }
  }
}

.empty-state {
  text-align: center;
  padding: 32px 16px;
  color: #999;

  .dark-mode & {
    color: #666;
  }

  svg {
    font-size: 48px;
    margin-bottom: 12px;
  }

  p {
    margin: 4px 0;
  }

  .empty-state-description {
    font-size: 14px;
    color: #666;

    .dark-mode & {
      color: #888;
    }
  }
}

.configs-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.config-card {
  padding: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: #fff;

  .dark-mode & {
    background-color: #2a2a2a;
    border-color: #444;
  }
}

.config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;

  h4 {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 4px 0;

    .dark-mode & {
      color: #e0e0e0;
    }
  }
}

.config-provider {
  font-size: 12px;
  color: #666;
  padding: 2px 8px;
  background-color: #f5f5f5;
  border-radius: 4px;

  .dark-mode & {
    background-color: #333;
    color: #b0b0b0;
  }
}

.status-badge {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;

  &.enabled {
    background-color: rgba(76, 175, 80, 0.1);
    color: #4caf50;
  }

  &.disabled {
    background-color: rgba(158, 158, 158, 0.1);
    color: #999;
  }
}

.config-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.config-detail {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #666;

  .dark-mode & {
    color: #b0b0b0;
  }
}

.config-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

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

.config-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 14px;
    font-weight: 500;
    color: #666;

    .dark-mode & {
      color: #b0b0b0;
    }
  }

  input,
  select {
    padding: 8px 12px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    font-size: 14px;

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

  .form-help {
    font-size: 12px;
    color: #999;
    margin: 0;
  }
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;

  input[type="checkbox"] {
    cursor: pointer;
  }
}

.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;

  .dark-mode & {
    border-color: #444;
  }
}

.restore-modal {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.restore-description {
  font-size: 14px;
  color: #666;

  .dark-mode & {
    color: #b0b0b0;
  }
}

.backup-files-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.backup-file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #4a90d9;
    background-color: rgba(74, 144, 217, 0.05);
  }

  &.selected {
    border-color: #4a90d9;
    background-color: rgba(74, 144, 217, 0.1);
  }

  .dark-mode & {
    border-color: #444;

    &:hover {
      background-color: rgba(74, 144, 217, 0.1);
    }

    &.selected {
      background-color: rgba(74, 144, 217, 0.15);
    }
  }
}

.file-icon {
  font-size: 24px;
  color: #666;

  .dark-mode & {
    color: #b0b0b0;
  }
}

.file-info {
  flex: 1;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;

  .dark-mode & {
    color: #e0e0e0;
  }
}

.file-details {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #999;
}

.file-selected {
  font-size: 24px;
  color: #4a90d9;
}

.restore-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;

  .dark-mode & {
    border-color: #444;
  }
}

@media (max-width: 600px) {
  .config-actions {
    flex-direction: column;

    button {
      width: 100%;
    }
  }
}
</style>
