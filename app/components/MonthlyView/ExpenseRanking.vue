<script setup lang="ts">
/**
 * 支出ランキングコンポーネント
 * 月間の支出をカテゴリ別にランキング表示
 */
import type { ExpenseRankingItem } from '~/types/item'
import { formatCurrency } from '~/utils/formatters'

const props = defineProps<{
  ranking: ExpenseRankingItem[]
}>()

// 定数: デフォルトで表示するランキング数
const DEFAULT_VISIBLE_ITEMS = 10

// 折りたたみ状態を管理
const isExpanded = ref(false)

// 表示するランキングアイテムを計算
const displayedRanking = computed(() => {
  // デフォルト表示数まで、または全アイテムを表示
  if (isExpanded.value || props.ranking.length <= DEFAULT_VISIBLE_ITEMS) {
    return props.ranking
  }
  return props.ranking.slice(0, DEFAULT_VISIBLE_ITEMS)
})

// 11位以降が存在するかどうか
const hasMoreItems = computed(() => props.ranking.length > DEFAULT_VISIBLE_ITEMS)

// 折りたたみ切り替え
const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
}
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
    <div v-else>
      <ol class="ranking-list">
        <li
          v-for="(item, index) in displayedRanking"
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
      <button
        v-if="hasMoreItems"
        class="toggle-button"
        :aria-expanded="isExpanded"
        :aria-label="isExpanded ? $t('折りたたむ') : $t('さらに表示')"
        @click="toggleExpanded"
      >
        <Icon :name="isExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
        {{ isExpanded ? $t('折りたたむ') : $t('さらに表示') }}
      </button>
    </div>
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

.toggle-button {
  width: 100%;
  padding: 12px;
  margin-top: 8px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: #f9f9f9;
  color: #666;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s ease;

  // ダークモード対応
  .dark-mode & {
    background-color: #2a2a2a;
    border-color: #444;
    color: #b0b0b0;
  }

  &:hover {
    background-color: #f0f0f0;
    border-color: #d0d0d0;

    // ダークモード対応
    .dark-mode & {
      background-color: #333;
      border-color: #555;
    }
  }

  &:active {
    transform: scale(0.98);

    // モーション軽減設定を尊重
    @media (prefers-reduced-motion: reduce) {
      transform: none;
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
