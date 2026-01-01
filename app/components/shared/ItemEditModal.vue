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

const { t } = useI18n()
const itemsStore = useItemsStore()

// フォームの状態
const title = ref(props.item.title)
const amount = ref(props.item.amount)
const type = ref<ItemType>(props.item.type)
const time = ref(
  props.item.scheduled_at.toTimeString().slice(0, 5),
)
const date = ref(formatDate(props.item.scheduled_at))
const notes = ref(props.item.notes || '')

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
    // 入力時刻の安全なパース（未入力時は 00:00 を使用）
    const [hoursStr, minutesStr] = (time.value ? time.value.split(':') : ['00', '00'])
    const hours = Number(hoursStr ?? '0')
    const minutes = Number(minutesStr ?? '0')
    const scheduledAt = new Date(date.value)
    scheduledAt.setHours(hours, minutes, 0, 0)

    // 実行時刻が設定されている場合のみ変換
    let executedAt: Date | null = null
    if (executedTime.value) {
      const [execHoursStr, execMinutesStr] = executedTime.value.split(':')
      const execHours = Number(execHoursStr ?? '0')
      const execMinutes = Number(execMinutesStr ?? '0')
      executedAt = new Date(date.value)
      executedAt.setHours(execHours, execMinutes, 0, 0)
    }

    await itemsStore.updateItemById(props.item.id, {
      title: title.value.trim(),
      amount: type.value === 'todo' ? 0 : amount.value,
      type: type.value,
      scheduled_at: scheduledAt,
      executed_at: executedAt,
      notes: notes.value.trim(),
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
  if (confirm(t('このアイテムを削除しますか？'))) {
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
</script>

<template>
  <UiModal
    :show="true"
    :title="$t('アイテムを編集')"
    @close="emit('close')"
  >
    <form
      class="edit-form"
      @submit.prevent="handleSubmit"
    >
      <!-- 種別選択ボタン（横並び） -->
      <div class="form-group">
        <div class="type-buttons">
          <UiButton
            variant="secondary"
            class="type-btn type-todo"
            :class="{ active: type === 'todo' }"
            @click="selectType('todo')"
          >
            <Icon name="mdi:checkbox-marked-outline" />
            {{ $t('TODO') }}
          </UiButton>
          <UiButton
            variant="secondary"
            class="type-btn type-expense"
            :class="{ active: type === 'expense' }"
            @click="selectType('expense')"
          >
            <Icon name="mdi:cart-outline" />
            {{ $t('支出') }}
          </UiButton>
          <UiButton
            variant="secondary"
            class="type-btn type-income"
            :class="{ active: type === 'income' }"
            @click="selectType('income')"
          >
            <Icon name="mdi:wallet-plus-outline" />
            {{ $t('収入') }}
          </UiButton>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="edit-date">{{ $t('日付') }}</label>
          <UiInput
            id="edit-date"
            v-model="date"
            type="date"
          />
        </div>
        <div class="form-group">
          <label for="edit-time">{{ $t('予定時刻') }}</label>
          <UiInput
            id="edit-time"
            v-model="time"
            type="time"
          />
        </div>
      </div>

      <!-- 実行時刻 -->
      <div class="form-group">
        <label for="edit-executed-time">
          {{ $t('実行時刻（任意）') }}
        </label>
        <div class="time-input-with-clear">
          <UiInput
            id="edit-executed-time"
            v-model="executedTime"
            type="time"
            placeholder="未設定"
          />
          <UiButton
            v-if="executedTime"
            variant="secondary"
            icon
            class="btn-clear"
            :aria-label="$t('実行時刻をクリア')"
            @click="clearExecutedTime"
          >
            <Icon name="mdi:close-circle" />
          </UiButton>
        </div>
      </div>

      <div class="form-group">
        <label for="edit-title">{{ $t('タイトル') }}</label>
        <UiInput
          id="edit-title"
          v-model="title"
          type="text"
          :placeholder="$t('アイテム名を入力')"
          required
        />
      </div>

      <!-- 備考 -->
      <div class="form-group">
        <label for="edit-notes">{{ $t('備考') }}</label>
        <textarea
          id="edit-notes"
          v-model="notes"
          class="form-control textarea"
          :placeholder="$t('備考（任意）')"
          rows="2"
        />
      </div>

      <div class="form-group">
        <label for="edit-amount">{{ $t('金額') }}</label>
        <UiInput
          id="edit-amount"
          v-model="amount"
          type="number"
          :min="0"
          :placeholder="$t('金額を入力')"
          :disabled="type === 'todo'"
        />
      </div>
    </form>
    <template #footer>
      <UiButton
        variant="danger"
        @click="handleDelete"
      >
        <Icon name="mdi:delete" />
        {{ $t('削除') }}
      </UiButton>
      <UiButton
        variant="secondary"
        @click="emit('close')"
      >
        {{ $t('キャンセル') }}
      </UiButton>
      <UiButton
        variant="primary"
        :disabled="isSubmitting || !title.trim()"
        @click="handleSubmit"
      >
        <Icon name="mdi:content-save" />
        {{ $t('保存') }}
      </UiButton>
    </template>
  </UiModal>
</template>

<style lang="scss" scoped>
/* 種別選択ボタン */
.type-buttons {
  display: flex;
  gap: 8px;

  .type-btn {
    flex: 1;

    &.type-todo.active {
      background: #e3f2fd;
      color: #1976d2;
      border-color: #2196f3;
    }

    &.type-expense.active {
      background: #ffebee;
      color: #d32f2f;
      border-color: #f44336;
    }

    &.type-income.active {
      background: #e8f5e9;
      color: #388e3c;
      border-color: #4caf50;
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

  .btn-clear {
    position: absolute;
    right: 8px;
  }
}

.label-hint {
  font-size: 11px;
  color: #999;
  font-weight: normal;

  // ダークモード対応
  .dark-mode & {
    color: #888;
  }
}

/* 備考テキストエリア */
.textarea {
  width: 100%;
  padding: 8px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 16px;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.15s ease;

  // ダークモード対応
  .dark-mode & {
    background-color: #2a2a2a;
    border-color: #444;
    color: #e0e0e0;
  }

  &:focus {
    outline: none;
    border-color: #4a90d9;
  }

  @media (max-width: 600px) {
    min-height: 44px;
    font-size: 16px;
  }
}
</style>
