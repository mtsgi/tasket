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
import dayjs from 'dayjs'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const props = defineProps<{
  yearMonth: string // YYYY-MM形式
}>()

const healthDataStore = useHealthDataStore()

// 選択されたグラフタイプ
type ChartType = 'weight-bodyfat' | 'heartrate' | 'muscle' | 'visceral' | 'steps' | 'sleep'
const selectedChartType = ref<ChartType>('weight-bodyfat')

// チャートタイプのオプション
const chartTypeOptions = [
  { value: 'weight-bodyfat', label: $t('体重・体脂肪率') },
  { value: 'heartrate', label: $t('心拍数') },
  { value: 'muscle', label: $t('筋肉量') },
  { value: 'visceral', label: $t('内臓脂肪レベル') },
  { value: 'steps', label: $t('歩数') },
  { value: 'sleep', label: $t('睡眠時間') },
]

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

  if (selectedChartType.value === 'weight-bodyfat') {
    // 体重・体脂肪率
    const weightData = labels.map((day) => {
      const dateStr = `${props.yearMonth}-${day.padStart(2, '0')}`
      const healthData = data.find(d => d.date === dateStr)
      return healthData?.weight || null
    })

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
  }
  else if (selectedChartType.value === 'heartrate') {
    // 心拍数
    const heartRateData = labels.map((day) => {
      const dateStr = `${props.yearMonth}-${day.padStart(2, '0')}`
      const healthData = data.find(d => d.date === dateStr)
      return healthData?.heartRate || null
    })

    return {
      labels,
      datasets: [
        {
          label: $t('心拍数') + ' (bpm)',
          data: heartRateData,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          tension: 0.3,
        },
      ],
    }
  }
  else if (selectedChartType.value === 'muscle') {
    // 筋肉量
    const muscleMassData = labels.map((day) => {
      const dateStr = `${props.yearMonth}-${day.padStart(2, '0')}`
      const healthData = data.find(d => d.date === dateStr)
      return healthData?.muscleMass || null
    })

    return {
      labels,
      datasets: [
        {
          label: $t('筋肉量') + ' (kg)',
          data: muscleMassData,
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          tension: 0.3,
        },
      ],
    }
  }
  else if (selectedChartType.value === 'visceral') {
    // 内臓脂肪レベル
    const visceralData = labels.map((day) => {
      const dateStr = `${props.yearMonth}-${day.padStart(2, '0')}`
      const healthData = data.find(d => d.date === dateStr)
      return healthData?.visceralFatLevel || null
    })

    return {
      labels,
      datasets: [
        {
          label: $t('内臓脂肪レベル'),
          data: visceralData,
          borderColor: 'rgb(255, 159, 64)',
          backgroundColor: 'rgba(255, 159, 64, 0.2)',
          tension: 0.3,
        },
      ],
    }
  }
  else if (selectedChartType.value === 'steps') {
    // 歩数
    const stepsData = labels.map((day) => {
      const dateStr = `${props.yearMonth}-${day.padStart(2, '0')}`
      const healthData = data.find(d => d.date === dateStr)
      return healthData?.steps || null
    })

    return {
      labels,
      datasets: [
        {
          label: $t('歩数'),
          data: stepsData,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.3,
        },
      ],
    }
  }
  else if (selectedChartType.value === 'sleep') {
    // 睡眠時間
    const sleepData = labels.map((day) => {
      const dateStr = `${props.yearMonth}-${day.padStart(2, '0')}`
      const healthData = data.find(d => d.date === dateStr)
      return healthData?.sleepHours || null
    })

    return {
      labels,
      datasets: [
        {
          label: $t('睡眠時間') + ' (' + $t('時間') + ')',
          data: sleepData,
          borderColor: 'rgb(153, 102, 255)',
          backgroundColor: 'rgba(153, 102, 255, 0.2)',
          tension: 0.3,
        },
      ],
    }
  }

  return { labels, datasets: [] }
})

// グラフオプション
const chartOptions = computed<ChartOptions<'line'>>(() => {
  const options: ChartOptions<'line'> = {
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
    scales: {},
  }

  // グラフタイプに応じてスケールを設定
  if (selectedChartType.value === 'weight-bodyfat') {
    options.scales = {
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
    }
  }
  else {
    options.scales = {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
      },
    }
  }

  return options
})

// データがあるかどうか
const hasData = computed(() => {
  return monthHealthData.value.length > 0
})

onMounted(async () => {
  await healthDataStore.fetchHealthData()
})
</script>

<template>
  <div class="health-chart card">
    <div class="chart-header">
      <h3>
        <Icon name="mdi:chart-line" />
        {{ $t('健康データの推移') }}
      </h3>
      <div class="chart-selector">
        <label>{{ $t('表示項目') }}:</label>
        <select v-model="selectedChartType">
          <option
            v-for="option in chartTypeOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </div>
    </div>
    <div
      v-if="hasData"
      class="chart-container"
    >
      <Line
        :data="chartData"
        :options="chartOptions"
      />
    </div>
    <div
      v-else
      class="no-data"
    >
      <p>{{ $t('健康データが記録されていません') }}</p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.health-chart {
  margin-bottom: 24px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;

  h3 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
  }

  .chart-selector {
    display: flex;
    align-items: center;
    gap: 8px;

    label {
      font-size: 14px;
      color: #666;

      .dark-mode & {
        color: #b0b0b0;
      }
    }

    select {
      padding: 6px 12px;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      font-size: 14px;
      background-color: white;
      cursor: pointer;

      &:focus {
        outline: none;
        border-color: #4a90d9;
      }

      .dark-mode & {
        background-color: #333;
        border-color: #444;
        color: #e0e0e0;
      }
    }
  }

  @media (max-width: 600px) {
    flex-direction: column;
    align-items: flex-start;
  }
}

.chart-container {
  height: 300px;
  position: relative;

  @media (max-width: 600px) {
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
