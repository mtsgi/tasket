<script setup lang="ts">
/**
 * 健康データ入力フォームコンポーネント
 * 日ごとのビューで健康データを入力・編集するためのフォーム
 */
import type { HealthData } from '~/types/item'
import HealthDataPreviousRecord from './HealthDataPreviousRecord.vue'

const props = defineProps<{
  date: string // YYYY-MM-DD形式
}>()

const healthDataStore = useHealthDataStore()

// フォームの状態
const isExpanded = ref(false)
const isSaving = ref(false)

// 健康データのフォーム値
const weight = ref<number | undefined>()
const bodyFatPercentage = ref<number | undefined>()
const muscleMass = ref<number | undefined>()
const visceralFatLevel = ref<number | undefined>()
const basalMetabolicRate = ref<number | undefined>()
const bodyWaterPercentage = ref<number | undefined>()
const boneMass = ref<number | undefined>()
const proteinPercentage = ref<number | undefined>()
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

// 設定から身長を取得
const settingsStore = useSettingsStore()

type NumericFieldKey = keyof Pick<HealthData,
  | 'weight'
  | 'bodyFatPercentage'
  | 'muscleMass'
  | 'visceralFatLevel'
  | 'basalMetabolicRate'
  | 'bodyWaterPercentage'
  | 'boneMass'
  | 'proteinPercentage'
  | 'systolicBloodPressure'
  | 'diastolicBloodPressure'
  | 'heartRate'
  | 'steps'
  | 'exerciseMinutes'
  | 'sleepHours'
  | 'waterIntake'
>

const numericFieldFormats: Record<NumericFieldKey, { unit: string, fractionDigits: number }> = {
  weight: { unit: 'kg', fractionDigits: 1 },
  bodyFatPercentage: { unit: '%', fractionDigits: 1 },
  muscleMass: { unit: 'kg', fractionDigits: 1 },
  visceralFatLevel: { unit: '', fractionDigits: 0 },
  basalMetabolicRate: { unit: 'kcal/日', fractionDigits: 0 },
  bodyWaterPercentage: { unit: '%', fractionDigits: 1 },
  boneMass: { unit: 'kg', fractionDigits: 1 },
  proteinPercentage: { unit: '%', fractionDigits: 1 },
  systolicBloodPressure: { unit: 'mmHg', fractionDigits: 0 },
  diastolicBloodPressure: { unit: 'mmHg', fractionDigits: 0 },
  heartRate: { unit: 'bpm', fractionDigits: 0 },
  steps: { unit: '歩', fractionDigits: 0 },
  exerciseMinutes: { unit: '分', fractionDigits: 0 },
  sleepHours: { unit: '時間', fractionDigits: 1 },
  waterIntake: { unit: 'ml', fractionDigits: 0 },
}

const currentFieldValues = computed<Record<NumericFieldKey, number | undefined>>(() => ({
  weight: weight.value,
  bodyFatPercentage: bodyFatPercentage.value,
  muscleMass: muscleMass.value,
  visceralFatLevel: visceralFatLevel.value,
  basalMetabolicRate: basalMetabolicRate.value,
  bodyWaterPercentage: bodyWaterPercentage.value,
  boneMass: boneMass.value,
  proteinPercentage: proteinPercentage.value,
  systolicBloodPressure: systolicBloodPressure.value,
  diastolicBloodPressure: diastolicBloodPressure.value,
  heartRate: heartRate.value,
  steps: steps.value,
  exerciseMinutes: exerciseMinutes.value,
  sleepHours: sleepHours.value,
  waterIntake: waterIntake.value,
}))

const previousHealthData = computed(() => healthDataStore.getPreviousHealthDataByDateString(props.date))

function getPreviousValue(field: NumericFieldKey): number | undefined {
  return previousHealthData.value?.[field]
}

function getDiffValue(field: NumericFieldKey): number | undefined {
  const previousValue = getPreviousValue(field)
  const currentValue = currentFieldValues.value[field]
  if (previousValue === undefined || currentValue === undefined) {
    return undefined
  }
  return currentValue - previousValue
}

