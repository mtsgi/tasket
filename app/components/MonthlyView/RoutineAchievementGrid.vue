<script setup lang="ts">
/**
 * 日課達成状況グリッドコンポーネント
 * 月内の各日課の達成状況をGitHub Contribution Graph風に表示します。
 * 1列が1日、1行が1つの日課を表します。
 */
import type { Routine, RoutineLog, RoutineStatus } from '~/types/item'
import { formatDate, getDaysInMonth, getStartOfMonth, addDays } from '~/utils/dateHelpers'

const props = defineProps<{
  /** 対象年月（YYYY-MM形式） */
  yearMonth: string
  /** 月内の日課リスト */
  routines: Routine[]
  /** 月内の日課ログリスト */
  routineLogs: RoutineLog[]
}>()

/**
 * 月内の全日付リストを生成
 */
const datesInMonth = computed(() => {
  const startOfMonth = getStartOfMonth(props.yearMonth + '-01')
  const daysCount = getDaysInMonth(props.yearMonth + '-01')
  const dates: string[] = []

  for (let i = 0; i < daysCount; i++) {
    const date = addDays(startOfMonth, i)
    dates.push(formatDate(date))
  }

  return dates
})

/**
 * 特定の日課・日付のステータスを取得
 */
function getRoutineStatusForDate(routineId: string, date: string): RoutineStatus {
  const log = props.routineLogs.find(l => l.routineId === routineId && l.date === date)
  return log?.status ?? 'unconfirmed'
}

/**
 * ステータスに応じた背景色クラスを取得
 */
function getStatusColorClass(status: RoutineStatus): string {
  switch (status) {
    case 'achieved':
      return 'cell--achieved'
    case 'not_achieved':
      return 'cell--not-achieved'
    case 'unconfirmed':
    default:
      return 'cell--unconfirmed'
  }
}

/**
 * ステータスの日本語ラベルを取得
 */
function getStatusLabel(status: RoutineStatus): string {
  switch (status) {
    case 'achieved':
      return '達成'
    case 'not_achieved':
      return '未達成'
    case 'unconfirmed':
    default:
      return '未確認'
  }
}

/**
 * ホバー時のツールチップ内容を生成
 */
function getTooltipText(routineTitle: string, date: string, status: RoutineStatus): string {
  const dateObj = new Date(date)
  const month = dateObj.getMonth() + 1
  const day = dateObj.getDate()
  return `${routineTitle}\n${month}/${day}: ${getStatusLabel(status)}`
}
</script>

<template>
  <section
    v-if="routines.length > 0"
    class="routine-achievement-grid card"
  >
    <h2>
      <Icon name="mdi:calendar-check" />
      日課達成状況
    </h2>

    <div class="grid-container">
      <!-- 日付ヘッダー -->
      <div class="grid-header">
        <div class="grid-header__routine-label">
          日課
        </div>
        <div class="grid-header__dates">
          <div
            v-for="date in datesInMonth"
            :key="date"
            class="grid-header__date"
            :title="date"
          >
            {{ new Date(date).getDate() }}
          </div>
        </div>
      </div>

      <!-- 各日課の行 -->
      <div class="grid-body">
        <div
          v-for="routine in routines"
          :key="routine.id"
          class="grid-row"
        >
          <div class="grid-row__label">
            {{ routine.title }}
          </div>
          <div class="grid-row__cells">
            <div
              v-for="date in datesInMonth"
              :key="`${routine.id}-${date}`"
              class="cell"
              :class="getStatusColorClass(getRoutineStatusForDate(routine.id, date))"
              :title="getTooltipText(routine.title, date, getRoutineStatusForDate(routine.id, date))"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 凡例 -->
    <div class="legend">
      <div class="legend-item">
        <div class="legend-item__box cell--unconfirmed" />
        <span>未確認</span>
      </div>
      <div class="legend-item">
        <div class="legend-item__box cell--achieved" />
        <span>達成</span>
      </div>
      <div class="legend-item">
        <div class="legend-item__box cell--not-achieved" />
        <span>未達成</span>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.routine-achievement-grid {
  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: #666;
    margin-bottom: 16px;

    @media (max-width: 600px) {
      font-size: 14px;
      margin-bottom: 12px;
    }
  }
}

.grid-container {
  overflow-x: auto;
  margin-bottom: 12px;
}

.grid-header {
  display: flex;
  margin-bottom: 8px;
  font-size: 12px;
  color: #666;

  &__routine-label {
    width: 120px;
    flex-shrink: 0;
    padding-right: 8px;
    font-weight: 600;

    @media (max-width: 600px) {
      width: 80px;
      font-size: 11px;
    }
  }

  &__dates {
    display: flex;
    gap: 2px;
    flex-grow: 1;
  }

  &__date {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: #999;

    @media (max-width: 600px) {
      width: 12px;
      height: 12px;
      font-size: 9px;
    }
  }
}

.grid-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.grid-row {
  display: flex;
  align-items: center;

  &__label {
    width: 120px;
    flex-shrink: 0;
    padding-right: 8px;
    font-size: 13px;
    color: #333;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    @media (max-width: 600px) {
      width: 80px;
      font-size: 12px;
    }
  }

  &__cells {
    display: flex;
    gap: 2px;
    flex-grow: 1;
  }
}

.cell {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.2s ease;

  @media (max-width: 600px) {
    width: 12px;
    height: 12px;
  }

  &:hover {
    transform: scale(1.2);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  // 未確認状態
  &--unconfirmed {
    background-color: #ebedf0;
    border: 1px solid #d0d7de;
  }

  // 達成状態（緑系のグラデーション）
  &--achieved {
    background-color: #4caf50;
    border: 1px solid #45a049;
  }

  // 未達成状態（赤系）
  &--not-achieved {
    background-color: #f44336;
    border: 1px solid #e53935;
  }
}

.legend {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
  font-size: 12px;
  color: #666;
  padding-top: 8px;
  border-top: 1px solid #e0e0e0;

  @media (max-width: 600px) {
    font-size: 11px;
    gap: 12px;
  }
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;

  &__box {
    width: 14px;
    height: 14px;
    border-radius: 2px;

    @media (max-width: 600px) {
      width: 12px;
      height: 12px;
    }
  }

  span {
    white-space: nowrap;
  }
}
</style>
