<script setup lang="ts">
/**
 * 日課達成状況グリッドコンポーネント
 * 月内の各日課の達成状況をGitHub Contribution Graph風に表示します。
 * 1列が1日、1行が1つの日課を表します。
 */
import type { Routine, RoutineLog, RoutineStatus } from '~/types/item'

const props = defineProps<{
  /** 対象年月（YYYY-MM形式） */
  yearMonth: string
  /** 月内の日課リスト */
  routines: Routine[]
  /** 月内の日課ログリスト */
  routineLogs: RoutineLog[]
}>()

const { t } = useI18n()
/**
 * yearMonth に '-01' を追加した完全な日付文字列
 */
const fullDateString = computed(() => `${props.yearMonth}-01`)

/**
 * 月内の全日付リストを生成
 */
const datesInMonth = computed(() => {
  const startOfMonth = getStartOfMonth(fullDateString.value)
  const daysCount = getDaysInMonth(fullDateString.value)
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
      return t('達成')
    case 'not_achieved':
      return t('未達成')
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

/**
 * タッチデバイス用のポップアップ情報
 */
const touchPopup = ref<{
  show: boolean
  title: string
  date: string
  status: string
  x: number
  y: number
} | null>(null)

/**
 * タッチデバイスかどうかを判定
 */
const isTouchDevice = ref(false)

/**
 * セルがクリック/タップされた時の処理
 */
function handleCellClick(event: MouseEvent, routineTitle: string, date: string, status: RoutineStatus) {
  // タッチデバイスの場合のみポップアップを表示
  if (isTouchDevice.value) {
    const dateObj = new Date(date)
    const month = dateObj.getMonth() + 1
    const day = dateObj.getDate()

    // タップ位置を取得
    const rect = (event.target as HTMLElement).getBoundingClientRect()

    touchPopup.value = {
      show: true,
      title: routineTitle,
      date: `${month}/${day}`,
      status: getStatusLabel(status),
      x: rect.left + rect.width / 2,
      y: rect.top,
    }
  }
}

/**
 * ポップアップを閉じる
 */
function closePopup() {
  touchPopup.value = null
}

/**
 * タッチデバイスの検出
 */
onMounted(() => {
  // タッチイベントがサポートされているかチェック
  isTouchDevice.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0
})
</script>

<template>
  <section
    v-if="routines.length > 0"
    class="routine-achievement-grid card"
  >
    <h2>
      <Icon name="mdi:calendar-check" />
      {{ $t('日課達成状況') }}
    </h2>

    <div class="grid-container">
      <!-- 各日課の行 -->
      <div class="grid-body">
        <div
          v-for="routine in routines"
          :key="routine.id"
          class="grid-row"
        >
          <div
            v-for="date in datesInMonth"
            :key="`${routine.id}-${date}`"
            class="cell"
            :class="getStatusColorClass(getRoutineStatusForDate(routine.id, date))"
            :title="getTooltipText(routine.title, date, getRoutineStatusForDate(routine.id, date))"
            @click="handleCellClick($event, routine.title, date, getRoutineStatusForDate(routine.id, date))"
          />
        </div>
      </div>
    </div>

    <!-- タッチデバイス用ポップアップ -->
    <Teleport to="body">
      <div
        v-if="touchPopup?.show"
        class="touch-popup-overlay"
        @click="closePopup"
      >
        <div
          class="touch-popup"
          :style="{
            left: `${touchPopup.x}px`,
            top: `${touchPopup.y}px`,
          }"
          @click.stop
        >
          <div class="touch-popup__title">
            {{ touchPopup.title }}
          </div>
          <div class="touch-popup__info">
            {{ touchPopup.date }}: {{ touchPopup.status }}
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 凡例 -->
    <div class="legend">
      <div class="legend-item">
        <div class="legend-item__box cell--unconfirmed" />
        <span>未確認</span>
      </div>
      <div class="legend-item">
        <div class="legend-item__box cell--achieved" />
        <span>{{ $t('達成') }}</span>
      </div>
      <div class="legend-item">
        <div class="legend-item__box cell--not-achieved" />
        <span>{{ $t('未達成') }}</span>
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

    // ダークモード対応
    .dark-mode & {
      color: #b0b0b0;
    }

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

.grid-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.grid-row {
  display: flex;
  gap: 2px;
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

    // ダークモード対応
    .dark-mode & {
      background-color: #3a3a3a;
      border-color: #555;
    }
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

  // ダークモード対応
  .dark-mode & {
    color: #b0b0b0;
    border-color: #444;
  }

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

// タッチデバイス用ポップアップ
.touch-popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.3);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.touch-popup {
  position: fixed;
  background: white;
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translate(-50%, -100%);
  margin-top: -10px;
  max-width: 250px;
  z-index: 1001;

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: #333;
    margin-bottom: 4px;
  }

  &__info {
    font-size: 13px;
    color: #666;
  }

  // ダークモード対応
  .dark-mode & {
    background: #2a2a2a;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

    &__title {
      color: #e0e0e0;
    }

    &__info {
      color: #999;
    }
  }
}
</style>
