<script setup lang="ts">
/**
 * 健康データ入力フォームコンポーネント
 * 日ごとのビューで健康データを入力・編集するためのフォーム
 */
import type { HealthData, SleepSession } from '~/types/item'
import HealthDataPreviousRecord from './HealthDataPreviousRecord.vue'
import {
  calculateSleepSessionMinutes,
  calculateTotalSleepHours,
  extractTimeHHmm,
  normalizeSleepSessionsForDate,
} from '~/utils/sleepSessions'
import { isAndroidNativeApp } from '~/utils/healthConnect'

const props = defineProps<{
  date: string // YYYY-MM-DD形式
}>()

const healthDataStore = useHealthDataStore()
const settingsStore = useSettingsStore()
const { t } = useI18n()

// フォームの状態
const isExpanded = ref(false)
const isSaving = ref(false)
const isSyncingFromHC = ref(false)
const isWritingToHC = ref(false)

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
const sleepSessionsDraft = ref<SleepSession[]>([])
const steps = ref<number | undefined>()
const exerciseMinutes = ref<number | undefined>()
const caloriesBurned = ref<number | undefined>()
const waterIntake = ref<number | undefined>()
const menstrualCycle = ref<'menstruation' | 'follicular' | 'ovulation' | 'luteal' | null>(null)
const medicationRecord = ref('')
const healthMemo = ref('')

// Android版かつHealth Connect連携ONの場合のみ同期ボタンを表示
const showHealthConnectActions = computed(() => {
  return isAndroidNativeApp() && settingsStore.healthConnectSettings?.enabled
})

// 入力中の睡眠セッションから計算された合計睡眠時間
const calculatedSleepHoursFromSessions = computed(() => {
  return calculateTotalSleepHours(sleepSessionsDraft.value, props.date)
})

const hasValidSleepSessions = computed(() => {
  return calculatedSleepHoursFromSessions.value !== undefined
})

// 睡眠セッションの有効な入力がある場合はsleepHoursを自動計算して反映
watch(
  calculatedSleepHoursFromSessions,
  (newHours) => {
    if (newHours !== undefined) {
      sleepHours.value = newHours
    }
  },
)

/**
 * 睡眠セッション行を追加
 */
function addSleepSession() {
  sleepSessionsDraft.value.push({
    startTime: '',
    endTime: '',
  })
}

/**
 * 睡眠セッション行を削除
 */
function removeSleepSession(index: number) {
  sleepSessionsDraft.value.splice(index, 1)
  if (sleepSessionsDraft.value.length === 0) {
    sleepHours.value = undefined
  }
}

/**
 * 各睡眠セッション行の時間表示（例: 7.5時間）
 */
function formatSessionDuration(session: SleepSession): string {
  const minutes = calculateSleepSessionMinutes(session, props.date)
  if (minutes <= 0) {
    return ''
  }
  const hours = (minutes / 60).toFixed(1)
  return t('{value}時間', { value: hours })
}

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

// 日付変更時にフォームを再読み込み
watch(
  () => props.date,
  () => {
    loadHealthData()
  },
)

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
    sleepSessionsDraft.value = (data.sleepSessions || []).map(session => ({
      startTime: extractTimeHHmm(session.startTime),
      endTime: extractTimeHHmm(session.endTime),
    }))
    sleepHours.value = data.sleepHours
    steps.value = data.steps
    exerciseMinutes.value = data.exerciseMinutes
    caloriesBurned.value = data.caloriesBurned
    waterIntake.value = data.waterIntake
    menstrualCycle.value = data.menstrualCycle || null
    medicationRecord.value = data.medicationRecord || ''
    healthMemo.value = data.healthMemo || ''
  }
  else {
    weight.value = undefined
    bodyFatPercentage.value = undefined
    muscleMass.value = undefined
    visceralFatLevel.value = undefined
    basalMetabolicRate.value = undefined
    bodyWaterPercentage.value = undefined
    boneMass.value = undefined
    proteinPercentage.value = undefined
    systolicBloodPressure.value = undefined
    diastolicBloodPressure.value = undefined
    heartRate.value = undefined
    bodyTemperature.value = undefined
    spo2.value = undefined
    sleepSessionsDraft.value = []
    sleepHours.value = undefined
    steps.value = undefined
    exerciseMinutes.value = undefined
    caloriesBurned.value = undefined
    waterIntake.value = undefined
    menstrualCycle.value = null
    medicationRecord.value = ''
    healthMemo.value = ''
  }
}

