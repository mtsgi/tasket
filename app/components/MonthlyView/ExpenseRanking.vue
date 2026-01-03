<script setup lang="ts">
/**
 * 支出ランキングコンポーネント
 * 月間の支出をカテゴリ別にランキング表示
 */
import type { ExpenseRankingItem } from '~/types/item'
import { formatCurrency } from '~/utils/formatters'

defineProps<{
  ranking: ExpenseRankingItem[]
}>()
</script>

<template>
  <section class="expense-ranking card">
    <h2>
      <Icon name="mdi:podium" />
      {{ $t('支出ランキング') }}
    </h2>
    <div
      v-if="ranking.length === 0"
      class="empty-state"
    >
      <Icon
        name="mdi:chart-timeline-variant-shimmer"
        class="empty-icon"
      />
      <p>{{ $t('支出データがありません') }}</p>
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
          <span class="count">{{ item.count }}{{ $t('回') }}</span>
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
    display: flex;
    align-items: center;
    gap: 6px;

    // ダークモード対応
    .dark-mode & {
      color: #b0b0b0;
    }
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

  // ダークモード対応
  .dark-mode & {
    border-color: #444;
  }

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
  flex-shrink: 0;

  // ダークモード対応
  .dark-mode & {
    background-color: #333;
    color: #b0b0b0;
  }

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
    font-size: 14px;
    line-height: 1.3;
  }

  .count {
    font-size: 12px;
    color: #666;

    // ダークモード対応
    .dark-mode & {
      color: #b0b0b0;
    }
  }
}

.amount {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
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

@media (max-width: 600px) {
  .ranking-item {
    gap: 10px;
    padding: 10px 0;
  }

  .rank {
    width: 24px;
    height: 24px;
    font-size: 12px;
  }

  .item-info .title {
    font-size: 13px;
  }

  .item-info .count {
    font-size: 11px;
  }

  .amount {
    font-size: 13px;
  }
}
</style>
