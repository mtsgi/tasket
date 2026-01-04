<script setup lang="ts">
import { Line, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  type TooltipItem,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
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

// グラフの表示モードの状態管理
type DataMode = 'daily' | 'cumulative'
type ChartType = 'line' | 'bar'

const dataMode = ref<DataMode>('daily')
const chartType = ref<ChartType>('line')
const { t } = useI18n()

/**
 * 累積データを計算
 * @param data - 元のデータ配列
 * @returns 累積和の配列
 */
function calculateCumulativeData(data: number[]): number[] {
  const cumulative: number[] = []
  let sum = 0
  for (const value of data) {
    sum += value
    cumulative.push(sum)
  }
  return cumulative
}

/**
 * 表示するデータを取得（単日 or 累積）
 */
const displayData = computed(() => {
  if (dataMode.value === 'daily') {
    return {
      incomes: props.dailyTotals.incomes,
      expenses: props.dailyTotals.expenses,
      balances: props.dailyTotals.balances,
    }
  }
  else {
    // 累積モード
    return {
      incomes: calculateCumulativeData(props.dailyTotals.incomes),
      expenses: calculateCumulativeData(props.dailyTotals.expenses),
      // balancesはuseStatisticsのcalculateDailyTotalsで既に累積値として計算されている
      balances: props.dailyTotals.balances,
    }
  }
})

// グラフの種類に応じて背景色の透明度を調整
const backgroundOpacity = computed(() => chartType.value === 'bar' ? 0.6 : 0.1)

const chartData = computed(() => ({
  labels: props.dailyTotals.dates,
  datasets: [
    {
      label: t('収入'),
      data: displayData.value.incomes,
      borderColor: '#4caf50',
      backgroundColor: `rgba(76, 175, 80, ${backgroundOpacity.value})`,
      tension: 0.3,
      pointRadius: 2,
    },
    {
      label: t('支出'),
      data: displayData.value.expenses,
      borderColor: '#f44336',
      backgroundColor: `rgba(244, 67, 54, ${backgroundOpacity.value})`,
      tension: 0.3,
      pointRadius: 2,
    },
    {
      label: t('残高'),
      data: displayData.value.balances,
      borderColor: '#4a90d9',
      backgroundColor: `rgba(74, 144, 217, ${backgroundOpacity.value})`,
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
        label: function (context: TooltipItem<'line' | 'bar'>) {
          const label = context.dataset.label || ''
          const value = context.parsed.y ?? 0
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
    <div class="header-section">
      <h2>
        <Icon name="mdi:chart-line" />
        {{ $t('収支推移') }}
      </h2>
      <div class="chart-controls">
        <div class="control-group">
          <button
            class="control-btn"
            :class="{ active: dataMode === 'daily' }"
            :aria-label="$t('単日表示')"
            @click="dataMode = 'daily'"
          >
            {{ $t('単日') }}
          </button>
          <button
            class="control-btn"
            :class="{ active: dataMode === 'cumulative' }"
            :aria-label="$t('累積表示')"
            @click="dataMode = 'cumulative'"
          >
            {{ $t('累積') }}
          </button>
        </div>
        <div class="control-group">
          <button
            class="control-btn"
            :class="{ active: chartType === 'line' }"
            :aria-label="$t('折れ線グラフ')"
            @click="chartType = 'line'"
          >
            <Icon name="mdi:chart-line" />
          </button>
          <button
            class="control-btn"
            :class="{ active: chartType === 'bar' }"
            :aria-label="$t('棒グラフ')"
            @click="chartType = 'bar'"
          >
            <Icon name="mdi:chart-bar" />
          </button>
        </div>
      </div>
    </div>
    <div class="chart-container">
      <!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
      <Line
        v-if="chartType === 'line'"
        :data="chartData"
        :options="chartOptions as any"
      />
      <!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
      <Bar
        v-else
        :data="chartData"
        :options="chartOptions as any"
      />
    </div>
  </section>
</template>

<style lang="scss" scoped>
.expense-chart {
  .header-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
    gap: 12px;
    flex-wrap: wrap;

    @media (max-width: 600px) {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }
  }

  h2 {
    font-size: 16px;
    font-weight: 600;
    color: #666;
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;

    // ダークモード対応
    .dark-mode & {
      color: #b0b0b0;
    }
  }

  .chart-controls {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;

    @media (max-width: 600px) {
      justify-content: flex-start;
    }
  }

  .control-group {
    display: flex;
    gap: 4px;
    background: #f5f5f5;
    border-radius: 6px;
    padding: 3px;

    // ダークモード対応
    .dark-mode & {
      background: #333;
    }
  }

  .control-btn {
    padding: 6px 12px;
    border: none;
    background: transparent;
    color: #666;
    font-size: 13px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-weight: 500;
    min-width: 44px;
    min-height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;

    // ダークモード対応
    .dark-mode & {
      color: #b0b0b0;

      &:hover {
        background: #444;
      }
    }

    &:hover {
      background: #e0e0e0;
    }

    &.active {
      background: #fff;
      color: #333;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

      // ダークモード対応
      .dark-mode & {
        background: #2a2a2a;
        color: #e0e0e0;
      }
    }

    @media (max-width: 380px) {
      padding: 6px 10px;
      font-size: 12px;
      min-width: 40px;
    }
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
