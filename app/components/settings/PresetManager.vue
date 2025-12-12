<script setup lang="ts">
/**
 * プリセット管理コンポーネント
 * プリセットの一覧表示、追加、編集、削除を提供
 */
import { usePresetsStore } from '~/stores/presets'
import type { Preset } from '~/types/item'
import PresetFormModal from './PresetFormModal.vue'

const presetsStore = usePresetsStore()

// モーダルの状態
const showPresetModal = ref(false)
const editingPreset = ref<Preset | null>(null)

// プリセットをロード
onMounted(async () => {
  await presetsStore.fetchPresets()
})

/**
 * 新規プリセットモーダルを開く
 */
function openNewPresetModal() {
  editingPreset.value = null
  showPresetModal.value = true
}

/**
 * プリセット編集モーダルを開く
 */
function openEditPresetModal(preset: Preset) {
  editingPreset.value = preset
  showPresetModal.value = true
}

/**
 * モーダルを閉じる
 */
function closePresetModal() {
  showPresetModal.value = false
  editingPreset.value = null
}

/**
 * プリセットを保存（新規作成または更新）
 */
async function handleSavePreset(data: {
  title: string
  time: string
  type: 'todo' | 'expense' | 'income'
  amount: number
  notes: string
}) {
  try {
    if (editingPreset.value) {
      // 編集モード
      await presetsStore.updatePresetById(editingPreset.value.id, data)
    }
    else {
      // 新規作成モード
      await presetsStore.createPreset(data)
    }
    closePresetModal()
  }
  catch (error) {
    console.error('プリセットの保存に失敗しました:', error)
    alert('プリセットの保存に失敗しました')
  }
}

/**
 * プリセットを削除
 */
async function handleDeletePreset(preset: Preset) {
  const confirmed = confirm(`「${preset.title}」を削除しますか？`)
  if (confirmed) {
    try {
      await presetsStore.deletePresetById(preset.id)
    }
    catch (error) {
      console.error('プリセットの削除に失敗しました:', error)
      alert('プリセットの削除に失敗しました')
    }
  }
}

/**
 * アイテム種別のラベルを取得
 */
function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    todo: 'TODO',
    expense: '支出',
    income: '収入',
  }
  return labels[type] || type
}

/**
 * アイテム種別のアイコンを取得
 */
function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    todo: 'mdi:checkbox-marked-outline',
    expense: 'mdi:cart-outline',
    income: 'mdi:wallet-plus-outline',
  }
  return icons[type] || 'mdi:help-circle-outline'
}
</script>

<template>
  <div class="preset-manager">
    <div class="preset-header">
      <h2>
        <Icon name="mdi:bookmark-multiple-outline" />
        プリセット管理
      </h2>
      <UiButton
        variant="primary"
        @click="openNewPresetModal"
      >
        <Icon name="mdi:plus" />
        新規プリセット
      </UiButton>
    </div>

    <p class="section-description">
      よく使うタスクをプリセットとして保存できます。時刻とタイトルを設定して、簡単にタスクを作成しましょう。
    </p>

    <!-- プリセット一覧 -->
    <div
      v-if="presetsStore.presets.length > 0"
      class="preset-list"
    >
      <div
        v-for="preset in presetsStore.presets"
        :key="preset.id"
        class="preset-item"
      >
        <div class="preset-info">
          <div class="preset-header-row">
            <div class="preset-type-badge">
              <Icon :name="getTypeIcon(preset.type)" />
              {{ getTypeLabel(preset.type) }}
            </div>
            <div class="preset-time">
              <Icon name="mdi:clock-outline" />
              {{ preset.time }}
            </div>
          </div>
          <div class="preset-title">
            {{ preset.title }}
          </div>
          <div
            v-if="preset.amount > 0"
            class="preset-amount"
          >
            ¥{{ preset.amount.toLocaleString() }}
          </div>
          <div
            v-if="preset.notes"
            class="preset-notes"
          >
            {{ preset.notes }}
          </div>
        </div>
        <div class="preset-actions">
          <UiButton
            variant="secondary"
            @click="openEditPresetModal(preset)"
          >
            <Icon name="mdi:pencil" />
            編集
          </UiButton>
          <UiButton
            variant="danger"
            @click="handleDeletePreset(preset)"
          >
            <Icon name="mdi:delete" />
            削除
          </UiButton>
        </div>
      </div>
    </div>

    <!-- プリセットが空の場合 -->
    <div
      v-else
      class="empty-state"
    >
      <Icon
        name="mdi:bookmark-outline"
        class="empty-icon"
      />
      <p>まだプリセットがありません</p>
      <p class="empty-description">
        よく使うタスクをプリセットとして登録すると、簡単にタスクを作成できるようになります。
      </p>
    </div>

    <!-- プリセット追加/編集モーダル -->
    <PresetFormModal
      :show="showPresetModal"
      :preset="editingPreset"
      @close="closePresetModal"
      @save="handleSavePreset"
    />
  </div>
</template>

<style lang="scss" scoped>
.preset-manager {
  .preset-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;

    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      color: #666;
      margin: 0;

      // ダークモード対応
      .dark-mode & {
        color: #b0b0b0;
      }
    }

    @media (max-width: 600px) {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;

      h2 {
        font-size: 14px;
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

  .preset-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .preset-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px;
    background-color: #f9f9f9;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    transition: all 0.15s ease;

    // ダークモード対応
    .dark-mode & {
      background-color: #2a2a2a;
      border-color: #444;
    }

    &:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .preset-info {
      flex: 1;
      min-width: 0;

      .preset-header-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .preset-type-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        background-color: #e3f2fd;
        color: #1976d2;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
      }

      .preset-time {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 14px;
        color: #666;
        font-weight: 500;

        // ダークモード対応
        .dark-mode & {
          color: #b0b0b0;
        }
      }

      .preset-title {
        font-size: 16px;
        font-weight: 500;
        color: #333;
        margin-bottom: 4px;

        // ダークモード対応
        .dark-mode & {
          color: #e0e0e0;
        }
      }

      .preset-amount {
        font-size: 14px;
        color: #666;
        font-weight: 500;

        // ダークモード対応
        .dark-mode & {
          color: #b0b0b0;
        }
      }

      .preset-notes {
        font-size: 12px;
        color: #999;
        margin-top: 4px;

        // ダークモード対応
        .dark-mode & {
          color: #888;
        }
      }
    }

    .preset-actions {
      display: flex;
      gap: 8px;

      @media (max-width: 600px) {
        flex-direction: column;
      }
    }

    @media (max-width: 600px) {
      flex-direction: column;
      align-items: stretch;

      .preset-actions {
        width: 100%;
      }
    }
  }

  .empty-state {
    text-align: center;
    padding: 48px 24px;
    color: #999;

    .empty-icon {
      font-size: 64px;
      color: #ccc;
      margin-bottom: 16px;
    }

    p {
      margin: 8px 0;
      font-size: 16px;

      &.empty-description {
        font-size: 14px;
        line-height: 1.6;
      }
    }

    // ダークモード対応
    .dark-mode & {
      color: #888;

      .empty-icon {
        color: #555;
      }
    }
  }
}
</style>
