<script setup lang="ts">
/**
 * 月次健康サマリーコンポーネント
 * 月ごとのビューで健康データの統計と先月との比較を表示
 */
import { useHealthDataStore } from '~/stores/healthData'
import { useItemsStore } from '~/stores/items'
import HealthDataCSVExport from './HealthDataCSVExport.vue'

const props = defineProps<{
  yearMonth: string // YYYY-MM形式
}>()

const healthDataStore = useHealthDataStore()
const itemsStore = useItemsStore()

// 月次健康サマリー
const monthlySummary = computed(() => {
  return healthDataStore.getMonthlyHealthSummary(props.yearMonth)
})

// その月の摂取カロリー合計
const totalCalories = computed(() => {
  return itemsStore.getTotalCaloriesByMonth(props.yearMonth)
})

// 比較項目の情報インターフェース
interface ComparisonItem {
  type: 'weight' | 'bodyFat' | 'muscleMass' | 'visceralFat' | 'heartRate' | 'sleep' | 'steps'
  label: string
  value: number
  unit: string
  icon: string
  isPositive: boolean | null // null = 変化なし、true = 改善、false = 悪化
}

// 健康比較データの生成
const comparisonData = computed(() => {
  const summary = monthlySummary.value
  const items: ComparisonItem[] = []

  // 体重の変化（減少がポジティブ）
  if (summary.weightChange !== undefined) {
    items.push({
      type: 'weight',
      label: $t('体重'),
      value: summary.weightChange,
      unit: 'kg',
      icon: 'mdi:weight',
      isPositive: summary.weightChange < -0.1 ? true : summary.weightChange > 0.1 ? false : null,
    })
  }

  // 体脂肪率の変化（減少がポジティブ）
  if (summary.bodyFatChange !== undefined) {
    items.push({
      type: 'bodyFat',
      label: $t('体脂肪率'),
      value: summary.bodyFatChange,
      unit: '%',
      icon: 'mdi:scale-bathroom',
      isPositive: summary.bodyFatChange < -0.1 ? true : summary.bodyFatChange > 0.1 ? false : null,
    })
  }

  // 筋肉量の変化（増加がポジティブ）
  if (summary.muscleMassChange !== undefined && Math.abs(summary.muscleMassChange) > 0.1) {
    items.push({
      type: 'muscleMass',
      label: $t('筋肉量'),
      value: summary.muscleMassChange,
      unit: 'kg',
      icon: 'mdi:arm-flex',
      isPositive: summary.muscleMassChange > 0.1 ? true : summary.muscleMassChange < -0.1 ? false : null,
    })
  }

  // 内臓脂肪レベルの変化（減少がポジティブ）
  if (summary.visceralFatLevelChange !== undefined && Math.abs(summary.visceralFatLevelChange) > 0.5) {
    items.push({
      type: 'visceralFat',
      label: $t('内臓脂肪レベル'),
      value: summary.visceralFatLevelChange,
      unit: '',
      icon: 'mdi:stomach',
      isPositive: summary.visceralFatLevelChange < -0.5 ? true : summary.visceralFatLevelChange > 0.5 ? false : null,
    })
  }

  // 心拍数の変化（安静時心拍数は低い方が良い）
  if (summary.heartRateChange !== undefined && Math.abs(summary.heartRateChange) > 2) {
    items.push({
      type: 'heartRate',
      label: $t('平均心拍数'),
      value: summary.heartRateChange,
      unit: 'bpm',
      icon: 'mdi:heart-pulse',
      isPositive: summary.heartRateChange < -2 ? true : summary.heartRateChange > 2 ? false : null,
    })
  }

  // 睡眠時間の変化（増加がポジティブ、ただし適切な範囲内）
  if (summary.sleepHoursChange !== undefined && Math.abs(summary.sleepHoursChange) > 0.3) {
    items.push({
      type: 'sleep',
      label: $t('平均睡眠時間'),
      value: summary.sleepHoursChange,
      unit: $t('時間'),
      icon: 'mdi:sleep',
      isPositive: summary.sleepHoursChange > 0.3 ? true : summary.sleepHoursChange < -0.3 ? false : null,
    })
  }

  // 歩数の変化（増加がポジティブ）
  if (summary.stepsChange !== undefined && Math.abs(summary.stepsChange) > 1000) {
    items.push({
      type: 'steps',
      label: $t('総歩数'),
      value: summary.stepsChange,
      unit: $t('歩'),
      icon: 'mdi:walk',
      isPositive: summary.stepsChange > 1000 ? true : summary.stepsChange < -1000 ? false : null,
    })
  }

  return items
})

