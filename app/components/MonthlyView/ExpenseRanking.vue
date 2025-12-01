<script setup lang="ts">
import type { ExpenseRankingItem } from '~/types/item'
import { formatCurrency } from '~/utils/formatters'

defineProps<{
  ranking: ExpenseRankingItem[]
}>()
</script>

<template>
  <section class="expense-ranking card">
    <h2>支出ランキング</h2>
    <div
      v-if="ranking.length === 0"
      class="empty-state"
    >
      <p>支出データがありません</p>
    </div>
    <ol
      v-else
      class="ranking-list"
    >
      <li
        v-for="(item, index) in ranking"
        :key="item.title"
        class="ranking-item"
      >
        <span class="rank">{{ index + 1 }}</span>
        <div class="item-info">
          <span class="title">{{ item.title }}</span>
          <span class="count">{{ item.count }}回</span>
        </div>
        <span class="amount amount-expense">{{ formatCurrency(item.totalAmount) }}</span>
      </li>
    </ol>
  </section>
</template>

<style lang="scss" scoped>
.expense-ranking {
  h2 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 16px;
    color: #666;
  }
}

.ranking-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.ranking-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }
}

.rank {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 600;
  color: #666;

  .ranking-item:nth-child(1) & {
    background-color: #ffd700;
    color: white;
  }

  .ranking-item:nth-child(2) & {
    background-color: #c0c0c0;
    color: white;
  }

  .ranking-item:nth-child(3) & {
    background-color: #cd7f32;
    color: white;
  }
}

.item-info {
  flex: 1;
  min-width: 0;

  .title {
    display: block;
    font-weight: 500;
    word-break: break-word;
  }

  .count {
    font-size: 12px;
    color: #666;
  }
}

.amount {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
}
</style>