/**
 * 現在のフォーム入力値から保存用ペイロードを構築
 */
function buildFormPayload(): Partial<HealthData> & { date: string } {
  const normalizedSessions = normalizeSleepSessionsForDate(props.date, sleepSessionsDraft.value)
  const effectiveSleepHours = normalizedSessions.length > 0
    ? calculateTotalSleepHours(normalizedSessions, props.date)
    : sleepHours.value

  return {
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
    sleepHours: effectiveSleepHours,
    sleepSessions: normalizedSessions,
    steps: steps.value,
    exerciseMinutes: exerciseMinutes.value,
    caloriesBurned: caloriesBurned.value,
    waterIntake: waterIntake.value,
    menstrualCycle: menstrualCycle.value,
    medicationRecord: medicationRecord.value,
    healthMemo: healthMemo.value,
  }
}

// 健康データをローカル（IndexedDB）へ保存
async function saveHealthData() {
  isSaving.value = true
  try {
    await healthDataStore.saveHealthDataItem(buildFormPayload())
    loadHealthData()
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

/**
 * Health Connectから当日の健康データを取得してIndexedDBへ即時保存＋フォーム反映
 */
async function handleReadFromHealthConnect() {
  isSyncingFromHC.value = true
  try {
    const result = await healthDataStore.syncDateFromHealthConnect(props.date)
    await settingsStore.updateHealthConnectSettings({
      lastSyncedAt: new Date().toISOString(),
    })
    loadHealthData()

    if (result.updatedFields.length > 0) {
      alert($t('Health Connectからデータを取得して保存しました'))
    }
    else {
      alert($t('Health Connectに反映可能な新しいデータがありませんでした'))
    }
  }
  catch (error) {
    console.error('Failed to read from Health Connect:', error)
    alert($t('Health Connectからのデータ取得に失敗しました'))
  }
  finally {
    isSyncingFromHC.value = false
  }
}

/**
 * 現在のフォーム入力値をIndexedDBへ保存した上で、新規・変更項目をHealth Connectへ書き込む
 */
async function handleWriteToHealthConnect() {
  isWritingToHC.value = true
  try {
    const result = await healthDataStore.writeDateToHealthConnect(buildFormPayload())
    await settingsStore.updateHealthConnectSettings({
      lastSyncedAt: new Date().toISOString(),
    })
    loadHealthData()

    if (result.nothingToWrite) {
      alert($t('ローカル保存が完了しました（Health Connectへ書き込む新規・変更データはありません）'))
    }
    else if (result.writtenFields.length > 0) {
      alert($t('健康データを保存し、Health Connectへ書き込みました'))
    }
    else {
      alert($t('ローカル保存は完了しましたが、Health Connectの書き込み権限が許可されていないため書き込みをスキップしました'))
    }
  }
  catch (error) {
    console.error('Failed to write to Health Connect:', error)
    alert($t('Health Connectへの書き込みに失敗しました'))
  }
  finally {
    isWritingToHC.value = false
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
      <!-- Health Connect 双方向連携アクション（Android版かつ連携ON時のみ表示） -->
      <div
        v-if="showHealthConnectActions"
        class="health-connect-actions"
      >
        <div class="hc-actions-title">
          <Icon name="mdi:sync" />
          <span>Health Connect</span>
        </div>
        <div class="hc-actions-buttons">
          <UiButton
            variant="secondary"
            :disabled="isSyncingFromHC || isWritingToHC || isSaving"
            @click="handleReadFromHealthConnect"
          >
            <Icon name="mdi:cloud-download-outline" />
            {{ isSyncingFromHC ? $t('取得中') + '...' : $t('Health Connectから取得') }}
          </UiButton>
          <UiButton
            variant="secondary"
            :disabled="isSyncingFromHC || isWritingToHC || isSaving"
            @click="handleWriteToHealthConnect"
          >
            <Icon name="mdi:cloud-upload-outline" />
            {{ isWritingToHC ? $t('書き込み中') + '...' : $t('Health Connectへ書き込み') }}
          </UiButton>
        </div>
      </div>

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

      <!-- 心拍数（最高血圧・最低血圧のフォーム入力は非表示） -->
      <div class="form-section">
        <h4>{{ $t('心拍数') }}</h4>
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
              :disabled="hasValidSleepSessions"
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

        <!-- 睡眠セッション（開始・終了時刻の複数件管理） -->
        <div class="sleep-sessions-box">
          <div class="sleep-sessions-header">
            <label class="sleep-sessions-label">
              <Icon name="mdi:sleep" />
              {{ $t('睡眠セッション（開始・終了時刻）') }}
            </label>
            <button
              type="button"
              class="add-session-btn"
              @click="addSleepSession"
            >
              <Icon name="mdi:plus" />
              {{ $t('睡眠時間帯を追加') }}
            </button>
          </div>
          <p class="sleep-sessions-hint">
            {{ $t('開始時刻が終了時刻より後の場合（例: 23:30〜07:00）は前日夜〜当日朝として合計時間を自動計算します') }}
          </p>

          <div
            v-if="sleepSessionsDraft.length > 0"
            class="sleep-sessions-list"
          >
            <div
              v-for="(session, idx) in sleepSessionsDraft"
              :key="idx"
              class="sleep-session-row"
            >
              <div class="time-input-field">
                <span class="time-label">{{ $t('就寝') }}</span>
                <input
                  v-model="session.startTime"
                  type="time"
                  class="time-input"
                  :aria-label="$t('就寝')"
                >
              </div>
              <span class="time-separator">〜</span>
              <div class="time-input-field">
                <span class="time-label">{{ $t('起床') }}</span>
                <input
                  v-model="session.endTime"
                  type="time"
                  class="time-input"
                  :aria-label="$t('起床')"
                >
              </div>
              <span
                v-if="formatSessionDuration(session)"
                class="session-duration-badge"
              >
                {{ formatSessionDuration(session) }}
              </span>
              <button
                type="button"
                class="remove-session-btn"
                :aria-label="$t('削除')"
                @click="removeSleepSession(idx)"
              >
                <Icon name="mdi:close" />
              </button>
            </div>
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

      <!-- 保存ボタン（ローカル保存のみ） -->
      <UiButton
        variant="primary"
        block
        :disabled="isSaving || isSyncingFromHC || isWritingToHC"
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

.health-connect-actions {
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(74, 144, 217, 0.08);
  border: 1px solid rgba(74, 144, 217, 0.25);
  border-radius: 8px;

  .hc-actions-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: #4A90D9;
    margin-bottom: 8px;
  }

  .hc-actions-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;

    :deep(.ui-btn) {
      margin-top: 0;
      font-size: 12px;
      padding: 8px 10px;
    }
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

.sleep-sessions-box {
  margin-bottom: 16px;
  padding: 12px;
  background: #F8F9FA;
  border: 1px solid #E0E0E0;
  border-radius: 8px;

  .dark-mode & {
    background: #222222;
    border-color: #444444;
  }

  .sleep-sessions-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
    flex-wrap: wrap;
  }

  .sleep-sessions-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: #555555;

    .dark-mode & {
      color: #e0e0e0;
    }
  }

  .add-session-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 500;
    color: #4A90D9;
    background: #FFFFFF;
    border: 1px solid #4A90D9;
    border-radius: 6px;
    cursor: pointer;

    .dark-mode & {
      background: #2a2a2a;
    }
  }

  .sleep-sessions-hint {
    font-size: 11px;
    color: #777777;
    margin: 0 0 8px 0;
    line-height: 1.4;

    .dark-mode & {
      color: #b0b0b0;
    }
  }

  .sleep-sessions-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sleep-session-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .time-input-field {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 110px;

    .time-label {
      font-size: 11px;
      color: #666666;
      white-space: nowrap;

      .dark-mode & {
        color: #b0b0b0;
      }
    }

    .time-input {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #E0E0E0;
      border-radius: 6px;
      font-size: 13px;
      background: #FFFFFF;
      color: #333333;

      .dark-mode & {
        background: #2a2a2a;
        border-color: #444444;
        color: #e0e0e0;
      }
    }
  }

  .time-separator {
    font-size: 12px;
    color: #666666;
  }

  .session-duration-badge {
    font-size: 11px;
    font-weight: 600;
    color: #4A90D9;
    background: rgba(74, 144, 217, 0.12);
    padding: 3px 8px;
    border-radius: 12px;
    white-space: nowrap;
  }

  .remove-session-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: none;
    border: 1px solid #E0E0E0;
    border-radius: 6px;
    color: #f44336;
    cursor: pointer;

    .dark-mode & {
      border-color: #444444;
    }
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

@media (max-width: 480px) {
  .health-connect-actions .hc-actions-buttons {
    grid-template-columns: 1fr;
  }
}
</style>
