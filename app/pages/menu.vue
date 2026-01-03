<script setup lang="ts">
/**
 * メニュー画面
 * アプリ設定、データ管理（エクスポート・インポート）、日課管理、権利表記を提供します。
 */
import type { RoutineStatus } from '~/types/item'
import RoutineManager from '~/components/shared/RoutineManager.vue'
import PWAInstallSection from '~/components/shared/PWAInstallSection.vue'
import { loadSampleData } from '~/utils/sampleData'

const itemsStore = useItemsStore()
const routinesStore = useRoutinesStore()
const dayTitlesStore = useDayTitlesStore()
const presetsStore = usePresetsStore()
const tutorialStore = useTutorialStore()
const settingsStore = useSettingsStore()
const lockStore = useLockStore()
const { t } = useI18n()

// ファイル入力用ref
const fileInputRef = ref<HTMLInputElement | null>(null)

// インポート処理中フラグ
const isImporting = ref(false)

// サンプルデータ追加中フラグ
const isLoadingSampleData = ref(false)

// 通知メッセージ
const notification = ref<{ type: 'success' | 'error', message: string } | null>(null)

/**
 * チュートリアルを開始
 */
function openTutorial() {
  tutorialStore.startTutorial()
}

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
 * データをJSON形式でエクスポート（日課、日課ログ、日タイトル、アプリ設定を含む）
 */
async function exportData() {
  try {
    await itemsStore.fetchItems()
    const routines = await getAllRoutines()
    const routineLogs = await getAllRoutineLogs()
    const dayTitles = await getAllDayTitles()
    const appSettings = await getAllAppSettings()

    const exportPayload = {
      version: 5, // バージョン5: アプリ設定をIndexedDBに統合
      exportedAt: new Date().toISOString(),
      items: itemsStore.items.map(item => ({
        ...item,
        scheduled_at: item.scheduled_at.toISOString(),
        executed_at: item.executed_at ? item.executed_at.toISOString() : null,
        created_at: item.created_at.toISOString(),
      })),
      routines: routines.map(routine => ({
        ...routine,
        created_at: routine.created_at.toISOString(),
      })),
      routineLogs: routineLogs.map(log => ({
        ...log,
        completed_at: log.completed_at ? log.completed_at.toISOString() : null,
      })),
      dayTitles: dayTitles.map(dt => ({
        ...dt,
        created_at: dt.created_at.toISOString(),
      })),
      appSettings: appSettings.map(settings => ({
        ...settings,
        updated_at: settings.updated_at.toISOString(),
      })),
    }

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tasket-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    showNotification('success', t('データのエクスポートが完了しました'))
  }
  catch {
    showNotification('error', t('エクスポートに失敗しました'))
  }
}

/**
 * インポートファイル選択ダイアログを開く
 */
function openImportDialog() {
  fileInputRef.value?.click()
}

/**
 * JSONファイルからデータをインポート
 */
