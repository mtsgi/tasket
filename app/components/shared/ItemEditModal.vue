<script setup lang="ts">
/**
 * アイテム編集モーダルコンポーネント
 * 既存アイテムの編集・削除機能を提供
 */
import type { Item, ItemType } from '~/types/item'
import { useItemsStore } from '~/stores/items'
import { formatDate } from '~/utils/dateHelpers'

const props = defineProps<{
  item: Item
}>()

const emit = defineEmits<{
  close: []
}>()

const itemsStore = useItemsStore()

// フォームの状態
const title = ref(props.item.title)
const amount = ref(props.item.amount)
const type = ref<ItemType>(props.item.type)
const time = ref(
  props.item.scheduled_at.toTimeString().slice(0, 5),
)
const date = ref(formatDate(props.item.scheduled_at))

// 実行時刻（任意）
const executedTime = ref(
  props.item.executed_at
    ? props.item.executed_at.toTimeString().slice(0, 5)
    : '',
)

const isSubmitting = ref(false)

/**
 * アイテム種別を選択
 */
function selectType(newType: ItemType) {
  type.value = newType
}

/**
 * フォーム送信処理
 */
async function handleSubmit() {
  if (!title.value.trim()) return

  isSubmitting.value = true
  try {
    const [hours, minutes] = time.value.split(':').map(Number)
    const scheduledAt = new Date(date.value)
    scheduledAt.setHours(hours, minutes, 0, 0)

    // 実行時刻が設定されている場合のみ変換
    let executedAt: Date | null = null
    if (executedTime.value) {
      const [execHours, execMinutes] = executedTime.value.split(':').map(Number)
      executedAt = new Date(date.value)
      executedAt.setHours(execHours, execMinutes, 0, 0)
    }

    await itemsStore.updateItemById(props.item.id, {
      title: title.value.trim(),
      amount: type.value === 'todo' ? 0 : amount.value,
      type: type.value,
      scheduled_at: scheduledAt,
      executed_at: executedAt,
    })

    emit('close')
  }
  finally {
    isSubmitting.value = false
  }
}

/**
 * アイテム削除処理
 */
async function handleDelete() {
  if (confirm('このアイテムを削除しますか？')) {
    await itemsStore.deleteItemById(props.item.id)
    emit('close')
  }
}

/**
 * 実行時刻をクリア
 */
function clearExecutedTime() {
  executedTime.value = ''
}

/**
 * オーバーレイクリック時にモーダルを閉じる
 */
function handleOverlayClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    emit('close')
  }
}
</script>

<template>
  <div
    class="modal-overlay"
    @click="handleOverlayClick"
  >
    <div class="modal">
      <header class="modal-header">
        <h2>アイテムを編集</h2>
        <button
          class="btn btn-secondary btn-icon"
          aria-label="閉じる"
          @click="emit('close')"
        >
          <Icon name="mdi:close" />
        </button>
      </header>

      <form
        class="modal-body"
        @submit.prevent="handleSubmit"
      >
        <!-- 種別選択ボタン（横並び） -->
        <div class="form-group">
          <label>種別</label>
          <div class="type-buttons">
            <button
              type="button"
              class="type-btn"
              :class="{ active: type === 'todo' }"
              @click="selectType('todo')"
            >
              <Icon name="mdi:checkbox-marked-outline" />
              TODO
            </button>
            <button
              type="button"
              class="type-btn type-expense"
              :class="{ active: type === 'expense' }"
              @click="selectType('expense')"
            >
              <Icon name="mdi:cart-outline" />
              支出
            </button>
            <button
              type="button"
              class="type-btn type-income"
              :class="{ active: type === 'income' }"
              @click="selectType('income')"
            >
              <Icon name="mdi:wallet-plus-outline" />
              収入
            </button>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="edit-date">日付</label>
            <input
              id="edit-date"
              v-model="date"
              type="date"
              class="form-control"
            >
          </div>
          <div class="form-group">
            <label for="edit-time">予定時刻</label>
            <input
              id="edit-time"
              v-model="time"
              type="time"
              class="form-control"
            >
          </div>
        </div>

        <!-- 実行時刻 -->
        <div class="form-group">
          <label for="edit-executed-time">
            実行時刻
            <span class="label-hint">（実際に行った時刻）</span>
          </label>
          <div class="time-input-with-clear">
            <input
              id="edit-executed-time"
              v-model="executedTime"
              type="time"
              class="form-control"
              placeholder="未設定"
            >
            <button
              v-if="executedTime"
              type="button"
              class="btn-clear"
              aria-label="クリア"
              @click="clearExecutedTime"
            >
              <Icon name="mdi:close-circle" />
            </button>
          </div>
        </div>

        <div class="form-group">
          <label for="edit-title">タイトル</label>
          <input
            id="edit-title"
            v-model="title"
            type="text"
            class="form-control"
            placeholder="アイテム名を入力"
            required
          >
        </div>

        <div
          v-if="type !== 'todo'"
          class="form-group"
        >
          <label for="edit-amount">金額</label>
          <input
            id="edit-amount"
            v-model.number="amount"
            type="number"
            class="form-control"
            min="0"
            placeholder="金額を入力"
          >
        </div>
      </form>

      <footer class="modal-footer">
        <button
          type="button"
          class="btn btn-danger"
          @click="handleDelete"
        >
          <Icon name="mdi:delete" />
          削除
        </button>
        <div class="spacer" />
        <button
          type="button"
          class="btn btn-secondary"
          @click="emit('close')"
        >
          キャンセル
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="isSubmitting || !title.trim()"
          @click="handleSubmit"
        >
          <Icon name="mdi:content-save" />
          保存
        </button>
      </footer>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* 種別選択ボタン */
.type-buttons {
  display: flex;
  gap: 8px;

  .type-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 10px 12px;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    background: white;
    color: #666;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      border-color: #2196f3;
      color: #2196f3;
    }

    &.active {
      border-color: #2196f3;
      background: #e3f2fd;
      color: #1976d2;
    }

    &.type-expense {
      &:hover {
        border-color: #f44336;
        color: #f44336;
      }

      &.active {
        border-color: #f44336;
        background: #ffebee;
        color: #d32f2f;
      }
    }

    &.type-income {
      &:hover {
        border-color: #4caf50;
        color: #4caf50;
      }

      &.active {
        border-color: #4caf50;
        background: #e8f5e9;
        color: #388e3c;
      }
    }
  }

  @media (max-width: 380px) {
    .type-btn {
      padding: 8px;
      font-size: 12px;
    }
  }
}

/* 実行時刻入力 */
.time-input-with-clear {
  position: relative;
  display: flex;
  align-items: center;

  .form-control {
    flex: 1;
    padding-right: 36px;
  }

  .btn-clear {
    position: absolute;
    right: 8px;
    background: none;
    border: none;
    color: #999;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;

    &:hover {
      color: #f44336;
    }
  }
}

.label-hint {
  font-size: 11px;
  color: #999;
  font-weight: normal;
}

.modal-footer {
  display: flex;
  align-items: center;
  gap: 8px;

  .spacer {
    flex: 1;
  }

  @media (max-width: 600px) {
    flex-wrap: wrap;

    .spacer {
      display: none;
    }

    .btn {
      flex: 1;
      min-width: calc(50% - 4px);

      &:first-child {
        order: 3;
        min-width: 100%;
        margin-top: 8px;
      }
    }
  }
}
</style>
