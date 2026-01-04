<script setup lang="ts">
/**
 * 健康データ推移グラフコンポーネント
 * 月ごとのビューで健康データの推移をグラフ表示
 */
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
  type ChartOptions,
} from 'chart.js'
import { useHealthDataStore } from '~/stores/healthData'
import dayjs from 'dayjs'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const props = defineProps<{
  yearMonth: string // YYYY-MM形式
}>()

const healthDataStore = useHealthDataStore()
const { $t } = useI18n()

// その月の健康データ
const monthHealthData = computed(() => {
  return healthDataStore.getHealthDataByMonth(props.yearMonth)
})

// グラフデータの準備
const chartData = computed(() => {
  const data = monthHealthData.value

  // 日付のラベルを作成（その月の全日）
  const daysInMonth = dayjs(props.yearMonth + '-01').daysInMonth()
  const labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1))

  // 体重データ
  const weightData = labels.map((day) => {
    const dateStr = `${props.yearMonth}-${day.padStart(2, '0')}`
    const healthData = data.find(d => d.date === dateStr)
    return healthData?.weight || null
  })

  // 体脂肪率データ
  const bodyFatData = labels.map((day) => {
    const dateStr = `${props.yearMonth}-${day.padStart(2, '0')}`
    const healthData = data.find(d => d.date === dateStr)
    return healthData?.bodyFatPercentage || null
  })

  return {
    labels,
    datasets: [
      {
        label: $t('体重') + ' (kg)',
        data: weightData,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.3,
        yAxisID: 'y',
      },
      {
        label: $t('体脂肪率') + ' (%)',
        data: bodyFatData,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        tension: 0.3,
        yAxisID: 'y1',
      },
    ],
  }
})

// グラフオプション
const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false,
  },
  plugins: {
    legend: {
      position: 'top',
    },
    title: {
      display: true,
      text: $t('健康データの推移'),
    },
  },
  scales: {
    y: {
      type: 'linear',
      display: true,
      position: 'left',
      title: {
        display: true,
        text: $t('体重') + ' (kg)',
      },
    },
    y1: {
      type: 'linear',
      display: true,
      position: 'right',
      title: {
        display: true,
        text: $t('体脂肪率') + ' (%)',
      },
      grid: {
        drawOnChartArea: false,
      },
    },
  },
}))

// データがあるかどうか
const hasData = computed(() => {
  return monthHealthData.value.length > 0
})

onMounted(async () => {
  await healthDataStore.fetchHealthData()
})
</script>

<template>
  <div class="health-chart">
    <div v-if="hasData" class="chart-container">
      <Line :data="chartData" :options="chartOptions" />
    </div>
    <div v-else class="no-data">
      <p>{{ $t('健康データが記録されていません') }}</p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.health-chart {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.chart-container {
  height: 300px;
  position: relative;

  @media (max-width: 768px) {
    height: 250px;
  }
}

.no-data {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);

  p {
    margin: 0;
    font-size: 14px;
  }
}
</style>
