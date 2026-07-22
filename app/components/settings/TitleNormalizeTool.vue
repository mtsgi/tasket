<script setup lang="ts">
/**
 * 表記揺れ修正ツールコンポーネント
 * アイテムタイトルの表記揺れを一括修正する機能を提供します（TODO・収入・支出すべて対象）。
 */
import { useItemsStore } from '~/stores/items'

const itemsStore = useItemsStore()
const { t } = useI18n()

// フォームの状態
const fromTitle = ref('')
const toTitle = ref('')

// 通知の状態
const notification = ref<{ type: 'success' | 'error', message: string } | null>(null)

// 確認ダイアログの表示状態
const showConfirmModal = ref(false)

// 処理中フラグ
const isProcessing = ref(false)

// アイテムのロード
onMounted(async () => {
  if (itemsStore.items.length === 0) {
    await itemsStore.fetchItems()
  }
})

/**
 * タイトルごとの件数マップ（fromCount・toCount の両方で使い回す）
 */
const titleCountMap = computed(() => {
  const map = new Map<string, number>()
  for (const item of itemsStore.items) {
    const title = item.title
    map.set(title, (map.get(title) ?? 0) + 1)
  }
  return map
})

/**
 * 変更前タイトルに一致するアイテム件数
 */
const fromCount = computed(() => {
  if (!fromTitle.value.trim()) return 0
  return titleCountMap.value.get(fromTitle.value.trim()) ?? 0
})

/**
 * 変更後タイトルに一致するアイテム件数
 */
const toCount = computed(() => {
  if (!toTitle.value.trim()) return 0
  return titleCountMap.value.get(toTitle.value.trim()) ?? 0
})

/**
 * 実行可能かどうか
 */
const canExecute = computed(() => {
  return fromTitle.value.trim().length > 0
    && toTitle.value.trim().length > 0
    && fromTitle.value.trim() !== toTitle.value.trim()
    && fromCount.value > 0
})

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
 * 確認ダイアログを開く
 */
function openConfirmModal() {
  showConfirmModal.value = true
}

/**
 * 確認ダイアログを閉じる
 */
function closeConfirmModal() {
  showConfirmModal.value = false
}

/**
 * 一括修正を実行
 */
async function executeRename() {
  if (!canExecute.value || isProcessing.value) return

  isProcessing.value = true
  closeConfirmModal()

  try {
    const count = await itemsStore.bulkRenameItems(fromTitle.value.trim(), toTitle.value.trim())
    showNotification('success', t('{count}件のタイトルを「{from}」から「{to}」に変更しました', {
      count,
      from: fromTitle.value.trim(),
      to: toTitle.value.trim(),
    }))
    // フォームをリセット
    fromTitle.value = ''
    toTitle.value = ''
  }
  catch (error) {
    console.error('タイトルの一括変更に失敗しました:', error)
    showNotification('error', t('タイトルの一括変更に失敗しました'))
  }
  finally {
    isProcessing.value = false
  }
}
</script>

