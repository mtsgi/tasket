<script setup lang="ts">
/**
 * 健康データ入力フォームコンポーネント
 * 日ごとのビューで健康データを入力・編集するためのフォーム
 */
import { useHealthDataStore } from '~/stores/healthData'
import type { HealthData } from '~/types/item'

const props = defineProps<{
  date: string // YYYY-MM-DD形式
}>()

const healthDataStore = useHealthDataStore()
const { $t } = useI18n()

// フォームの状態
const isExpanded = ref(false)
const isSaving = ref(false)

// 健康データのフォーム値
const weight = ref<number | undefined>()
const bodyFatPercentage = ref<number | undefined>()
const muscleMass = ref<number | undefined>()
const visceralFatLevel = ref<number | undefined>()
const basalMetabolicRate = ref<number | undefined>()
const systolicBloodPressure = ref<number | undefined>()
const diastolicBloodPressure = ref<number | undefined>()
const heartRate = ref<number | undefined>()
const bodyTemperature = ref<number | undefined>()
const spo2 = ref<number | undefined>()
const sleepHours = ref<number | undefined>()
const steps = ref<number | undefined>()
const exerciseMinutes = ref<number | undefined>()
const caloriesBurned = ref<number | undefined>()
const waterIntake = ref<number | undefined>()
const menstrualCycle = ref<'menstruation' | 'follicular' | 'ovulation' | 'luteal' | null>(null)
const medicationRecord = ref('')
const healthMemo = ref('')

// BMIの計算（身長は設定から取得する想定だが、ここでは簡易的に170cmと仮定）
const bmi = computed(() => {
  if (weight.value) {
    const heightInMeters = 1.7 // 170cm
    return (weight.value / (heightInMeters * heightInMeters)).toFixed(1)
  }
  return undefined
})

// コンポーネントマウント時に既存データを読み込む
onMounted(async () => {
  await healthDataStore.fetchHealthData()
  loadHealthData()
})

// 既存の健康データをフォームに読み込む
function loadHealthData() {
  const data = healthDataStore.getHealthDataByDateString(props.date)
  if (data) {
    weight.value = data.weight
    bodyFatPercentage.value = data.bodyFatPercentage
    muscleMass.value = data.muscleMass
    visceralFatLevel.value = data.visceralFatLevel
    basalMetabolicRate.value = data.basalMetabolicRate
    systolicBloodPressure.value = data.systolicBloodPressure
    diastolicBloodPressure.value = data.diastolicBloodPressure
    heartRate.value = data.heartRate
    bodyTemperature.value = data.bodyTemperature
    spo2.value = data.spo2
    sleepHours.value = data.sleepHours
    steps.value = data.steps
    exerciseMinutes.value = data.exerciseMinutes
    caloriesBurned.value = data.caloriesBurned
    waterIntake.value = data.waterIntake
    menstrualCycle.value = data.menstrualCycle || null
    medicationRecord.value = data.medicationRecord || ''
    healthMemo.value = data.healthMemo || ''
  }
}

// 健康データを保存
async function saveHealthData() {
  isSaving.value = true
  try {
    await healthDataStore.saveHealthDataItem({
      date: props.date,
      weight: weight.value,
      bodyFatPercentage: bodyFatPercentage.value,
      muscleMass: muscleMass.value,
      visceralFatLevel: visceralFatLevel.value,
      basalMetabolicRate: basalMetabolicRate.value,
      systolicBloodPressure: systolicBloodPressure.value,
      diastolicBloodPressure: diastolicBloodPressure.value,
      heartRate: heartRate.value,
      bodyTemperature: bodyTemperature.value,
      spo2: spo2.value,
      sleepHours: sleepHours.value,
      steps: steps.value,
      exerciseMinutes: exerciseMinutes.value,
      caloriesBurned: caloriesBurned.value,
      waterIntake: waterIntake.value,
      menstrualCycle: menstrualCycle.value,
      medicationRecord: medicationRecord.value,
      healthMemo: healthMemo.value,
    })
    alert($t('健康データを保存しました'))
  }
  catch (error) {
    console.error('Failed to save health data:', error)
    alert($t('健康データの保存に失敗しました'))
  }
  finally {
    isSaving.value = false
  }
}

