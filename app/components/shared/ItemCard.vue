<script setup lang="ts">
import type { Item } from '~/types/item'
import { useItemsStore } from '~/stores/items'
import { formatTime } from '~/utils/dateHelpers'
import { formatCurrency } from '~/utils/formatters'
import ItemEditModal from '~/components/shared/ItemEditModal.vue'

const props = defineProps<{
  item: Item
}>()

const itemsStore = useItemsStore()

const showEditModal = ref(false)

async function handleToggleComplete() {
  await itemsStore.toggleComplete(props.item.id)
}

function handleEdit() {
  showEditModal.value = true
}

function handleCloseModal() {
  showEditModal.value = false
}

const typeLabel = computed(() => {
  switch (props.item.type) {
    case 'todo': return 'TODO'
    case 'expense': return '支出'
    case 'income': return '収入'
    default: return ''
  }
})
</script>

<template>
  <div
    class="item-card card"
    :class="[`type-${item.type}`, { completed: item.is_completed }]"
  >
    <div class="item-header">
      <button
        class="complete-btn"
        :class="{ checked: item.is_completed }"
        @click="handleToggleComplete"
      >
        <span v-if="item.is_completed">✓</span>
      </button>
      <div class="item-info">
        <span class="time">{{ formatTime(item.scheduled_at) }}</span>
        <span :class="`type-badge type-badge-${item.type}`">{{ typeLabel }}</span>
      </div>
    </div>

    <div class="item-content">
      <h3 class="title">
        {{ item.title }}
      </h3>
      <div
        v-if="item.amount > 0"
        class="amount-display"
      >
        <span :class="`amount amount-${item.type}`">
          {{ formatCurrency(item.amount) }}
        </span>
      </div>
    </div>

    <div class="item-actions">
      <button
        class="btn btn-secondary btn-icon"
        @click="handleEdit"
      >
        ✎
      </button>
    </div>

    <ItemEditModal
      v-if="showEditModal"
      :item="item"
      @close="handleCloseModal"
    />
  </div>
</template>

<style lang="scss" scoped>
.item-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  transition: all 0.2s ease;

  &.completed {
    opacity: 0.6;

    .title {
      text-decoration: line-through;
    }
  }

  &.type-todo {
    border-left: 3px solid #2196f3;
  }

  &.type-expense {
    border-left: 3px solid #f44336;
  }

  &.type-income {
    border-left: 3px solid #4caf50;
  }
}

.item-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.complete-btn {
  width: 28px;
  height: 28px;
  border: 2px solid #ccc;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #4caf50;
  transition: all 0.2s ease;

  &:hover {
    border-color: #4caf50;
  }

  &.checked {
    background-color: #4caf50;
    border-color: #4caf50;
    color: white;
  }
}

.item-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;

  .time {
    font-size: 11px;
    color: #666;
    font-weight: 500;
  }
}

.item-content {
  flex: 1;
  min-width: 0;

  .title {
    font-size: 15px;
    font-weight: 500;
    margin-bottom: 2px;
    word-break: break-word;
    line-height: 1.3;
  }
}

.amount-display {
  margin-top: 4px;

  .amount {
    font-size: 14px;
  }
}

.item-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

@media (max-width: 600px) {
  .item-card {
    gap: 8px;
    padding: 10px 12px;
  }

  .complete-btn {
    width: 32px;
    height: 32px;
  }

  .item-content .title {
    font-size: 14px;
  }

  .amount-display .amount {
    font-size: 13px;
  }
}

@media (max-width: 380px) {
  .item-card {
    gap: 6px;
    padding: 8px 10px;
  }

  .item-info .time {
    font-size: 10px;
  }

  .item-content .title {
    font-size: 13px;
  }
}
</style>