async function importData(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  isImporting.value = true

  try {
    const text = await file.text()
    const data = JSON.parse(text)

    // バリデーション
    if (!data.version || !Array.isArray(data.items)) {
      throw new Error(t('無効なファイル形式です'))
    }

    // 既存データを確認
    const existingCount = itemsStore.items.length
    if (existingCount > 0) {
      const confirmed = confirm(
        t('現在{count}件のアイテムがあります。\nインポートすると{importCount}件のアイテムが追加されます。\n続行しますか？', {
          count: existingCount,
          importCount: data.items.length,
        }),
      )
      if (!confirmed) {
        isImporting.value = false
        return
      }
    }

    // アイテムをインポート
    for (const itemData of data.items) {
      await itemsStore.createItem({
        title: itemData.title,
        amount: itemData.amount,
        type: itemData.type,
        scheduled_at: new Date(itemData.scheduled_at),
        notes: itemData.notes || '',
      })
    }

    // 日課をインポート（バージョン2以降）
    if (data.version >= 2 && Array.isArray(data.routines)) {
      for (const routineData of data.routines) {
        await routinesStore.createRoutine({
          title: routineData.title,
          yearMonth: routineData.yearMonth,
        })
      }
    }

    // 日課ログをインポート（バージョン2以降）
    if (data.version >= 2 && Array.isArray(data.routineLogs)) {
      const { saveRoutineLog } = await import('~/utils/db')
      for (const logData of data.routineLogs) {
        // 旧形式（バージョン2-3）のデータを新形式（バージョン4）に変換
        let status: RoutineStatus
        if (data.version < 4) {
          // is_completedからstatusに変換
          status = logData.is_completed ? 'achieved' : 'not_achieved'
        }
        else {
          // バージョン4以降はstatusを使用
          status = logData.status || 'unconfirmed'
        }

        await saveRoutineLog({
          id: logData.id,
          routineId: logData.routineId,
          date: logData.date,
          status,
          completed_at: logData.completed_at ? new Date(logData.completed_at) : null,
        })
      }
    }

    // 日タイトルをインポート（バージョン3以降）
    if (data.version >= 3 && Array.isArray(data.dayTitles)) {
      for (const dayTitleData of data.dayTitles) {
        await dayTitlesStore.saveDayTitle(dayTitleData.date, dayTitleData.title)
      }
    }

    // アプリ設定をインポート（バージョン5以降）
    if (data.version >= 5 && Array.isArray(data.appSettings) && data.appSettings.length > 0) {
      const { saveAppSettings } = await import('~/utils/db')
      for (const settingsData of data.appSettings) {
        await saveAppSettings({
          ...settingsData,
          updated_at: new Date(settingsData.updated_at),
        })
      }
      // 設定を再読み込み
      await settingsStore.loadSettings()
      await lockStore.loadSettings()
      await tutorialStore.loadTutorialState()
    }

    showNotification('success', t('{count}件のアイテムをインポートしました', { count: data.items.length }))
    await itemsStore.fetchItems()
  }
  catch (e) {
    const message = e instanceof Error ? e.message : t('インポートに失敗しました')
    showNotification('error', message)
  }
  finally {
    isImporting.value = false
    // ファイル入力をリセット
    if (input) input.value = ''
  }
}

/**
 * すべてのデータを削除
 */
async function clearAllData() {
  const confirmed = confirm(t('本当にすべてのデータを削除しますか？\nこの操作は取り消せません。\n事前にエクスポートすることをお勧めします。'))

  if (!confirmed) return

  try {
    // すべてのアイテムを削除
    const items = [...itemsStore.items]
    for (const item of items) {
      await itemsStore.deleteItemById(item.id)
    }
    showNotification('success', t('すべてのデータを削除しました'))
  }
  catch {
    showNotification('error', t('データの削除に失敗しました'))
  }
}

/**
 * サンプルデータを追加
 */
async function addSampleData() {
  // 既存データを確認
  const existingCount = itemsStore.items.length
  if (existingCount > 0) {
    showNotification('error', t('既にデータが存在するため、サンプルデータを追加できません'))
    return
  }

  isLoadingSampleData.value = true

  try {
    const result = await loadSampleData()

    // データを再読み込み
    await itemsStore.fetchItems()
    await presetsStore.fetchPresets()

    showNotification(
      'success',
      t('サンプルデータを追加しました（アイテム: {itemsCount}件、日課: {routinesCount}件、プリセット: {presetsCount}件）', {
        itemsCount: result.itemsCount,
        routinesCount: result.routinesCount,
        presetsCount: result.presetsCount,
      }),
    )
  }
  catch (e) {
    const message = e instanceof Error ? e.message : t('サンプルデータの追加に失敗しました')
    showNotification('error', message)
  }
  finally {
    isLoadingSampleData.value = false
  }
}

// 初期化
onMounted(() => {
  itemsStore.fetchItems()
})
</script>