// フォームの展開/折りたたみ
function toggleExpand() {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <div class="health-data-form">
    <div class="health-data-header" @click="toggleExpand">
      <h3>{{ $t('健康データ') }}</h3>
      <button class="toggle-btn" :class="{ expanded: isExpanded }">
        <Icon name="mdi:chevron-down" />
      </button>
    </div>

    <div v-if="isExpanded" class="health-data-body">
      <!-- 基本測定値 -->
      <div class="form-section">
        <h4>{{ $t('体重') }}・{{ $t('体脂肪率') }}</h4>
        <div class="form-row">
          <div class="form-group">
            <label>{{ $t('体重') }}</label>
            <input v-model.number="weight" type="number" step="0.1" :placeholder="$t('{value}kg', { value: '0.0' })" />
          </div>
          <div class="form-group">
            <label>{{ $t('体脂肪率') }}</label>
            <input v-model.number="bodyFatPercentage" type="number" step="0.1" :placeholder="$t('{value}%', { value: '0.0' })" />
          </div>
        </div>
        <div v-if="bmi" class="bmi-display">
          {{ $t('BMI') }}: {{ bmi }}
        </div>
      </div>

      <!-- その他の測定値 -->
      <div class="form-section">
        <h4>{{ $t('筋肉量') }}・{{ $t('内臓脂肪レベル') }}</h4>
        <div class="form-row">
          <div class="form-group">
            <label>{{ $t('筋肉量') }}</label>
            <input v-model.number="muscleMass" type="number" step="0.1" :placeholder="$t('{value}kg', { value: '0.0' })" />
          </div>
          <div class="form-group">
            <label>{{ $t('内臓脂肪レベル') }}</label>
            <input v-model.number="visceralFatLevel" type="number" step="1" placeholder="0" />
          </div>
        </div>
      </div>

      <!-- 血圧・心拍数 -->
      <div class="form-section">
        <h4>{{ $t('血圧') }}・{{ $t('心拍数') }}</h4>
        <div class="form-row">
          <div class="form-group">
            <label>{{ $t('最高血圧') }}</label>
            <input v-model.number="systolicBloodPressure" type="number" :placeholder="$t('{value}mmHg', { value: '0' })" />
          </div>
          <div class="form-group">
            <label>{{ $t('最低血圧') }}</label>
            <input v-model.number="diastolicBloodPressure" type="number" :placeholder="$t('{value}mmHg', { value: '0' })" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>{{ $t('心拍数') }}</label>
            <input v-model.number="heartRate" type="number" :placeholder="$t('{value}bpm', { value: '0' })" />
          </div>
        </div>
      </div>

      <!-- 活動量 -->
      <div class="form-section">
        <h4>{{ $t('活動量') }}</h4>
        <div class="form-row">
          <div class="form-group">
            <label>{{ $t('歩数') }}</label>
            <input v-model.number="steps" type="number" :placeholder="$t('{value}歩', { value: '0' })" />
          </div>
          <div class="form-group">
            <label>{{ $t('運動時間') }}</label>
            <input v-model.number="exerciseMinutes" type="number" :placeholder="$t('{value}分', { value: '0' })" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>{{ $t('睡眠時間') }}</label>
            <input v-model.number="sleepHours" type="number" step="0.5" :placeholder="$t('{value}時間', { value: '0.0' })" />
          </div>
          <div class="form-group">
            <label>{{ $t('水分摂取量') }}</label>
            <input v-model.number="waterIntake" type="number" :placeholder="$t('{value}ml', { value: '0' })" />
          </div>
        </div>
      </div>

      <!-- メモ -->
      <div class="form-section">
        <h4>{{ $t('体調メモ') }}</h4>
        <textarea v-model="healthMemo" :placeholder="$t('体調メモ')" rows="3" />
      </div>

      <!-- 保存ボタン -->
      <button class="save-btn" :disabled="isSaving" @click="saveHealthData">
        {{ isSaving ? $t('保存') + '...' : $t('保存') }}
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.health-data-form {
  background: var(--card-bg);
  border-radius: 12px;
  margin-bottom: 16px;
  overflow: hidden;
}

.health-data-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  cursor: pointer;
  user-select: none;

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .toggle-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s;

    &.expanded {
      transform: rotate(180deg);
    }

    svg {
      width: 24px;
      height: 24px;
    }
  }
}

.health-data-body {
  padding: 0 16px 16px;
}

.form-section {
  margin-bottom: 20px;

  h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-secondary);
  }
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
}

.form-group {
  label {
    display: block;
    margin-bottom: 4px;
    font-size: 12px;
    color: var(--text-secondary);
  }

  input,
  select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    font-size: 14px;
    background: var(--input-bg);
    color: var(--text-primary);

    &:focus {
      outline: none;
      border-color: var(--primary-color);
    }
  }
}

textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  background: var(--input-bg);
  color: var(--text-primary);
  resize: vertical;

  &:focus {
    outline: none;
    border-color: var(--primary-color);
  }
}

.bmi-display {
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-primary);
}

.save-btn {
  width: 100%;
  padding: 12px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
