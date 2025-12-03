<script setup lang="ts">
/**
 * アイテム追加フォームコンポーネント
 * 新規アイテム（TODO、支出、収入）を作成するためのフォームを提供
 */
import { useItemsStore } from '~/stores/items'
import type { ItemType } from '~/types/item'

const props = defineProps<{
  date: string
}>()

const itemsStore = useItemsStore()

// フォームの状態
const title = ref('')
const amount = ref(0)
const type = ref<ItemType>('todo')
const time = ref('12:00')

const isSubmitting = ref(false)

/**
 * アイテム種別を選択
 */
function selectType(newType: ItemType) {
  type.value = newType
}

/**
 * フォーム送信処理
 * 入力データからアイテムを作成し、ストアに追加
 * 注：作成後、種別と時刻はリセットしない（連続入力に便利）
 */
async function handleSubmit() {
  if (!title.value.trim()) return

  isSubmitting.value = true
  try {
    const [hours, minutes] = time.value.split(':').map(Number)
    const scheduledAt = new Date(props.date)
    scheduledAt.setHours(hours, minutes, 0, 0)

    await itemsStore.createItem({
      title: title.value.trim(),
      amount: type.value === 'todo' ? 0 : amount.value,
      type: type.value,
      scheduled_at: scheduledAt,
    })

    // フォームをリセット（種別と時刻はリセットしない）
    title.value = ''
    amount.value = 0
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="item-form card">
    <h2>
      <Icon name="mdi:plus-circle-outline" />
      新規アイテム
    </h2>
    <form @submit.prevent="handleSubmit">
      <!-- 種別選択ボタン（横並び） -->
      <div class="form-group">
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

      <div class="form-group">
        <input
          id="time"
          v-model="time"
          type="time"
          class="form-control"
        >
      </div>

      <div class="form-group">
        <input
          id="title"
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
        <label for="amount">金額</label>
        <input
          id="amount"
          v-model.number="amount"
          type="number"
          class="form-control"
          min="0"
          placeholder="金額を入力"
        >
      </div>

      <button
        type="submit"
        class="btn btn-primary btn-block"
        :disabled="isSubmitting || !title.trim()"
      >
        <Icon name="mdi:plus" />
        追加
      </button>
    </form>
  </section>
</template>

<style lang="scss" scoped>
.item-form {
  h2 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 16px;
    color: #666;

    @media (max-width: 600px) {
      font-size: 14px;
      margin-bottom: 12px;
    }
  }
}

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
</style>
