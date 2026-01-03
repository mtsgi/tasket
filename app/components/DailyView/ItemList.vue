<script setup lang="ts">
/**
 * アイテム一覧コンポーネント
 * 指定された日のアイテムをリスト表示
 */
import type { Item } from '~/types/item'
import ItemCard from '~/components/shared/ItemCard.vue'

defineProps<{
  items: Item[]
}>()

const { t } = useI18n()
</script>

<template>
  <section class="item-list">
    <h2>
      <Icon name="mdi:format-list-bulleted" />
      {{ $t('アイテム一覧') }}
    </h2>
    <div
      v-if="items.length === 0"
      class="empty-state"
    >
      <Icon
        name="mdi:inbox-outline"
        class="empty-icon"
      />
      <p>{{ $t('この日のアイテムはありません') }}</p>
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
    display: flex;
    align-items: center;
    gap: 6px;

    // ダークモード対応
    .dark-mode & {
      color: #b0b0b0;
    }
  }
}

.items {
  display: flex;
  flex-direction: column;
}

.empty-state {
  .empty-icon {
    font-size: 48px;
    color: #ccc;
    margin-bottom: 8px;

    // ダークモード対応
    .dark-mode & {
      color: #555;
    }
  }
}
</style>
