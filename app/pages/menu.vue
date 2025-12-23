<script setup lang="ts">
/**
 * メニュー画面
 * アプリ設定、データ管理（エクスポート・インポート）、日課管理、権利表記を提供します。
 */
import { useItemsStore } from '~/stores/items'
import { useRoutinesStore } from '~/stores/routines'
import { useDayTitlesStore } from '~/stores/dayTitles'
import { getAllRoutines, getAllRoutineLogs, getAllDayTitles } from '~/utils/db'
import RoutineManager from '~/components/shared/RoutineManager.vue'

const itemsStore = useItemsStore()
const routinesStore = useRoutinesStore()
const dayTitlesStore = useDayTitlesStore()

// ファイル入力用ref
const fileInputRef = ref<HTMLInputElement | null>(null)

// インポート処理中フラグ
const isImporting = ref(false)

// 通知メッセージ
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
 * データをJSON形式でエクスポート（日課、日課ログ、日タイトルを含む）
 */
async function exportData() {
  try {
    await itemsStore.fetchItems()
    const routines = await getAllRoutines()
    const routineLogs = await getAllRoutineLogs()
    const dayTitles = await getAllDayTitles()

    const exportPayload = {
      version: 3, // バージョン3: 日タイトルデータを含む
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

    showNotification('success', 'データのエクスポートが完了しました')
  }
  catch {
    showNotification('error', 'エクスポートに失敗しました')
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
      throw new Error('無効なファイル形式です')
    }

    // 既存データを確認
    const existingCount = itemsStore.items.length
    if (existingCount > 0) {
      const confirmed = confirm(
        `現在${existingCount}件のアイテムがあります。\n`
        + `インポートすると${data.items.length}件のアイテムが追加されます。\n`
        + `続行しますか？`,
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

    // 日タイトルをインポート（バージョン3以降）
    if (data.version >= 3 && Array.isArray(data.dayTitles)) {
      for (const dayTitleData of data.dayTitles) {
        await dayTitlesStore.saveDayTitle(dayTitleData.date, dayTitleData.title)
      }
    }

    showNotification('success', `${data.items.length}件のアイテムをインポートしました`)
    await itemsStore.fetchItems()
  }
  catch (e) {
    const message = e instanceof Error ? e.message : 'インポートに失敗しました'
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
  const confirmed = confirm(
    '本当にすべてのデータを削除しますか？\n'
    + 'この操作は取り消せません。\n'
    + '事前にエクスポートすることをお勧めします。',
  )

  if (!confirmed) return

  try {
    // すべてのアイテムを削除
    const items = [...itemsStore.items]
    for (const item of items) {
      await itemsStore.deleteItemById(item.id)
    }
    showNotification('success', 'すべてのデータを削除しました')
  }
  catch {
    showNotification('error', 'データの削除に失敗しました')
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
        メニュー
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

    <!-- アプリ設定 -->
    <section class="menu-section card">
      <h2>
        <Icon name="mdi:cog" />
        アプリ設定
      </h2>
      <p class="section-description">
        ダークモード、背景画像などの表示設定を変更できます。
      </p>
      <NuxtLink to="/settings">
        <UiButton
          variant="secondary"
          block
        >
          <Icon name="mdi:cog" />
          設定を開く
        </UiButton>
      </NuxtLink>
    </section>

    <!-- 日課管理 -->
    <section class="menu-section card">
      <h2>
        <Icon name="mdi:checkbox-multiple-marked" />
        日課管理
      </h2>
      <p class="section-description">
        毎日繰り返し行う習慣やタスクを月ごとに設定できます。
      </p>
      <RoutineManager />
    </section>

    <!-- データ管理 -->
    <section class="menu-section card">
      <h2>
        <Icon name="mdi:database" />
        データ管理
      </h2>
      <p class="section-description">
        アプリのデータをJSONファイルとしてバックアップ・復元できます。
      </p>
      <div class="menu-buttons">
        <UiButton
          variant="secondary"
          block
          @click="exportData"
        >
          <Icon name="mdi:export" />
          エクスポート
        </UiButton>
        <UiButton
          variant="secondary"
          block
          :disabled="isImporting"
          @click="openImportDialog"
        >
          <Icon name="mdi:import" />
          {{ isImporting ? 'インポート中...' : 'インポート' }}
        </UiButton>
        <input
          ref="fileInputRef"
          type="file"
          accept=".json"
          style="display: none"
          @change="importData"
        >
      </div>
      <div class="danger-zone">
        <h3>
          <Icon name="mdi:alert" />
          危険な操作
        </h3>
        <UiButton
          variant="danger"
          block
          @click="clearAllData"
        >
          <Icon name="mdi:delete-forever" />
          すべてのデータを削除
        </UiButton>
      </div>
    </section>

    <!-- アプリ情報 -->
    <section class="menu-section card">
      <h2>
        <Icon name="mdi:information" />
        アプリ情報
      </h2>
      <div class="app-info">
        <div class="app-logo">
          <Icon
            name="mdi:checkbox-marked-circle-plus-outline"
            class="logo-icon"
          />
        </div>
        <h3 class="app-name">
          Tasket
        </h3>
        <p class="app-version">
          Version 1.0.0
        </p>
        <p class="app-description">
          TODO・家計簿・カレンダー統合ライフマネジメントPWAアプリケーション
        </p>
      </div>
    </section>

    <!-- 権利表記 -->
    <section class="menu-section card">
      <h2>
        <Icon name="mdi:license" />
        権利表記
      </h2>
      <div class="credits">
        <div class="credit-item">
          <h3>ライセンス</h3>
          <p>MIT License</p>
        </div>
        <div class="credit-item">
          <h3>使用技術</h3>
          <ul class="tech-list">
            <li>Nuxt 4 / Vue 3</li>
            <li>Pinia</li>
            <li>IndexedDB (idb)</li>
            <li>Chart.js</li>
            <li>Material Design Icons</li>
          </ul>
        </div>
        <div class="credit-item">
          <h3>オープンソースライセンス</h3>
          <p class="oss-description">
            このアプリケーションは多くのOSSモジュールを使用しています。
          </p>
          <NuxtLink to="/licenses">
            <UiButton
              variant="secondary"
              block
            >
              <Icon name="mdi:file-document-outline" />
              OSSライセンスを表示
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
  }
}

.section-description {
  font-size: 14px;
  color: #666;
  margin-bottom: 16px;
  line-height: 1.5;
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

  .app-logo {
    margin-bottom: 12px;
  }

  .logo-icon {
    font-size: 64px;
    color: #4a90d9;
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
  }

  .app-description {
    font-size: 14px;
    color: #666;
    line-height: 1.5;
  }
}

.credits {
  .credit-item {
    padding: 12px 0;
    border-bottom: 1px solid #f0f0f0;

    &:last-child {
      border-bottom: none;
    }

    h3 {
      font-size: 14px;
      font-weight: 600;
      color: #666;
      margin-bottom: 4px;
    }

    p {
      font-size: 14px;
      color: #333;
    }

    .oss-description {
      font-size: 14px;
      color: #666;
      margin-bottom: 12px;
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