<template>
  <div class="container">
    <!-- ヘッダー -->
    <header class="menu-header">
      <h1>
        <Icon name="mdi:menu" />
        {{ $t('メニュー') }}
      </h1>
    </header>

    <!-- 通知 -->
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

    <!-- チュートリアル -->
    <section class="menu-section card">
      <h2>
        <Icon name="mdi:school" />
        {{ $t('チュートリアル') }}
      </h2>
      <p class="section-description">
        {{ $t('Tasketの使い方や機能を確認できます。いつでも見直すことができます。') }}
      </p>
      <UiButton
        variant="primary"
        block
        @click="openTutorial"
      >
        <Icon name="mdi:play-circle" />
        {{ $t('チュートリアルを見る') }}
      </UiButton>
    </section>

    <!-- PWAインストール -->
    <section class="menu-section card">
      <h2>
        <Icon name="mdi:application-import" />
        {{ $t('アプリとしてインストール') }}
      </h2>
      <p class="section-description">
        {{ $t('Tasketをホーム画面に追加して、アプリのように使えます。オフラインでも動作し、起動が高速になります。') }}
      </p>
      <PWAInstallSection />
    </section>

    <!-- アプリ設定 -->
    <section class="menu-section card">
      <h2>
        <Icon name="mdi:cog" />
        {{ $t('アプリ設定') }}
      </h2>
      <p class="section-description">
        {{ $t('ダークモード、背景画像などの表示設定を変更できます。') }}
      </p>
      <NuxtLink to="/settings">
        <UiButton
          variant="secondary"
          block
        >
          <Icon name="mdi:cog" />
          {{ $t('設定を開く') }}
        </UiButton>
      </NuxtLink>
    </section>

    <!-- 日課管理 -->
    <section class="menu-section card">
      <h2>
        <Icon name="mdi:checkbox-multiple-marked" />
        {{ $t('日課管理') }}
      </h2>
      <p class="section-description">
        {{ $t('毎日繰り返し行う習慣やタスクを月ごとに設定できます。') }}
      </p>
      <RoutineManager />
    </section>

    <!-- データ管理 -->
    <section class="menu-section card">
      <h2>
        <Icon name="mdi:database" />
        {{ $t('データ管理') }}
      </h2>
      <p class="section-description">
        {{ $t('アプリのデータをJSONファイルとしてバックアップ・復元できます。') }}
      </p>
      <div class="menu-buttons">
        <UiButton
          variant="secondary"
          block
          @click="exportData"
        >
          <Icon name="mdi:export" />
          {{ $t('エクスポート') }}
        </UiButton>
        <UiButton
          variant="secondary"
          block
          :disabled="isImporting"
          @click="openImportDialog"
        >
          <Icon name="mdi:import" />
          {{ isImporting ? $t('インポート中') + '...' : $t('インポート') }}
        </UiButton>
        <input
          ref="fileInputRef"
          type="file"
          accept=".json"
          style="display: none"
          @change="importData"
        >
        <UiButton
          variant="primary"
          block
          :disabled="isLoadingSampleData || itemsStore.items.length > 0"
          @click="addSampleData"
        >
          <Icon name="mdi:lightbulb-on" />
          {{ isLoadingSampleData ? $t('サンプルデータ追加中') + '...' : $t('サンプルデータを追加') }}
        </UiButton>
      </div>
      <div class="sample-data-info">
        <Icon name="mdi:information-outline" />
        <span>
          {{ itemsStore.items.length > 0 ? $t('既にデータが存在するため、サンプルデータを追加できません') : $t('サンプルデータには、TODO・収入・支出・日課・プリセットの例が含まれます') }}
        </span>
      </div>
      <div class="danger-zone">
        <h3>
          <Icon name="mdi:alert" />
          {{ $t('危険な操作') }}
        </h3>
        <UiButton
          variant="danger"
          block
          @click="clearAllData"
        >
          <Icon name="mdi:delete-forever" />
          {{ $t('すべてのデータを削除') }}
        </UiButton>
      </div>
    </section>

    <!-- アプリ情報 -->
    <section class="menu-section card">
      <h2>
        <Icon name="mdi:information" />
        {{ $t('アプリ情報') }}
      </h2>
      <div class="app-info">
        <div class="app-logo">
          <img
            alt="Tasket"
            src="/icon_with_shadow.png"
            class="logo-icon"
          >
        </div>
        <h3 class="app-name">
          Tasket
        </h3>
        <p class="app-version">
          Version 1.0.0
        </p>
        <p class="app-description">
          {{ $t('TODO・家計簿・カレンダー統合ライフマネジメントPWAアプリケーション') }}
        </p>
      </div>
    </section>

    <!-- 権利表記 -->
    <section class="menu-section card">
      <h2>
        <Icon name="mdi:license" />
        {{ $t('権利表記') }}
      </h2>
      <div class="credits">
        <div class="credit-item">
          <h3>{{ $t('ライセンス') }}</h3>
          <p>MIT License</p>
        </div>
        <div class="credit-item">
          <h3>{{ $t('使用技術') }}</h3>
          <ul class="tech-list">
            <li>Nuxt 4 / Vue 3</li>
            <li>Pinia</li>
            <li>IndexedDB (idb)</li>
            <li>Chart.js</li>
            <li>Material Design Icons</li>
          </ul>
        </div>
        <div class="credit-item">
          <h3>{{ $t('オープンソースライセンス') }}</h3>
          <p class="oss-description">
            {{ $t('このアプリケーションは多くのOSSモジュールを使用しています。') }}
          </p>
          <NuxtLink to="/licenses">
            <UiButton
              variant="secondary"
              block
            >
              <Icon name="mdi:file-document-outline" />
              {{ $t('OSSライセンスを表示') }}
            </UiButton>
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.menu-header {
  margin-bottom: 24px;

  h1 {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 24px;
    font-weight: 600;
    text-align: center;
  }
}

