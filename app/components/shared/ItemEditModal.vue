<script setup lang="ts">
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

const title = ref(props.item.title)
const amount = ref(props.item.amount)
const type = ref<ItemType>(props.item.type)
const time = ref(
  props.item.scheduled_at.toTimeString().slice(0, 5),
)
const date = ref(formatDate(props.item.scheduled_at))

const isSubmitting = ref(false)

async function handleSubmit() {
  if (!title.value.trim()) return

  isSubmitting.value = true
  try {
    const [hours, minutes] = time.value.split(':').map(Number)
    const scheduledAt = new Date(date.value)
    scheduledAt.setHours(hours, minutes, 0, 0)

    await itemsStore.updateItemById(props.item.id, {
      title: title.value.trim(),
      amount: type.value === 'todo' ? 0 : amount.value,
      type: type.value,
      scheduled_at: scheduledAt,
    })

    emit('close')
  }
  finally {
    isSubmitting.value = false
  }
}

async function handleDelete() {
  if (confirm('このアイテムを削除しますか？')) {
    await itemsStore.deleteItemById(props.item.id)
    emit('close')
  }
}

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
          @click="emit('close')"
        >
          ✕
        </button>
      </header>

      <form
        class="modal-body"
        @submit.prevent="handleSubmit"
      >
        <div class="form-row">
          <div class="form-group">
            <label for="edit-type">種別</label>
            <select
              id="edit-type"
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
            <label for="edit-date">日付</label>
            <input
              id="edit-date"
              v-model="date"
              type="date"
              class="form-control"
            >
          </div>
        </div>

        <div class="form-group">
          <label for="edit-time">時刻</label>
          <input
            id="edit-time"
            v-model="time"
            type="time"
            class="form-control"
          >
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
          保存
        </button>
      </footer>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.modal-footer {
  display: flex;
  align-items: center;
  gap: 8px;

  .spacer {
    flex: 1;
  }
}
</style>
