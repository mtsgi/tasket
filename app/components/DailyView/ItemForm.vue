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
 * フォーム送信処理
 * 入力データからアイテムを作成し、ストアに追加
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

    // フォームをリセット
    title.value = ''
    amount.value = 0
    type.value = 'todo'
    time.value = '12:00'
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
      <div class="form-row">
        <div class="form-group">
          <label for="type">種別</label>
          <select
            id="type"
            v-model="type"
            class="form-select"
          >
            <option value="todo">
              TODO
            </option>
            <option value="expense">
              支出
            </option>
            <option value="income">
              収入
            </option>
          </select>
        </div>
        <div class="form-group">
          <label for="time">時刻</label>
          <input
            id="time"
            v-model="time"
            type="time"
            class="form-control"
          >
        </div>
      </div>

      <div class="form-group">
        <label for="title">タイトル</label>
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
</style>
