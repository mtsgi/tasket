<script setup lang="ts">
/**
 * 年間サマリーコンポーネント
 * 年間の収支とタスク完了状況を表示
 */
import type { YearlySummary } from '~/types/item'
import { formatCurrency } from '~/utils/formatters'

defineProps<{
  summary: YearlySummary
}>()
</script>

<template>
  <section class="yearly-summary card">
    <h2>
      <Icon name="mdi:calendar-check" />
      {{ $t('年間サマリー') }}
    </h2>
    <div class="summary-grid">
      <div class="summary-item">
        <span class="label">{{ $t('収入合計') }}</span>
        <span class="amount amount-income">{{ formatCurrency(summary.income) }}</span>
      </div>
      <div class="summary-item">
        <span class="label">{{ $t('支出合計') }}</span>
        <span class="amount amount-expense">{{ formatCurrency(summary.expense) }}</span>
      </div>
      <div class="summary-item large">
        <span class="label">{{ $t('収支差額') }}</span>
        <span
          class="amount amount-balance"
          :class="{ positive: summary.balance >= 0, negative: summary.balance < 0 }"
        >
          {{ formatCurrency(summary.balance) }}
        </span>
      </div>
      <div class="summary-item">
        <span class="label">{{ $t('完了タスク') }}</span>
        <span class="value completed">{{ summary.completedTasks }}</span>
      </div>
      <div class="summary-item">
        <span class="label">{{ $t('未完了タスク') }}</span>
        <span class="value pending">{{ summary.pendingTasks }}</span>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.yearly-summary {
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

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;

  @media (min-width: 500px) {
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  background-color: #f5f7fa;
  border-radius: 8px;

  // ダークモード対応
  .dark-mode & {
    background-color: #333;
  }

  &.large {
    grid-column: span 2;

    @media (min-width: 500px) {
      grid-column: span 1;
    }
  }

  .label {
    font-size: 12px;
    color: #666;
    text-align: center;

    // ダークモード対応
    .dark-mode & {
      color: #b0b0b0;
    }
  }

  .amount {
    font-size: 18px;
    font-weight: 600;

    @media (min-width: 500px) {
      font-size: 22px;
    }
  }

  .value {
    font-size: 22px;
    font-weight: 600;

    @media (min-width: 500px) {
      font-size: 26px;
    }

    &.completed {
      color: #4caf50;
    }

    &.pending {
      color: #ff9800;
    }
  }
}

@media (max-width: 380px) {
  .summary-grid {
    gap: 8px;
  }

  .summary-item {
    padding: 8px 4px;

    .label {
      font-size: 10px;
    }

    .amount {
      font-size: 16px;
    }

    .value {
      font-size: 20px;
    }
  }
}
</style>
