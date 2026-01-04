<script setup lang="ts">
/**
 * 月次健康サマリーコンポーネント
 * 月ごとのビューで健康データの統計と先月との比較を表示
 */
import { useHealthDataStore } from '~/stores/healthData'
import { useItemsStore } from '~/stores/items'

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

// 健康コメントの生成
const healthComments = computed(() => {
  const summary = monthlySummary.value
  const comments: string[] = []

  // 体重の変化
  if (summary.weightChange !== undefined) {
    const direction = summary.weightChange > 0 ? $t('増加') : $t('減少')
    const absChange = Math.abs(summary.weightChange)
    comments.push($t('体重が先月比で{value}kg{direction}しました', { value: absChange.toFixed(1), direction }))
  }

  // 体脂肪率の変化
  if (summary.bodyFatChange !== undefined) {
    const direction = summary.bodyFatChange > 0 ? $t('増加') : $t('減少')
    const absChange = Math.abs(summary.bodyFatChange)
    comments.push($t('体脂肪率が先月比で{value}%{direction}しました', { value: absChange.toFixed(1), direction }))
  }

  // 筋肉量の変化
  if (summary.muscleMassChange !== undefined && Math.abs(summary.muscleMassChange) > 0.1) {
    const direction = summary.muscleMassChange > 0 ? $t('増加') : $t('減少')
    const absChange = Math.abs(summary.muscleMassChange)
    comments.push($t('筋肉量が先月比で{value}kg{direction}しました', { value: absChange.toFixed(1), direction }))
  }

  // 内臓脂肪レベルの変化
  if (summary.visceralFatLevelChange !== undefined && Math.abs(summary.visceralFatLevelChange) > 0.5) {
    const direction = summary.visceralFatLevelChange > 0 ? $t('増加') : $t('減少')
    const absChange = Math.abs(summary.visceralFatLevelChange)
    comments.push($t('内臓脂肪レベルが先月比で{value}{direction}しました', { value: absChange.toFixed(1), direction }))
  }

  // 心拍数の変化
  if (summary.heartRateChange !== undefined && Math.abs(summary.heartRateChange) > 2) {
    const direction = summary.heartRateChange > 0 ? $t('上昇') : $t('低下')
    const absChange = Math.abs(summary.heartRateChange)
    comments.push($t('平均心拍数が先月比で{value}bpm{direction}しました', { value: absChange.toFixed(0), direction }))
  }

  // 睡眠時間の変化
  if (summary.sleepHoursChange !== undefined && Math.abs(summary.sleepHoursChange) > 0.3) {
    const direction = summary.sleepHoursChange > 0 ? $t('増加') : $t('減少')
    const absChange = Math.abs(summary.sleepHoursChange)
    comments.push($t('平均睡眠時間が先月比で{value}時間{direction}しました', { value: absChange.toFixed(1), direction }))
  }

  // 歩数の変化
  if (summary.stepsChange !== undefined && Math.abs(summary.stepsChange) > 1000) {
    const direction = summary.stepsChange > 0 ? $t('増加') : $t('減少')
    const absChange = Math.abs(summary.stepsChange)
    comments.push($t('総歩数が先月比で{value}歩{direction}しました', { value: absChange.toFixed(0), direction }))
  }

  // 平均睡眠時間の評価
  if (summary.avgSleepHours !== undefined) {
    if (summary.avgSleepHours < 6) {
      comments.push($t('睡眠時間が不足気味です。健康のため、7-8時間の睡眠を心がけましょう'))
    }
    else if (summary.avgSleepHours >= 7 && summary.avgSleepHours <= 8) {
      comments.push($t('理想的な睡眠時間を確保できています'))
    }
  }

  // 歩数の評価
  if (summary.totalSteps !== undefined) {
    const avgStepsPerDay = summary.totalSteps / (summary.recordCount || 1)
    if (avgStepsPerDay >= 10000) {
      comments.push($t('1日平均{value}歩と、健康的な活動量を維持できています', { value: avgStepsPerDay.toFixed(0) }))
    }
    else if (avgStepsPerDay < 5000) {
      comments.push($t('歩数が少なめです。1日1万歩を目標に歩くことを心がけましょう'))
    }
  }

  return comments
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
    <h3>
      <Icon name="mdi:heart-pulse" />
      {{ $t('月次健康サマリー') }}
    </h3>

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
      v-if="healthComments.length > 0"
      class="comparison-section"
    >
      <h4>{{ $t('先月との比較') }}</h4>
      <div class="comments">
        <p
          v-for="(comment, index) in healthComments"
          :key="index"
          class="comment"
        >
          {{ comment }}
        </p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.monthly-health-summary {
  color: #666666;

  h3 {
    margin: 0 0 16px 0;
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

@media (max-width: 480px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
