<script setup lang="ts">
import type { Item } from '~/types/item'
import ItemCard from '~/components/shared/ItemCard.vue'

defineProps<{
  items: Item[]
}>()
</script>

<template>
  <section class="item-list">
    <h2>アイテム一覧</h2>
    <div
      v-if="items.length === 0"
      class="empty-state"
    >
      <p>この日のアイテムはありません</p>
    </div>
    <div
      v-else
      class="items"
    >
      <ItemCard
        v-for="item in items"
        :key="item.id"
        :item="item"
      />
    </div>
  </section>
</template>

<style lang="scss" scoped>
.item-list {
  margin-top: 24px;

  h2 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 12px;
    color: #666;
  }
}

.items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