function formatFieldValue(field: NumericFieldKey, value: number): string {
  const format = numericFieldFormats[field]
  return `${value.toFixed(format.fractionDigits)}${format.unit}`
}

function formatPreviousValue(field: NumericFieldKey): string | undefined {
  const previousValue = getPreviousValue(field)
  if (previousValue === undefined) {
    return undefined
  }
  return formatFieldValue(field, previousValue)
}

function formatDiffValue(field: NumericFieldKey): string | undefined {
  const diffValue = getDiffValue(field)
  if (diffValue === undefined) {
    return undefined
  }
  const format = numericFieldFormats[field]
  const sign = diffValue > 0 ? '+' : ''
  return `${sign}${diffValue.toFixed(format.fractionDigits)}${format.unit}`
}

function getDiffClass(field: NumericFieldKey): string {
  const diffValue = getDiffValue(field)
  if (diffValue === undefined) {
    return ''
  }
  if (diffValue > 0) {
    return 'diff-positive'
  }
  if (diffValue < 0) {
    return 'diff-negative'
  }
  return 'diff-neutral'
}

// BMIの計算（設定された身長を使用、設定がない場合は170cmをデフォルトとする）
const bmi = computed(() => {
  if (weight.value) {
    const heightCm = settingsStore.height || 170
    const heightInMeters = heightCm / 100
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
    bodyWaterPercentage.value = data.bodyWaterPercentage
    boneMass.value = data.boneMass
    proteinPercentage.value = data.proteinPercentage
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
      bodyWaterPercentage: bodyWaterPercentage.value,
      boneMass: boneMass.value,
      proteinPercentage: proteinPercentage.value,
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
  <div class="health-data-form card">
    <div
      class="health-data-header"
      @click="toggleExpand"
    >
      <h3>
        <Icon name="mdi:heart-pulse" />
        {{ $t('健康データ') }}
      </h3>
      <button
        class="toggle-btn"
        :class="{ expanded: isExpanded }"
      >
        <Icon name="mdi:chevron-down" />
      </button>
    </div>

    <div
      v-if="isExpanded"
      class="health-data-body"
    >
      <!-- 基本測定値 -->
      <div class="form-section">
        <h4>{{ $t('体重') }}・{{ $t('体脂肪率') }}</h4>
        <div class="form-row">
          <div class="form-group">
            <label>{{ $t('体重') }}</label>
            <UiInput
              v-model.number="weight"
              type="number"
              :placeholder="$t('{value}kg', { value: '0.0' })"
            />
            <HealthDataPreviousRecord
              :previous-value="getPreviousValue('weight')"
              :formatted-previous-value="formatPreviousValue('weight')"
              :formatted-diff-value="formatDiffValue('weight')"
              :diff-class="getDiffClass('weight')"
            />
          </div>
          <div class="form-group">
            <label>{{ $t('体脂肪率') }}</label>
            <UiInput
              v-model.number="bodyFatPercentage"
              type="number"
              :placeholder="$t('{value}%', { value: '0.0' })"
            />
            <HealthDataPreviousRecord
              :previous-value="getPreviousValue('bodyFatPercentage')"
              :formatted-previous-value="formatPreviousValue('bodyFatPercentage')"
              :formatted-diff-value="formatDiffValue('bodyFatPercentage')"
              :diff-class="getDiffClass('bodyFatPercentage')"
            />
          </div>
        </div>
        <div
          v-if="bmi"
          class="bmi-display"
        >
          {{ $t('BMI') }}: {{ bmi }}
        </div>
      </div>

      <!-- その他の測定値 -->
      <div class="form-section">
        <h4>{{ $t('筋肉量') }}・{{ $t('内臓脂肪レベル') }}</h4>
        <div class="form-row">
          <div class="form-group">
            <label>{{ $t('筋肉量') }}</label>
            <UiInput
              v-model.number="muscleMass"
              type="number"
              :placeholder="$t('{value}kg', { value: '0.0' })"
            />
            <HealthDataPreviousRecord
              :previous-value="getPreviousValue('muscleMass')"
              :formatted-previous-value="formatPreviousValue('muscleMass')"
              :formatted-diff-value="formatDiffValue('muscleMass')"
              :diff-class="getDiffClass('muscleMass')"
            />
          </div>
          <div class="form-group">
            <label>{{ $t('内臓脂肪レベル') }}</label>
            <UiInput
              v-model="visceralFatLevel"
              type="number"
              placeholder="0"
            />
            <HealthDataPreviousRecord
              :previous-value="getPreviousValue('visceralFatLevel')"
              :formatted-previous-value="formatPreviousValue('visceralFatLevel')"
              :formatted-diff-value="formatDiffValue('visceralFatLevel')"
              :diff-class="getDiffClass('visceralFatLevel')"
            />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>{{ $t('基礎代謝率') }}</label>
            <UiInput
              v-model="basalMetabolicRate"
              type="number"
              :placeholder="$t('{value}kcal/日', { value: '0' })"
            />
            <HealthDataPreviousRecord
              :previous-value="getPreviousValue('basalMetabolicRate')"
              :formatted-previous-value="formatPreviousValue('basalMetabolicRate')"
              :formatted-diff-value="formatDiffValue('basalMetabolicRate')"
              :diff-class="getDiffClass('basalMetabolicRate')"
            />
          </div>
        </div>
      </div>

      <!-- 体組成 -->
      <div class="form-section">
        <h4>{{ $t('体組成') }}</h4>
        <div class="form-row">
          <div class="form-group">
            <label>{{ $t('体内水分率') }}</label>
            <UiInput
              v-model.number="bodyWaterPercentage"
              type="number"
              :placeholder="$t('{value}%', { value: '0.0' })"
            />
            <HealthDataPreviousRecord
              :previous-value="getPreviousValue('bodyWaterPercentage')"
              :formatted-previous-value="formatPreviousValue('bodyWaterPercentage')"
              :formatted-diff-value="formatDiffValue('bodyWaterPercentage')"
              :diff-class="getDiffClass('bodyWaterPercentage')"
            />
          </div>
          <div class="form-group">
            <label>{{ $t('骨塩量') }}</label>
            <UiInput
              v-model.number="boneMass"
              type="number"
              :placeholder="$t('{value}kg', { value: '0.0' })"
            />
            <HealthDataPreviousRecord
              :previous-value="getPreviousValue('boneMass')"
              :formatted-previous-value="formatPreviousValue('boneMass')"
              :formatted-diff-value="formatDiffValue('boneMass')"
              :diff-class="getDiffClass('boneMass')"
            />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>{{ $t('タンパク質') }}</label>
            <UiInput
              v-model.number="proteinPercentage"
              type="number"
              :placeholder="$t('{value}%', { value: '0.0' })"
            />
            <HealthDataPreviousRecord
              :previous-value="getPreviousValue('proteinPercentage')"
              :formatted-previous-value="formatPreviousValue('proteinPercentage')"
              :formatted-diff-value="formatDiffValue('proteinPercentage')"
              :diff-class="getDiffClass('proteinPercentage')"
            />
          </div>
        </div>
      </div>

      <!-- 血圧・心拍数 -->
      <div class="form-section">
        <h4>{{ $t('血圧') }}・{{ $t('心拍数') }}</h4>
        <div class="form-row">
          <div class="form-group">
            <label>{{ $t('最高血圧') }}</label>
            <UiInput
              v-model="systolicBloodPressure"
              type="number"
              :placeholder="$t('{value}mmHg', { value: '0' })"
            />
            <HealthDataPreviousRecord
              :previous-value="getPreviousValue('systolicBloodPressure')"
              :formatted-previous-value="formatPreviousValue('systolicBloodPressure')"
              :formatted-diff-value="formatDiffValue('systolicBloodPressure')"
              :diff-class="getDiffClass('systolicBloodPressure')"
            />
          </div>
          <div class="form-group">
            <label>{{ $t('最低血圧') }}</label>
            <UiInput
              v-model="diastolicBloodPressure"
              type="number"
              :placeholder="$t('{value}mmHg', { value: '0' })"
            />
            <HealthDataPreviousRecord
              :previous-value="getPreviousValue('diastolicBloodPressure')"
              :formatted-previous-value="formatPreviousValue('diastolicBloodPressure')"
              :formatted-diff-value="formatDiffValue('diastolicBloodPressure')"
              :diff-class="getDiffClass('diastolicBloodPressure')"
            />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>{{ $t('心拍数') }}</label>
            <UiInput
              v-model="heartRate"
              type="number"
              :placeholder="$t('{value}bpm', { value: '0' })"
            />
            <HealthDataPreviousRecord
              :previous-value="getPreviousValue('heartRate')"
              :formatted-previous-value="formatPreviousValue('heartRate')"
              :formatted-diff-value="formatDiffValue('heartRate')"
              :diff-class="getDiffClass('heartRate')"
            />
          </div>
        </div>
      </div>

      <!-- 活動量 -->
      <div class="form-section">
        <h4>{{ $t('活動量') }}</h4>
        <div class="form-row">
          <div class="form-group">
            <label>{{ $t('歩数') }}</label>
            <UiInput
              v-model="steps"
              type="number"
              :placeholder="$t('{value}歩', { value: '0' })"
            />
            <HealthDataPreviousRecord
              :previous-value="getPreviousValue('steps')"
              :formatted-previous-value="formatPreviousValue('steps')"
              :formatted-diff-value="formatDiffValue('steps')"
              :diff-class="getDiffClass('steps')"
            />
          </div>
          <div class="form-group">
            <label>{{ $t('運動時間') }}</label>
            <UiInput
              v-model="exerciseMinutes"
              type="number"
              :placeholder="$t('{value}分', { value: '0' })"
            />
            <HealthDataPreviousRecord
              :previous-value="getPreviousValue('exerciseMinutes')"
              :formatted-previous-value="formatPreviousValue('exerciseMinutes')"
              :formatted-diff-value="formatDiffValue('exerciseMinutes')"
              :diff-class="getDiffClass('exerciseMinutes')"
            />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>{{ $t('睡眠時間') }}</label>
            <UiInput
              v-model="sleepHours"
              type="number"
              :placeholder="$t('{value}時間', { value: '0.0' })"
            />
            <HealthDataPreviousRecord
              :previous-value="getPreviousValue('sleepHours')"
              :formatted-previous-value="formatPreviousValue('sleepHours')"
              :formatted-diff-value="formatDiffValue('sleepHours')"
              :diff-class="getDiffClass('sleepHours')"
            />
          </div>
          <div class="form-group">
            <label>{{ $t('水分摂取量') }}</label>
            <UiInput
              v-model="waterIntake"
              type="number"
              :placeholder="$t('{value}ml', { value: '0' })"
            />
            <HealthDataPreviousRecord
              :previous-value="getPreviousValue('waterIntake')"
              :formatted-previous-value="formatPreviousValue('waterIntake')"
              :formatted-diff-value="formatDiffValue('waterIntake')"
              :diff-class="getDiffClass('waterIntake')"
            />
          </div>
        </div>
      </div>

      <!-- メモ -->
      <div class="form-section">
        <h4>{{ $t('体調メモ') }}</h4>
        <textarea
          v-model="healthMemo"
          :placeholder="$t('体調メモ')"
          rows="3"
        />
      </div>

      <!-- 保存ボタン -->
      <UiButton
        variant="primary"
        block
        :disabled="isSaving"
        @click="saveHealthData"
      >
        {{ isSaving ? $t('保存') + '...' : $t('保存') }}
      </UiButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.health-data-form {
  overflow: hidden;
}

.health-data-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;

  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #666666;
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
  margin-top: 16px;
  padding: 0 8px 16px;

  .ui-btn {
    margin-top: 16px;
  }
}

.form-section {
  h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 500;
    color: #666666;
  }
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

}

.form-group {
  label {
    display: block;
    margin-bottom: 4px;
    font-size: 12px;
    color: #666666;
  }
}

textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #E0E0E0;
  border-radius: 8px;
  font-size: 14px;
  background: #FFFFFF;
  color: #333333;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: #4A90D9;
  }
}

.bmi-display {
  margin-bottom: 8px;
  padding: 8px 12px;
  background: #F5F5F5;
  border-radius: 8px;
  font-size: 14px;
  color: #333333;
}
</style>
