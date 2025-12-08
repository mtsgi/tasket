<script setup lang="ts">
/**
 * 日課チェックリストコンポーネント
 * その日の日課の達成状況を表示・記録するコンポーネント
 */
import { useRoutinesStore } from '~/stores/routines'
import { formatYearMonth } from '~/utils/dateHelpers'

const props = defineProps<{
  /** 対象日（YYYY-MM-DD形式） */
  date: string
}>()

const routinesStore = useRoutinesStore()

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
 * 日課の完了状態を切り替え
 */
async function toggleRoutine(routineId: string) {
  await routinesStore.toggleRoutineComplete(routineId, props.date)
}

/**
 * 日課が完了しているか確認
 */
function isCompleted(routineId: string): boolean {
  return routinesStore.isRoutineCompleted(routineId, props.date)
}

/**
 * 完了した日課の数を取得
 */
const completedCount = computed(() => {
  return routines.value.filter(r => isCompleted(r.id)).length
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
      日課
      <span class="routine-checklist__count">{{ completedCount }} / {{ totalCount }}</span>
    </h2>
    <ul class="routine-checklist__list">
      <li
        v-for="routine in routines"
        :key="routine.id"
        class="routine-checklist__item"
        :class="{ 'routine-checklist__item--completed': isCompleted(routine.id) }"
        @click="toggleRoutine(routine.id)"
      >
        <UiCheckbox
          :model-value="isCompleted(routine.id)"
          :label="routine.title"
          @update:model-value="toggleRoutine(routine.id)"
          @click.stop
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
    padding: 12px 8px;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.15s ease;

    &:hover {
      background-color: #f5f7fa;
    }

    &--completed {
      :deep(.ui-checkbox__label) {
        text-decoration: line-through;
        color: #999;
      }
    }

    @media (max-width: 600px) {
      padding: 2px;
    }
  }
}
</style>
