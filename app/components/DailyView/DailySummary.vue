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
        <span class="label">{{ $t('収入') }}</span>
        <span class="amount amount-income">{{ formatCurrency(summary.income) }}</span>
      </div>
      <div class="summary-item">
        <span class="label">{{ $t('支出') }}</span>
        <span class="amount amount-expense">{{ formatCurrency(summary.expense) }}</span>
      </div>
      <div class="summary-item">
        <span class="label">{{ $t('収支') }}</span>
        <span
          class="amount amount-balance"
          :class="{ positive: summary.balance >= 0, negative: summary.balance < 0 }"
        >
          {{ formatCurrency(summary.balance) }}
        </span>
      </div>
      <div class="summary-item">
        <span class="label">{{ $t('タスク') }}</span>
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
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;

  @media (min-width: 500px) {
    gap: 16px;
  }
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;

  @media (min-width: 500px) {
    gap: 4px;
  }

  .label {
    font-size: 10px;
    color: #666;

    @media (min-width: 500px) {
      font-size: 12px;
    }
  }

  .amount {
    font-size: 14px;
    font-weight: 600;

    @media (min-width: 500px) {
      font-size: 18px;
    }
  }

  .tasks {
    font-size: 14px;
    font-weight: 600;

    @media (min-width: 500px) {
      font-size: 18px;
    }

    .completed {
      color: #4caf50;
    }

    .total {
      color: #666;
    }
  }
}

@media (max-width: 380px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .summary-item {
    .label {
      font-size: 10px;
    }

    .amount, .tasks {
      font-size: 14px;
    }
  }
}
</style>
