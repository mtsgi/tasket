<script setup lang="ts">
/**
 * 日課チェックリストコンポーネント
 * その日の日課の達成状況を表示・記録するコンポーネント
 */
import { useRoutinesStore } from '~/stores/routines'
import { formatYearMonth } from '~/utils/dateHelpers'
import type { RoutineStatus } from '~/types/item'

const props = defineProps<{
  /** 対象日（YYYY-MM-DD形式） */
  date: string
}>()

const routinesStore = useRoutinesStore()
const { t } = useI18n()

// 現在の月の日課リスト
const routines = computed(() => routinesStore.routines)

// 日付変更時に日課と日課ログを取得
watch(
  () => props.date,
  async () => {
    const yearMonth = formatYearMonth(props.date)
    await routinesStore.fetchRoutines(yearMonth)
    await routinesStore.fetchRoutineLogs(props.date)
  },
  { immediate: true },
)

/**
 * 日課のステータスを循環的に変更
 */
async function cycleStatus(routineId: string) {
  await routinesStore.cycleRoutineStatus(routineId, props.date)
}

/**
 * 日課のステータスを取得
 */
function getStatus(routineId: string): RoutineStatus {
  return routinesStore.getRoutineStatus(routineId, props.date)
}

/**
 * 達成した日課の数を取得
 */
const achievedCount = computed(() => {
  return routines.value.filter(r => getStatus(r.id) === 'achieved').length
})

/**
 * 日課の総数
 */
const totalCount = computed(() => routines.value.length)
</script>

<template>
  <section
    v-if="routines.length > 0"
    class="routine-checklist card"
  >
    <h2>
      <Icon name="mdi:checkbox-multiple-marked" />
      {{ $t('日課') }}
      <span class="routine-checklist__count">{{ achievedCount }} / {{ totalCount }}</span>
    </h2>
    <ul class="routine-checklist__list">
      <li
        v-for="routine in routines"
        :key="routine.id"
        class="routine-checklist__item"
      >
        <UiRoutineStatusButton
          :status="getStatus(routine.id)"
          :label="routine.title"
          @click="cycleStatus(routine.id)"
        />
      </li>
    </ul>
  </section>
</template>

<style lang="scss" scoped>
.routine-checklist {
  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: #666;
    margin-bottom: 12px;

    @media (max-width: 600px) {
      font-size: 14px;
      margin-bottom: 8px;
    }
  }

  &__count {
    font-size: 14px;
    font-weight: 500;
    color: #4a90d9;
    margin-left: auto;
  }

  &__list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  &__item {
    display: flex;
    border-radius: 8px;
    transition: background-color 0.15s ease;

    @media (max-width: 600px) {
      padding: 0;
    }
  }
}
</style>
