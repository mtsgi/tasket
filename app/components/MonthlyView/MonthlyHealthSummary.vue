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
const { $t } = useI18n()

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

  if (summary.weightChange !== undefined) {
    const direction = summary.weightChange > 0 ? $t('増加') : $t('減少')
    const absChange = Math.abs(summary.weightChange)
    comments.push($t('体重が先月比で{value}kg{direction}しました', { value: absChange.toFixed(1), direction }))
  }

  if (summary.bodyFatChange !== undefined) {
    const direction = summary.bodyFatChange > 0 ? $t('増加') : $t('減少')
    const absChange = Math.abs(summary.bodyFatChange)
    comments.push($t('体脂肪率が先月比で{value}%{direction}しました', { value: absChange.toFixed(1), direction }))
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
  <div v-if="hasData" class="monthly-health-summary">
    <h3>{{ $t('月次健康サマリー') }}</h3>

    <div class="summary-grid">
      <!-- 記録日数 -->
      <div class="summary-item">
        <div class="label">{{ $t('記録日数') }}</div>
        <div class="value">{{ monthlySummary.recordCount }}{{ $t('日') }}</div>
      </div>

      <!-- 平均体重 -->
      <div v-if="monthlySummary.avgWeight" class="summary-item">
        <div class="label">{{ $t('平均体重') }}</div>
        <div class="value">{{ $t('{value}kg', { value: monthlySummary.avgWeight.toFixed(1) }) }}</div>
      </div>

      <!-- 平均体脂肪率 -->
      <div v-if="monthlySummary.avgBodyFatPercentage" class="summary-item">
        <div class="label">{{ $t('平均体脂肪率') }}</div>
        <div class="value">{{ $t('{value}%', { value: monthlySummary.avgBodyFatPercentage.toFixed(1) }) }}</div>
      </div>

      <!-- 合計歩数 -->
      <div v-if="monthlySummary.totalSteps" class="summary-item">
        <div class="label">{{ $t('合計歩数') }}</div>
        <div class="value">{{ $t('{value}歩', { value: monthlySummary.totalSteps.toLocaleString() }) }}</div>
      </div>

      <!-- 合計運動時間 -->
      <div v-if="monthlySummary.totalExerciseMinutes" class="summary-item">
        <div class="label">{{ $t('合計運動時間') }}</div>
        <div class="value">{{ $t('{value}分', { value: monthlySummary.totalExerciseMinutes }) }}</div>
      </div>

      <!-- 合計摂取カロリー -->
      <div v-if="totalCalories > 0" class="summary-item highlight">
        <div class="label">{{ $t('合計摂取カロリー') }}</div>
        <div class="value">{{ $t('{value}kcal', { value: totalCalories.toLocaleString() }) }}</div>
      </div>
    </div>

    <!-- 先月との比較 -->
    <div v-if="healthComments.length > 0" class="comparison-section">
      <h4>{{ $t('先月との比較') }}</h4>
      <div class="comments">
        <p v-for="(comment, index) in healthComments" :key="index" class="comment">
          {{ comment }}
        </p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.monthly-health-summary {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;

  h3 {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
  }

  h4 {
    margin: 20px 0 12px 0;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-secondary);
  }
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.summary-item {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 12px;
  text-align: center;

  &.highlight {
    background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-light) 100%);
    color: white;

    .label,
    .value {
      color: white;
    }
  }

  .label {
    font-size: 11px;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }

  .value {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
  }
}

.comparison-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.comments {
  .comment {
    margin: 8px 0;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-radius: 8px;
    font-size: 13px;
    color: var(--text-primary);
  }
}

@media (max-width: 480px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
