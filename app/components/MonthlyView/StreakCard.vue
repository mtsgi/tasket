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
  { id: 'usage', label: 'Tasket利用', icon: 'mdi:fire' },
  { id: 'overall', label: '総合記録', icon: 'mdi:notebook-edit-outline' },
  { id: 'health', label: '健康データ', icon: 'mdi:heart-pulse' },
  { id: 'routine', label: '日課達成', icon: 'mdi:check-circle-outline' },
]
const details = [
  { id: 'weight', label: '体重記録', icon: 'mdi:scale-bathroom' },
  { id: 'sleep', label: '睡眠記録', icon: 'mdi:sleep' },
  { id: 'bloodPressure', label: '血圧記録', icon: 'mdi:heart' },
  { id: 'steps', label: '歩数記録', icon: 'mdi:walk' },
  { id: 'todo', label: 'TODO記録', icon: 'mdi:clipboard-check-outline' },
  { id: 'expense', label: '収支記録', icon: 'mdi:cash-multiple' },
  { id: 'meal', label: '食事記録', icon: 'mdi:food' },
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
  <section class="streak-card card">
    <details class="streak-card__disclosure">
      <summary class="streak-card__summary">
        <Icon
          name="mdi:fire"
          class="streak-card__fire"
          aria-hidden="true"
        />
        <h2>{{ t('連続記録') }}</h2>
        <span
          class="streak-card__current"
          :title="t('Tasket利用')"
        >
          {{ t('{count}日', { count: streakStore.usage.current }) }}
        </span>
        <Icon
          name="mdi:chevron-down"
          class="streak-card__chevron"
          aria-hidden="true"
        />
      </summary>
      <div class="streak-card__content">
        <p class="streak-card__hint">
          {{ t('今日の記録状況') }} · {{ streakStore.today }}
        </p>
        <div class="streak-card__table">
          <div class="streak-card__row streak-card__head">
            <span>{{ t('カテゴリ') }}</span>
            <span>{{ t('連続') }}</span>
            <span>
              <Icon
                name="mdi:trophy-outline"
                aria-hidden="true"
              />
              {{ t('最長') }}
            </span>
            <span>{{ t('この月') }}</span>
          </div>
          <div
            v-for="row in rows.slice(0, categories.length)"
            :key="row.id"
            class="streak-card__row"
          >
            <span>
              <Icon
                :name="row.icon"
                aria-hidden="true"
              /> {{ t(row.label) }}
              <span
                v-if="row.recordedToday"
                class="streak-card__done"
                :aria-label="t('今日の記録済み')"
              >
                <Icon
                  name="mdi:check"
                  aria-hidden="true"
                />
              </span>
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
              <Icon
                :name="day.recorded ? 'mdi:emoticon-excited-outline' : 'mdi:circle-outline'"
                aria-hidden="true"
              />
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
                <Icon
                  :name="row.icon"
                  aria-hidden="true"
                /> {{ t(row.label) }}
                <span
                  v-if="row.recordedToday"
                  class="streak-card__done"
                  :aria-label="t('今日の記録済み')"
                >
                  <Icon
                    name="mdi:check"
                    aria-hidden="true"
                  />
                </span>
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
      </div>
    </details>
    <UiButton
      variant="secondary"
      icon
      class="streak-card__replay"
      :aria-label="t('利用通知を再表示')"
      :title="t('利用通知を再表示')"
      :disabled="!streakStore.usage.recordedToday"
      @click="streakStore.showDailyModal = true"
    >
      <Icon
        name="mdi:replay"
        aria-hidden="true"
      />
    </UiButton>
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
  </section>
</template>

<style lang="scss" scoped>
.streak-card {
  position: relative;
  padding: 0;
  margin-bottom: 16px;

  h2 { font-size: 16px; font-weight: 600; margin: 0; }

  &__summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 64px 14px 14px;
    list-style: none;
    min-height: 52px;
    color: #666;
    &::-webkit-details-marker { display: none; }
    &:focus-visible { outline: 2px solid #4a90d9; outline-offset: -2px; border-radius: 12px; }
  }
  &__fire { font-size: 1.2rem; flex-shrink: 0; }
  &__current { margin-left: auto; font-size: 0.85rem; white-space: nowrap; }
  &__chevron { flex-shrink: 0; transition: transform 0.15s ease; }
  &__disclosure[open] &__chevron { transform: rotate(180deg); }
  &__content { padding: 0 14px 14px; }
  &__replay.ui-btn { position: absolute; top: 4px; right: 8px; width: 44px; height: 44px; padding: 0; font-size: 1.1rem; }
  > p[role="alert"] { padding: 0 14px 14px; }
  @media (prefers-reduced-motion: reduce) { &__chevron { transition: none; } }

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
  &__head, &__hint { font-size: 12px; color: #666; }
  &__hint { margin: 8px 0; }
  &__done { color: #4caf50; }
  &__week { display: flex; justify-content: space-around; margin: 12px 0; }
  &__day { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  &__day > span { display: flex; align-items: center; justify-content: center; height: 28px; font-size: 22px; }
  &__day small { font-size: 11px; color: #666; }
  &__day > span:not(.streak-card__done) { color: #999; }
  summary { cursor: pointer; }
  &__content summary { padding: 8px 0; }

  .dark-mode &__summary, .dark-mode &__head, .dark-mode &__hint, .dark-mode &__day small { color: #b0b0b0; }
  .dark-mode &__day > span:not(.streak-card__done) { color: #888; }

  @media (max-width: 600px) {
    h2 { font-size: 14px; }
  }
}
</style>
