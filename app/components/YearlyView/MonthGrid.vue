<script setup lang="ts">
/**
 * 月別グリッドコンポーネント
 * 各月のサマリーカードを表示し、月ページへのリンクを提供
 */
import type { MonthlySummary } from '~/types/item'
import { formatCurrency } from '~/utils/formatters'

defineProps<{
  monthlySummaries: MonthlySummary[]
  year: string
}>()

const emit = defineEmits<{
  selectMonth: [yearMonth: string]
}>()

/**
 * 月番号から月名を取得
 */
function getMonthName(yearMonth: string): string {
  const month = Number.parseInt(yearMonth.split('-')[1] ?? '0')
  return `${month}月`
}

/**
 * 月カードをクリック
 */
function handleMonthClick(yearMonth: string) {
  emit('selectMonth', yearMonth)
}
</script>

<template>
  <section class="month-grid card">
    <h2>
      <Icon name="mdi:calendar-month" />
      {{ $t('各月の詳細') }}
    </h2>
    <div class="grid">
      <button
        v-for="summary in monthlySummaries"
        :key="summary.yearMonth"
        class="month-card"
        @click="handleMonthClick(summary.yearMonth)"
      >
        <div class="month-header">
          <span class="month-name">{{ getMonthName(summary.yearMonth) }}</span>
        </div>
        <div class="month-stats">
          <div class="stat-item">
            <span class="stat-label">{{ $t('収入') }}</span>
            <span class="stat-value income">{{ formatCurrency(summary.income) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">{{ $t('支出') }}</span>
            <span class="stat-value expense">{{ formatCurrency(summary.expense) }}</span>
          </div>
          <div class="stat-item balance-item">
            <span class="stat-label">{{ $t('収支') }}</span>
            <span
              class="stat-value balance"
              :class="{ positive: summary.balance >= 0, negative: summary.balance < 0 }"
            >
              {{ formatCurrency(summary.balance) }}
            </span>
          </div>
        </div>
        <div class="month-tasks">
          <span class="task-count completed">
            <Icon name="mdi:check-circle" />
            {{ summary.completedTasks }}
          </span>
          <span class="task-count pending">
            <Icon name="mdi:circle-outline" />
            {{ summary.pendingTasks }}
          </span>
        </div>
      </button>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.month-grid {
  margin-bottom: 16px;

  h2 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 16px;
    color: #666;
    display: flex;
    align-items: center;
    gap: 8px;

    // ダークモード対応
    .dark-mode & {
      color: #b0b0b0;
    }
  }
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;

  @media (min-width: 600px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (min-width: 900px) {
    grid-template-columns: repeat(4, 1fr);
  }
}

.month-card {
  background-color: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 8px;

  // ダークモード対応
  .dark-mode & {
    background-color: #2a2a2a;
    border-color: #444;
  }

  &:hover {
    background-color: #f0f0f0;
    border-color: #d0d0d0;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);

    // ダークモード対応
    .dark-mode & {
      background-color: #333;
      border-color: #555;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    }

    // モーション軽減設定を尊重
    @media (prefers-reduced-motion: reduce) {
      transform: none;
    }
  }

  &:active {
    transform: translateY(0);

    // モーション軽減設定を尊重
    @media (prefers-reduced-motion: reduce) {
      transform: none;
    }
  }
}

.month-header {
  display: flex;
  justify-content: center;
  padding-bottom: 8px;
  border-bottom: 2px solid #e0e0e0;

  // ダークモード対応
  .dark-mode & {
    border-color: #444;
  }
}

.month-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;

  // ダークモード対応
  .dark-mode & {
    color: #e0e0e0;
  }
}

.month-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;

  &.balance-item {
    padding-top: 4px;
    border-top: 1px solid #e0e0e0;

    // ダークモード対応
    .dark-mode & {
      border-color: #444;
    }
  }
}

.stat-label {
  color: #666;
  font-size: 11px;

  // ダークモード対応
  .dark-mode & {
    color: #b0b0b0;
  }
}

.stat-value {
  font-weight: 600;
  font-size: 13px;

  &.income {
    color: #4caf50;
  }

  &.expense {
    color: #f44336;
  }

  &.balance {
    &.positive {
      color: #4caf50;
    }

    &.negative {
      color: #f44336;
    }
  }
}

.month-tasks {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding-top: 8px;
}

.task-count {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;

  &.completed {
    color: #4caf50;
  }

  &.pending {
    color: #ff9800;
  }
}

@media (max-width: 380px) {
  .month-card {
    padding: 10px;
  }

  .month-name {
    font-size: 14px;
  }

  .stat-item {
    font-size: 11px;
  }

  .stat-value {
    font-size: 12px;
  }

  .task-count {
    font-size: 12px;
  }
}
</style>
