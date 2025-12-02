<script setup lang="ts">
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
)

const props = defineProps<{
  dailyTotals: {
    dates: string[]
    incomes: number[]
    expenses: number[]
    balances: number[]
  }
}>()

const chartData = computed(() => ({
  labels: props.dailyTotals.dates,
  datasets: [
    {
      label: '収入',
      data: props.dailyTotals.incomes,
      borderColor: '#4caf50',
      backgroundColor: 'rgba(76, 175, 80, 0.1)',
      tension: 0.3,
      pointRadius: 2,
    },
    {
      label: '支出',
      data: props.dailyTotals.expenses,
      borderColor: '#f44336',
      backgroundColor: 'rgba(244, 67, 54, 0.1)',
      tension: 0.3,
      pointRadius: 2,
    },
    {
      label: '残高',
      data: props.dailyTotals.balances,
      borderColor: '#4a90d9',
      backgroundColor: 'rgba(74, 144, 217, 0.1)',
      tension: 0.3,
      pointRadius: 2,
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        boxWidth: 12,
        padding: 16,
        font: {
          size: 12,
        },
      },
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
      callbacks: {
        label: function (context: { dataset: { label: string }, parsed: { y: number } }) {
          const label = context.dataset.label || ''
          const value = context.parsed.y
          return `${label}: ¥${value.toLocaleString()}`
        },
      },
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        font: {
          size: 10,
        },
      },
    },
    y: {
      beginAtZero: true,
      ticks: {
        callback: function (value: number | string) {
          if (typeof value === 'number') {
            return '¥' + value.toLocaleString()
          }
          return value
        },
        font: {
          size: 10,
        },
      },
    },
  },
  interaction: {
    mode: 'nearest' as const,
    axis: 'x' as const,
    intersect: false,
  },
}
</script>

<template>
  <section class="expense-chart card">
    <h2>収支推移</h2>
    <div class="chart-container">
      <Line
        :data="chartData"
        :options="chartOptions"
      />
    </div>
  </section>
</template>

<style lang="scss" scoped>
.expense-chart {
  h2 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 16px;
    color: #666;
  }
}

.chart-container {
  height: 250px;

  @media (max-width: 600px) {
    height: 200px;
  }

  @media (max-width: 380px) {
    height: 180px;
  }
}
</style>