<template>
  <div class="title-normalize-tool">
    <div class="tool-header">
      <h2>
        <Icon name="mdi:find-replace" />
        {{ $t('表記揺れ修正ツール') }}
      </h2>
    </div>

    <p class="section-description">
      {{ $t('表記揺れのあるアイテムタイトルを一括で修正できます。支出ランキングなどの集計結果のズレを防ぐために活用してください。') }}
    </p>

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

    <div class="form-row">
      <!-- 修正対象タイトル -->
      <div class="form-group">
        <label for="from-title">{{ $t('修正対象タイトル') }}</label>
        <UiAutocomplete
          id="from-title"
          v-model="fromTitle"
          :suggestions="itemsStore.allUniqueTitles"
          :placeholder="$t('変更前のタイトルを入力')"
        />
        <p
          class="count-label"
          :class="{ 'count-positive': fromCount > 0 }"
        >
          <Icon name="mdi:counter" />
          {{ $t('{count}件が対象', { count: fromCount }) }}
        </p>
      </div>

      <div class="arrow-icon">
        <Icon name="mdi:arrow-right" />
      </div>

      <!-- 修正後タイトル -->
      <div class="form-group">
        <label for="to-title">{{ $t('修正後タイトル') }}</label>
        <UiAutocomplete
          id="to-title"
          v-model="toTitle"
          :suggestions="itemsStore.allUniqueTitles"
          :placeholder="$t('変更後のタイトルを入力')"
        />
        <p class="count-label">
          <Icon name="mdi:counter" />
          {{ $t('{count}件が既存', { count: toCount }) }}
        </p>
      </div>
    </div>

    <div class="form-actions">
      <UiButton
        variant="primary"
        :disabled="!canExecute || isProcessing"
        @click="openConfirmModal"
      >
        <Icon name="mdi:find-replace" />
        {{ isProcessing ? $t('処理中...') : $t('一括修正を実行') }}
      </UiButton>
    </div>

    <!-- 確認ダイアログ -->
    <UiModal
      :show="showConfirmModal"
      :title="$t('一括修正の確認')"
      @close="closeConfirmModal"
    >
      <div class="confirm-body">
        <p>
          {{ $t('{count}件のタイトルを「{from}」→「{to}」に変更しますがよろしいですか？', {
            count: fromCount,
            from: fromTitle.trim(),
            to: toTitle.trim(),
          }) }}
        </p>
        <p class="confirm-note">
          <Icon name="mdi:information-outline" />
          {{ $t('この操作は取り消せません。') }}
        </p>
      </div>
      <template #footer>
        <UiButton
          variant="secondary"
          @click="closeConfirmModal"
        >
          {{ $t('キャンセル') }}
        </UiButton>
        <UiButton
          variant="primary"
          @click="executeRename"
        >
          <Icon name="mdi:check" />
          {{ $t('変更する') }}
        </UiButton>
      </template>
    </UiModal>
  </div>
</template>

<style lang="scss" scoped>
.title-normalize-tool {
  .tool-header {
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

  .form-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;

    @media (max-width: 600px) {
      flex-direction: column;
    }

    .form-group {
      flex: 1;
      min-width: 0;

      label {
        display: block;
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 8px;
        color: #666;

        // ダークモード対応
        .dark-mode & {
          color: #b0b0b0;
        }
      }
    }

    .arrow-icon {
      display: flex;
      align-items: center;
      padding-top: 36px;
      color: #999;
      font-size: 20px;
      flex-shrink: 0;

      @media (max-width: 600px) {
        padding-top: 0;
        transform: rotate(90deg);
        align-self: center;
      }

      // ダークモード対応
      .dark-mode & {
        color: #666;
      }
    }
  }

  .count-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #999;
    margin-top: 6px;

    &.count-positive {
      color: #4a90d9;
      font-weight: 500;
    }

    // ダークモード対応
    .dark-mode & {
      color: #888;

      &.count-positive {
        color: #6aabf7;
      }
    }
  }

  .form-actions {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }

  .notification {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    margin-bottom: 16px;

    &.success {
      background-color: #e8f5e9;
      color: #2e7d32;

      .dark-mode & {
        background-color: #1b4332;
        color: #a5d6a7;
      }
    }

    &.error {
      background-color: #ffebee;
      color: #c62828;

      .dark-mode & {
        background-color: #3e1a1a;
        color: #ef9a9a;
      }
    }
  }
}

// 通知のトランジション
.notification-enter-active,
.notification-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.notification-enter-from,
.notification-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

// 確認ダイアログのスタイル
.confirm-body {
  p {
    font-size: 15px;
    line-height: 1.6;
    color: #333;
    margin-bottom: 12px;

    // ダークモード対応
    .dark-mode & {
      color: #e0e0e0;
    }
  }

  .confirm-note {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #f57c00;

    .dark-mode & {
      color: #ffb74d;
    }
  }
}
</style>