// 健康アドバイスの生成
const healthAdvice = computed(() => {
  const summary = monthlySummary.value
  const advice: string[] = []

  // 平均睡眠時間の評価
  if (summary.avgSleepHours !== undefined) {
    if (summary.avgSleepHours < 6) {
      advice.push($t('睡眠時間が不足気味です。健康のため、7-8時間の睡眠を心がけましょう'))
    }
    else if (summary.avgSleepHours >= 7 && summary.avgSleepHours <= 8) {
      advice.push($t('理想的な睡眠時間を確保できています'))
    }
  }

  // 歩数の評価
  if (summary.totalSteps !== undefined) {
    const avgStepsPerDay = summary.totalSteps / (summary.recordCount || 1)
    if (avgStepsPerDay >= 10000) {
      advice.push($t('1日平均{value}歩と、健康的な活動量を維持できています', { value: avgStepsPerDay.toFixed(0) }))
    }
    else if (avgStepsPerDay < 5000) {
      advice.push($t('歩数が少なめです。1日1万歩を目標に歩くことを心がけましょう'))
    }
  }

  return advice
})

// データがあるかどうか
const hasData = computed(() => {
  return monthlySummary.value.recordCount > 0 || totalCalories.value > 0
})

onMounted(async () => {
  await healthDataStore.fetchHealthData()
})
</script>