.menu-section {
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

.menu-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.danger-zone {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;

  // ダークモード対応
  .dark-mode & {
    border-color: #444;
  }

  h3 {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 500;
    color: #f44336;
    margin-bottom: 12px;
  }
}

.app-info {
  text-align: center;
  padding: 16px 0;

  .logo-icon {
    width: 128px;
    height: 128px;
    object-fit: contain;
  }

  .app-name {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .app-version {
    font-size: 14px;
    color: #666;
    margin-bottom: 12px;

    // ダークモード対応
    .dark-mode & {
      color: #b0b0b0;
    }
  }

  .app-description {
    font-size: 14px;
    color: #666;
    line-height: 1.5;

    // ダークモード対応
    .dark-mode & {
      color: #b0b0b0;
    }
  }
}

.credits {
  .credit-item {
    padding: 12px 0;
    border-bottom: 1px solid #f0f0f0;

    // ダークモード対応
    .dark-mode & {
      border-color: #444;
    }

    &:last-child {
      border-bottom: none;
    }

    h3 {
      font-size: 14px;
      font-weight: 600;
      color: #666;
      margin-bottom: 4px;

      // ダークモード対応
      .dark-mode & {
        color: #b0b0b0;
      }
    }

    p {
      font-size: 14px;
      color: #333;

      // ダークモード対応
      .dark-mode & {
        color: #e0e0e0;
      }
    }

    .oss-description {
      font-size: 14px;
      color: #666;
      margin-bottom: 12px;

      // ダークモード対応
      .dark-mode & {
        color: #b0b0b0;
      }
    }
  }

  .tech-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    li {
      background-color: #f5f7fa;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      color: #666;

      // ダークモード対応
      .dark-mode & {
        background-color: #333;
        color: #b0b0b0;
      }
    }
  }
}

.notification {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;

  &.success {
    background-color: rgba(76, 175, 80, 0.1);
    color: #4caf50;
    border: 1px solid #4caf50;
  }

  &.error {
    background-color: rgba(244, 67, 54, 0.1);
    color: #f44336;
    border: 1px solid #f44336;
  }
}

.sample-data-info {
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
    border-color: rgba(74, 144, 217, 0.4);
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

@media (max-width: 600px) {
  .menu-header {
    margin-bottom: 16px;

    h1 {
      font-size: 20px;
    }
  }

  .app-info {
    .logo-icon {
      font-size: 48px;
    }

    .app-name {
      font-size: 20px;
    }
  }
}
</style>
