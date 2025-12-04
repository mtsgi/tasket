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
const notes = ref('')

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
      notes: notes.value.trim(),
    })

    // フォームをリセット（種別と時刻はリセットしない）
    title.value = ''
    amount.value = 0
    notes.value = ''
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
          <UiButton
            :variant="type === 'todo' ? 'primary' : 'secondary'"
            class="type-btn"
            :class="{ active: type === 'todo' }"
            @click="selectType('todo')"
          >
            <Icon name="mdi:checkbox-marked-outline" />
            TODO
          </UiButton>
          <UiButton
            :variant="type === 'expense' ? 'danger' : 'secondary'"
            class="type-btn type-expense"
            :class="{ active: type === 'expense' }"
            @click="selectType('expense')"
          >
            <Icon name="mdi:cart-outline" />
            支出
          </UiButton>
          <UiButton
            variant="secondary"
            class="type-btn type-income"
            :class="{ active: type === 'income' }"
            @click="selectType('income')"
          >
            <Icon name="mdi:wallet-plus-outline" />
            収入
          </UiButton>
        </div>
      </div>

      <div class="form-group">
        <UiInput
          id="time"
          v-model="time"
          type="time"
        />
      </div>

      <div class="form-group">
        <UiInput
          id="title"
          v-model="title"
          type="text"
          placeholder="アイテム名を入力"
          required
        />
      </div>

      <!-- 備考 -->
      <div class="form-group">
        <textarea
          id="notes"
          v-model="notes"
          class="form-control textarea"
          placeholder="備考（任意）"
          rows="2"
        />
      </div>

      <div
        v-if="type !== 'todo'"
        class="form-group"
      >
        <label for="amount">金額</label>
        <UiInput
          id="amount"
          v-model="amount"
          type="number"
          :min="0"
          placeholder="金額を入力"
        />
      </div>

      <UiButton
        type="submit"
        variant="primary"
        block
        :disabled="isSubmitting || !title.trim()"
      >
        <Icon name="mdi:plus" />
        追加
      </UiButton>
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