<template>
  <div
    v-if="hasData"
    class="monthly-health-summary card"
  >
    <div class="header-section">
      <h3>
        <Icon name="mdi:heart-pulse" />
        {{ $t('月次健康サマリー') }}
      </h3>
      <HealthDataCSVExport />
    </div>

    <div class="summary-grid">
      <!-- 記録日数 -->
      <div class="summary-item">
        <div class="label">
          {{ $t('記録日数') }}
        </div>
        <div class="value">
          {{ monthlySummary.recordCount }}{{ $t('日') }}
        </div>
      </div>

      <!-- 平均体重 -->
      <div
        v-if="monthlySummary.avgWeight"
        class="summary-item"
      >
        <div class="label">
          {{ $t('平均体重') }}
        </div>
        <div class="value">
          {{ $t('{value}kg', { value: monthlySummary.avgWeight.toFixed(1) }) }}
        </div>
      </div>

      <!-- 平均体脂肪率 -->
      <div
        v-if="monthlySummary.avgBodyFatPercentage"
        class="summary-item"
      >
        <div class="label">
          {{ $t('平均体脂肪率') }}
        </div>
        <div class="value">
          {{ $t('{value}%', { value: monthlySummary.avgBodyFatPercentage.toFixed(1) }) }}
        </div>
      </div>

      <!-- 平均筋肉量 -->
      <div
        v-if="monthlySummary.avgMuscleMass"
        class="summary-item"
      >
        <div class="label">
          {{ $t('平均筋肉量') }}
        </div>
        <div class="value">
          {{ $t('{value}kg', { value: monthlySummary.avgMuscleMass.toFixed(1) }) }}
        </div>
      </div>

      <!-- 平均内臓脂肪レベル -->
      <div
        v-if="monthlySummary.avgVisceralFatLevel"
        class="summary-item"
      >
        <div class="label">
          {{ $t('平均内臓脂肪レベル') }}
        </div>
        <div class="value">
          {{ monthlySummary.avgVisceralFatLevel.toFixed(1) }}
        </div>
      </div>

      <!-- 平均心拍数 -->
      <div
        v-if="monthlySummary.avgHeartRate"
        class="summary-item"
      >
        <div class="label">
          {{ $t('平均心拍数') }}
        </div>
        <div class="value">
          {{ $t('{value}bpm', { value: monthlySummary.avgHeartRate.toFixed(0) }) }}
        </div>
      </div>

      <!-- 平均睡眠時間 -->
      <div
        v-if="monthlySummary.avgSleepHours"
        class="summary-item"
      >
        <div class="label">
          {{ $t('平均睡眠時間') }}
        </div>
        <div class="value">
          {{ $t('{value}時間', { value: monthlySummary.avgSleepHours.toFixed(1) }) }}
        </div>
      </div>

      <!-- 合計歩数 -->
      <div
        v-if="monthlySummary.totalSteps"
        class="summary-item"
      >
        <div class="label">
          {{ $t('合計歩数') }}
        </div>
        <div class="value">
          {{ $t('{value}歩', { value: monthlySummary.totalSteps.toLocaleString() }) }}
        </div>
      </div>

      <!-- 合計運動時間 -->
      <div
        v-if="monthlySummary.totalExerciseMinutes"
        class="summary-item"
      >
        <div class="label">
          {{ $t('合計運動時間') }}
        </div>
        <div class="value">
          {{ $t('{value}分', { value: monthlySummary.totalExerciseMinutes }) }}
        </div>
      </div>

      <!-- 合計摂取カロリー -->
      <div
        v-if="totalCalories > 0"
        class="summary-item highlight"
      >
        <div class="label">
          {{ $t('合計摂取カロリー') }}
        </div>
        <div class="value">
          {{ $t('{value}kcal', { value: totalCalories.toLocaleString() }) }}
        </div>
      </div>
    </div>

    <!-- 先月との比較 -->
    <div
      v-if="comparisonData.length > 0"
      class="comparison-section"
    >
      <h4>{{ $t('先月との比較') }}</h4>
      <div class="comparison-grid">
        <div
          v-for="item in comparisonData"
          :key="item.type"
          class="comparison-item"
          :class="{
            positive: item.isPositive === true,
            negative: item.isPositive === false,
            neutral: item.isPositive === null,
          }"
        >
          <div class="comparison-icon">
            <Icon :name="item.icon" />
          </div>
          <div class="comparison-content">
            <div class="comparison-label">
              {{ item.label }}
            </div>
            <div class="comparison-value">
              <Icon
                v-if="item.isPositive !== null"
                :name="item.value > 0 ? 'mdi:arrow-up' : 'mdi:arrow-down'"
                class="arrow-icon"
              />
              <span class="value-text">
                {{ Math.abs(item.value).toFixed(item.type === 'heartRate' || item.type === 'steps' ? 0 : 1) }}{{ item.unit }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 健康アドバイス -->
    <div
      v-if="healthAdvice.length > 0"
      class="advice-section"
    >
      <h4>{{ $t('健康アドバイス') }}</h4>
      <div class="advice-list">
        <p
          v-for="(message, index) in healthAdvice"
          :key="index"
          class="advice-item"
        >
          <Icon
            name="mdi:lightbulb-on"
            class="advice-icon"
          />
          {{ message }}
        </p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.monthly-health-summary {
  color: #666666;

  .header-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    gap: 1rem;
    flex-wrap: wrap;
  }

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  h4 {
    margin: 12px 0 12px 0;
    font-size: 14px;
    font-weight: 500;
  }
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.summary-item {
  background: #F5F5F5;
  border-radius: 8px;
  padding: 12px;
  text-align: center;

  &.highlight {
    background: linear-gradient(135deg, #4A90D9 0%, #6BA3E3 100%);
    color: white;

    .label,
    .value {
      color: white;
    }
  }

  .label {
    font-size: 11px;
    color: #666666;
    margin-bottom: 4px;
  }

  .value {
    font-size: 18px;
    font-weight: 700;
    color: #333333;
  }
}

.comments {
  .comment {
    margin: 8px 0;
    padding: 8px 12px;
    background: #F5F5F5;
    border-radius: 8px;
    font-size: 13px;
    color: #333333;
  }
}

.comparison-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.comparison-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 12px;
  background: #F5F5F5;
  border-left: 4px solid #999999;
  transition: all 0.2s ease;

  &.positive {
    background: linear-gradient(135deg, #E8F5E9 0%, #F1F8F2 100%);
    border-left-color: #4CAF50;

    .comparison-icon {
      color: #4CAF50;
    }

    .arrow-icon {
      color: #4CAF50;
    }
  }

  &.negative {
    background: linear-gradient(135deg, #FFEBEE 0%, #FFF3F4 100%);
    border-left-color: #F44336;

    .comparison-icon {
      color: #F44336;
    }

    .arrow-icon {
      color: #F44336;
    }
  }

  &.neutral {
    background: #F5F5F5;
    border-left-color: #999999;

    .comparison-icon {
      color: #999999;
    }
  }

  .comparison-icon {
    font-size: 28px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .comparison-content {
    flex: 1;
    min-width: 0;
  }

  .comparison-label {
    font-size: 12px;
    color: #666666;
    margin-bottom: 4px;
    font-weight: 500;
  }

  .comparison-value {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 18px;
    font-weight: 700;
    color: #333333;

    .arrow-icon {
      font-size: 20px;
      flex-shrink: 0;
    }

    .value-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.advice-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #E0E0E0;

  h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 500;
    color: #666666;
  }
}

.advice-list {
  .advice-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 8px 0;
    padding: 10px 12px;
    background: linear-gradient(135deg, #FFF9E6 0%, #FFFEF5 100%);
    border-radius: 8px;
    border-left: 3px solid #FFC107;
    font-size: 13px;
    color: #333333;
    line-height: 1.5;

    .advice-icon {
      color: #FFC107;
      font-size: 18px;
      flex-shrink: 0;
      margin-top: 2px;
    }
  }
}

@media (max-width: 480px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
