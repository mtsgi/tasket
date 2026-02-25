<script setup lang="ts">
/**
 * 年間収支推移チャートコンポーネント
 * 月別の収入・支出・収支をグラフで表示
 */
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import type { MonthlySummary } from '~/types/item'
import { formatCurrency } from '~/utils/formatters'

// Chart.jsのコンポーネントを登録
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const props = defineProps<{
  monthlySummaries: MonthlySummary[]
}>()

const { t } = useI18n()

/**
 * 月番号から月名を取得
 */
function getMonthName(yearMonth: string): string {
  const month = Number.parseInt(yearMonth.split('-')[1])
  return `${month}月`
}

/**
 * チャートデータの作成
 */
const chartData = computed<ChartData<'bar'>>(() => {
  const labels = props.monthlySummaries.map(s => getMonthName(s.yearMonth))
  const incomes = props.monthlySummaries.map(s => s.income)
  const expenses = props.monthlySummaries.map(s => s.expense)
  const balances = props.monthlySummaries.map(s => s.balance)

  return {
    labels,
    datasets: [
      {
        label: t('収入'),
        data: incomes,
        backgroundColor: 'rgba(76, 175, 80, 0.7)',
        borderColor: 'rgba(76, 175, 80, 1)',
        borderWidth: 1,
      },
      {
        label: t('支出'),
        data: expenses,
        backgroundColor: 'rgba(244, 67, 54, 0.7)',
        borderColor: 'rgba(244, 67, 54, 1)',
        borderWidth: 1,
      },
      {
        label: t('収支'),
        data: balances,
        backgroundColor: 'rgba(33, 150, 243, 0.7)',
        borderColor: 'rgba(33, 150, 243, 1)',
        borderWidth: 1,
      },
    ],
  }
})

/**
 * チャートオプション
 */
const chartOptions = computed<ChartOptions<'bar'>>(() => ({
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      display: true,
      position: 'top',
    },
    tooltip: {
      callbacks: {
        label: (context) => {
          const label = context.dataset.label || ''
          const value = context.parsed.y
          return `${label}: ${formatCurrency(value)}`
        },
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        callback: (value) => {
          return formatCurrency(Number(value))
        },
      },
    },
  },
}))
</script>

<template>
  <section class="yearly-expense-chart card">
    <h2>
      <Icon name="mdi:chart-bar" />
      {{ $t('年間収支推移') }}
    </h2>
    <div
      v-if="monthlySummaries.length === 0"
      class="empty-state"
    >
      <Icon
        name="mdi:chart-timeline-variant-shimmer"
        class="empty-icon"
      />
      <p>{{ $t('データがありません') }}</p>
    </div>
    <div
      v-else
      class="chart-container"
    >
      <Bar
        :data="chartData"
        :options="chartOptions"
      />
    </div>
  </section>
</template>

<style lang="scss" scoped>
.yearly-expense-chart {
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

.chart-container {
  position: relative;
  height: 300px;
  padding: 8px 0;

  @media (min-width: 600px) {
    height: 350px;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;

  .empty-icon {
    font-size: 48px;
    color: #ccc;
    margin-bottom: 8px;

    // ダークモード対応
    .dark-mode & {
      color: #555;
    }
  }

  p {
    color: #666;
    font-size: 14px;

    // ダークモード対応
    .dark-mode & {
      color: #b0b0b0;
    }
  }
}
</style>
