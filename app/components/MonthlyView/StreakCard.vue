<script setup lang="ts">
import { useStreakStore } from '~/stores/streak'
import { useHealthDataStore } from '~/stores/healthData'
import { useItemsStore } from '~/stores/items'
import { useRoutinesStore } from '~/stores/routines'
import { calculateStreak } from '~/utils/streak'

const props = defineProps<{ yearMonth: string }>()
const streakStore = useStreakStore()
const { t } = useI18n()
const loadError = ref(false)
const categories = [
  { id: 'usage', label: 'Tasket利用', icon: '🔥' },
  { id: 'overall', label: '総合記録', icon: '📝' },
  { id: 'health', label: '健康データ', icon: '💚' },
  { id: 'routine', label: '日課達成', icon: '✅' },
]
const details = [
  { id: 'weight', label: '体重記録', icon: '⚖️' },
  { id: 'sleep', label: '睡眠記録', icon: '😴' },
  { id: 'bloodPressure', label: '血圧記録', icon: '❤️' },
  { id: 'steps', label: '歩数記録', icon: '🚶' },
  { id: 'todo', label: 'TODO記録', icon: '📋' },
  { id: 'expense', label: '収支記録', icon: '💰' },
  { id: 'meal', label: '食事記録', icon: '🍽️' },
]
const rows = computed(() => {
  const dates: Record<string, string[]> = {
    ...streakStore.recordDates,
    usage: streakStore.dailyActivities.map(activity => activity.date),
  }
  return [...categories, ...details].map(category => ({
    ...category,
    ...calculateStreak(dates[category.id] ?? [], streakStore.today, props.yearMonth),
  }))
})
const recentDays = computed(() => streakStore.usage.recentDays)

async function loadRecords() {
  loadError.value = false
  try {
    await Promise.all([
      streakStore.refreshHistory(),
      useHealthDataStore().fetchHealthData(),
      useItemsStore().fetchItems(),
      useRoutinesStore().fetchAllRoutineLogs(),
    ])
    loadError.value = Boolean(useHealthDataStore().error || useItemsStore().error)
  }
  catch {
    loadError.value = true
  }
}
onMounted(loadRecords)

async function retryRecords() {
  await loadRecords()
  await streakStore.checkIn()
}
</script>

<template>
  <section class="streak-card">
    <h2>🔥 {{ t('連続記録') }}</h2>
    <p class="streak-card__hint">
      {{ t('今日の記録状況') }} · {{ streakStore.today }}
    </p>
    <p
      v-if="loadError || streakStore.error"
      role="alert"
    >
      {{ t('連続記録を読み込めませんでした') }}
      <button
        class="btn btn-secondary btn-small"
        @click="retryRecords"
      >
        {{ t('再読み込み') }}
      </button>
    </p>
    <div class="streak-card__table">
      <div class="streak-card__row streak-card__head">
        <span>{{ t('カテゴリ') }}</span>
        <span>{{ t('連続') }}</span>
        <span>🏆 {{ t('最長') }}</span>
        <span>{{ t('この月') }}</span>
      </div>
      <div
        v-for="row in rows.slice(0, categories.length)"
        :key="row.id"
        class="streak-card__row"
      >
        <span>
          {{ row.icon }} {{ t(row.label) }}
          <span
            v-if="row.recordedToday"
            class="streak-card__done"
            :aria-label="t('今日の記録済み')"
          >✓</span>
        </span>
        <strong>{{ t('{count}日', { count: row.current }) }}</strong>
        <span>{{ t('{count}日', { count: row.longest }) }}</span>
        <span>{{ t('{count}日', { count: row.monthCount }) }}</span>
      </div>
    </div>
    <div
      class="streak-card__week"
      :aria-label="t('直近7日間の利用')"
    >
      <span
        v-for="day in recentDays"
        :key="day.date"
        :title="day.date"
        class="streak-card__day"
      >
        <span
          :class="{ 'streak-card__done': day.recorded }"
          :aria-label="t(day.recorded ? '利用済み' : '未利用')"
        >
          {{ day.recorded ? '●' : '○' }}
        </span>
        <small>{{ day.date.slice(5).replace('-', '/') }}</small>
      </span>
    </div>
    <details>
      <summary>{{ t('カテゴリ別の記録') }}</summary>
      <div class="streak-card__table">
        <div
          v-for="row in rows.slice(categories.length)"
          :key="row.id"
          class="streak-card__row"
        >
          <span>
            {{ row.icon }} {{ t(row.label) }}
            <span
              v-if="row.recordedToday"
              class="streak-card__done"
              :aria-label="t('今日の記録済み')"
            >✓</span>
          </span>
          <strong>{{ t('{count}日', { count: row.current }) }}</strong>
          <span>{{ t('{count}日', { count: row.longest }) }}</span>
          <span>{{ t('{count}日', { count: row.monthCount }) }}</span>
        </div>
      </div>
    </details>
    <p class="streak-card__hint">
      {{ t('利用は日付変更線、記録は対象日で集計します。今日が未記録でも昨日までの連続は続きます。') }}
    </p>
    <p class="streak-card__hint">
      {{ t('健康は1項目以上、日課は1件以上の達成、TODO・収支・食事は保存した記録を数えます。') }}
    </p>
  </section>
</template>

<style lang="scss" scoped>
.streak-card {
  margin-bottom: 24px;
  padding: 16px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 12px;

  .dark-mode & {
    background: #2a2a2a;
    border-color: #444;
    color: #e0e0e0;
  }

  h2 { font-size: 1.2rem; margin: 0 0 8px; }

  &__table { overflow-x: auto; }
  &__row {
    display: grid;
    grid-template-columns: minmax(140px, 1fr) repeat(3, minmax(50px, auto));
    gap: 8px;
    align-items: center;
    padding: 8px 0;
    font-size: 0.9rem;
    > :not(:first-child) { text-align: right; }
  }
  &__head, &__hint { font-size: 0.8rem; opacity: 0.8; }
  &__hint { margin: 8px 0; }
  &__done { color: #23834f; }
  &__week { display: flex; justify-content: space-around; margin: 12px 0; }
  &__day { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  summary { cursor: pointer; padding: 8px 0; }

  .dark-mode &__done { color: #72d7a0; }
}
</style>
