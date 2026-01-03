<script setup lang="ts">
import type { MonthlySummary } from '~/types/item'
import { formatCurrency } from '~/utils/formatters'

defineProps<{
  summary: MonthlySummary
}>()
</script>

<template>
  <section class="monthly-summary card">
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
.monthly-summary {
  margin-bottom: 16px;
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
  padding: 8px 4px;
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
    font-size: 11px;
    color: #666;
    text-align: center;

    // ダークモード対応
    .dark-mode & {
      color: #b0b0b0;
    }
  }

  .amount {
    font-size: 16px;
    font-weight: 600;

    @media (min-width: 500px) {
      font-size: 20px;
    }
  }

  .value {
    font-size: 20px;
    font-weight: 600;

    @media (min-width: 500px) {
      font-size: 24px;
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
    padding: 6px 2px;

    .label {
      font-size: 10px;
    }

    .amount {
      font-size: 14px;
    }

    .value {
      font-size: 18px;
    }
  }
}
</style>
