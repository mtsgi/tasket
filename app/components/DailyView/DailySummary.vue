<script setup lang="ts">
import type { DailySummary } from '~/types/item'
import { formatCurrency } from '~/utils/formatters'

defineProps<{
  summary: DailySummary
}>()
</script>

<template>
  <section class="daily-summary card">
    <div class="summary-grid">
      <div class="summary-item">
        <span class="label">収入</span>
        <span class="amount amount-income">{{ formatCurrency(summary.income) }}</span>
      </div>
      <div class="summary-item">
        <span class="label">支出</span>
        <span class="amount amount-expense">{{ formatCurrency(summary.expense) }}</span>
      </div>
      <div class="summary-item">
        <span class="label">収支</span>
        <span
          class="amount amount-balance"
          :class="{ positive: summary.balance >= 0, negative: summary.balance < 0 }"
        >
          {{ formatCurrency(summary.balance) }}
        </span>
      </div>
      <div class="summary-item">
        <span class="label">タスク</span>
        <span class="tasks">
          <span class="completed">{{ summary.completedTasks }}</span>
          /
          <span class="total">{{ summary.completedTasks + summary.pendingTasks }}</span>
        </span>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.daily-summary {
  margin-bottom: 16px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;

  @media (min-width: 500px) {
    grid-template-columns: repeat(4, 1fr);
  }
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;

  .label {
    font-size: 12px;
    color: #666;
  }

  .amount {
    font-size: 18px;
    font-weight: 600;
  }

  .tasks {
    font-size: 18px;
    font-weight: 600;

    .completed {
      color: #4caf50;
    }

    .total {
      color: #666;
    }
  }
}
</style>
