<script setup lang="ts">
/**
 * 週表示コンポーネント
 * 選択した日を含む週のカレンダーを表示し、各日をクリックすることで
 * その日の詳細ビューに遷移できます。
 */
import { formatDate, addDays, isToday } from '~/utils/dateHelpers'
import { useStatistics } from '~/composables/useStatistics'
import { useItemsStore } from '~/stores/items'
import dayjs from 'dayjs'

// Props: 現在選択されている日付
const props = defineProps<{
  currentDate: string
}>()

// Emits: 日付が選択されたときに発火
const emit = defineEmits<{
  selectDate: [dateString: string]
}>()

// ストアとコンポーザブルの取得
const itemsStore = useItemsStore()
const { getItemCountByDate } = useStatistics()

// 曜日のラベル（日本語）
const weekDayLabels = ['日', '月', '火', '水', '木', '金', '土']

/**
 * 選択された日付を含む週の日付リストを生成
 * 日曜日始まりで7日間のデータを返す
 */
const weekDays = computed(() => {
  const current = dayjs(props.currentDate)
  // 週の始まり（日曜日）を取得
  const startOfWeek = current.startOf('week')

  const days = []
  for (let i = 0; i < 7; i++) {
    const date = startOfWeek.add(i, 'day')
    const dateString = formatDate(date.toDate())

    // その日のアイテム情報を取得
    const itemCount = getItemCountByDate(itemsStore.items, dateString)

    days.push({
      date: dateString,
      dayOfMonth: date.date(),
      dayOfWeek: i,
      dayLabel: weekDayLabels[i],
      isToday: isToday(date.toDate()),
      isSelected: dateString === props.currentDate,
      hasItems: itemCount.total > 0,
      itemCount: itemCount.total,
    })
  }
  return days
})

/**
 * 週の表示ラベルを生成（例: 12月1日〜7日）
 */
const weekLabel = computed(() => {
  const firstDay = weekDays.value[0]
  const lastDay = weekDays.value[6]
  const firstDate = dayjs(firstDay.date)
  const lastDate = dayjs(lastDay.date)

  // 同じ月の場合は短縮表示
  if (firstDate.month() === lastDate.month()) {
    return `${firstDate.format('M月D日')}〜${lastDate.format('D日')}`
  }
  // 月をまたぐ場合
  return `${firstDate.format('M月D日')}〜${lastDate.format('M月D日')}`
})

/**
 * 前の週に移動
 */
function goToPreviousWeek() {
  const prevWeekDate = addDays(props.currentDate, -7)
  emit('selectDate', formatDate(prevWeekDate))
}

/**
 * 次の週に移動
 */
function goToNextWeek() {
  const nextWeekDate = addDays(props.currentDate, 7)
  emit('selectDate', formatDate(nextWeekDate))
}

/**
 * 日付がクリックされたときの処理
 */
function handleDayClick(dateString: string) {
  emit('selectDate', dateString)
}
</script>

<template>
  <section class="week-view card">
    <!-- 週ナビゲーションヘッダー -->
    <div class="week-header">
      <button
        class="btn btn-secondary btn-icon"
        aria-label="前の週"
        @click="goToPreviousWeek"
      >
        ‹
      </button>
      <span class="week-label">{{ weekLabel }}</span>
      <button
        class="btn btn-secondary btn-icon"
        aria-label="次の週"
        @click="goToNextWeek"
      >
        ›
      </button>
    </div>

    <!-- 週カレンダーグリッド -->
    <div class="week-grid">
      <div
        v-for="day in weekDays"
        :key="day.date"
        class="week-day"
        :class="{
          'is-today': day.isToday,
          'is-selected': day.isSelected,
          'is-sunday': day.dayOfWeek === 0,
          'is-saturday': day.dayOfWeek === 6,
          'has-items': day.hasItems,
        }"
        @click="handleDayClick(day.date)"
      >
        <!-- 曜日ラベル -->
        <span class="day-label">{{ day.dayLabel }}</span>
        <!-- 日付 -->
        <span class="day-number">{{ day.dayOfMonth }}</span>
        <!-- アイテム数インジケーター -->
        <span
          v-if="day.hasItems"
          class="item-indicator"
        >
          {{ day.itemCount }}
        </span>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
/* 週表示のカードコンテナ */
.week-view {
  margin-bottom: 16px;
}

/* 週ナビゲーションヘッダー */
.week-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 0 4px;
}

/* 週の期間ラベル */
.week-label {
  font-size: 14px;
  font-weight: 500;
  color: #666;
}

/* 週カレンダーグリッド */
.week-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

/* 各日のセル */
.week-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 60px;

  &:hover {
    background-color: #f5f7fa;
  }

  /* 今日のハイライト */
  &.is-today {
    .day-number {
      background-color: #4a90d9;
      color: white;
      border-radius: 50%;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  /* 選択中の日 */
  &.is-selected {
    background-color: rgba(74, 144, 217, 0.15);
    border: 2px solid #4a90d9;
  }

  /* 日曜日の色 */
  &.is-sunday {
    .day-label,
    .day-number {
      color: #f44336;
    }

    &.is-today .day-number {
      color: white;
      background-color: #f44336;
    }
  }

  /* 土曜日の色 */
  &.is-saturday {
    .day-label,
    .day-number {
      color: #2196f3;
    }

    &.is-today .day-number {
      color: white;
      background-color: #2196f3;
    }
  }
}

/* 曜日ラベル */
.day-label {
  font-size: 10px;
  font-weight: 600;
  color: #999;
  margin-bottom: 4px;
}

/* 日付の数字 */
.day-number {
  font-size: 16px;
  font-weight: 500;
  color: #333;
}

/* アイテム数インジケーター */
.item-indicator {
  font-size: 10px;
  font-weight: 600;
  color: white;
  background-color: #4a90d9;
  border-radius: 10px;
  padding: 1px 6px;
  margin-top: 4px;
  min-width: 18px;
  text-align: center;
}

/* モバイル対応 */
@media (max-width: 600px) {
  .week-day {
    padding: 6px 2px;
    min-height: 56px;
  }

  .day-label {
    font-size: 9px;
  }

  .day-number {
    font-size: 14px;
  }

  .item-indicator {
    font-size: 9px;
    padding: 1px 4px;
  }

  .week-day.is-today .day-number {
    width: 24px;
    height: 24px;
  }
}

/* 極小画面対応 */
@media (max-width: 380px) {
  .week-grid {
    gap: 2px;
  }

  .week-day {
    padding: 4px 2px;
    min-height: 50px;
  }

  .day-label {
    font-size: 8px;
  }

  .day-number {
    font-size: 13px;
  }

  .week-day.is-today .day-number {
    width: 22px;
    height: 22px;
  }
}
</style>
