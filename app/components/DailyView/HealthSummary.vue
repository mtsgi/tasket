<script setup lang="ts">
/**
 * 日次健康サマリーコンポーネント
 * 日ごとのビューで健康データと摂取カロリーを表示
 */
import { useHealthDataStore } from '~/stores/healthData'
import { useItemsStore } from '~/stores/items'

const props = defineProps<{
  date: string // YYYY-MM-DD形式
}>()

const healthDataStore = useHealthDataStore()
const itemsStore = useItemsStore()
const { $t } = useI18n()

// その日の健康データ
const healthData = computed(() => {
  return healthDataStore.getHealthDataByDateString(props.date)
})

// その日の摂取カロリー
const totalCalories = computed(() => {
  return itemsStore.getTotalCaloriesByDate(props.date)
})

// その日の食事ログ数
const mealCount = computed(() => {
  return itemsStore.getMealItemsByDate(props.date).length
})

// データがあるかどうか
const hasData = computed(() => {
  return healthData.value !== undefined || totalCalories.value > 0
})
</script>

<template>
  <div v-if="hasData" class="health-summary">
    <h3>{{ $t('本日の健康データ') }}</h3>
    
    <div class="summary-grid">
      <!-- 体重 -->
      <div v-if="healthData?.weight" class="summary-item">
        <div class="label">{{ $t('体重') }}</div>
        <div class="value">{{ $t('{value}kg', { value: healthData.weight.toFixed(1) }) }}</div>
      </div>

      <!-- 体脂肪率 -->
      <div v-if="healthData?.bodyFatPercentage" class="summary-item">
        <div class="label">{{ $t('体脂肪率') }}</div>
        <div class="value">{{ $t('{value}%', { value: healthData.bodyFatPercentage.toFixed(1) }) }}</div>
      </div>

      <!-- 摂取カロリー -->
      <div v-if="totalCalories > 0" class="summary-item highlight">
        <div class="label">{{ $t('摂取カロリー') }}</div>
        <div class="value">{{ $t('{value}kcal', { value: totalCalories }) }}</div>
        <div v-if="mealCount > 0" class="sub-text">{{ mealCount }}回の食事</div>
      </div>

      <!-- 歩数 -->
      <div v-if="healthData?.steps" class="summary-item">
        <div class="label">{{ $t('歩数') }}</div>
        <div class="value">{{ $t('{value}歩', { value: healthData.steps.toLocaleString() }) }}</div>
      </div>

      <!-- 睡眠時間 -->
      <div v-if="healthData?.sleepHours" class="summary-item">
        <div class="label">{{ $t('睡眠時間') }}</div>
        <div class="value">{{ $t('{value}時間', { value: healthData.sleepHours.toFixed(1) }) }}</div>
      </div>

      <!-- 運動時間 -->
      <div v-if="healthData?.exerciseMinutes" class="summary-item">
        <div class="label">{{ $t('運動時間') }}</div>
        <div class="value">{{ $t('{value}分', { value: healthData.exerciseMinutes }) }}</div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.health-summary {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;

  h3 {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
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
    .value,
    .sub-text {
      color: white;
    }
  }

  .label {
    font-size: 11px;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }

  .value {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .sub-text {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.8);
    margin-top: 2px;
  }
}

@media (max-width: 480px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
