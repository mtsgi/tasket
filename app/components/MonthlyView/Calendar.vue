<script setup lang="ts">
import { getDaysInMonth, getFirstDayOfWeek, getStartOfMonth, addDays, formatDate, isToday } from '~/utils/dateHelpers'
import { formatCurrency } from '~/utils/formatters'
import { useSettingsStore } from '~/stores/settings'
import { useDayTitlesStore } from '~/stores/dayTitles'

const props = defineProps<{
  yearMonth: string
  getItemCount: (dateString: string) => {
    total: number
    completed: number
    income: number
    expense: number
  }
}>()

const emit = defineEmits<{
  selectDate: [dateString: string]
}>()

const settingsStore = useSettingsStore()
const dayTitlesStore = useDayTitlesStore()

const weekDays = ['日', '月', '火', '水', '木', '金', '土']

const calendarDays = computed(() => {
  const startOfMonth = getStartOfMonth(props.yearMonth + '-01')
  const daysInMonth = getDaysInMonth(props.yearMonth + '-01')
  const firstDayOfWeek = getFirstDayOfWeek(props.yearMonth + '-01')

  const days: Array<{
    date: string | null
    day: number | null
    isToday: boolean
    itemCount: ReturnType<typeof props.getItemCount> | null
    dayTitle: string | null
  }> = []

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push({ date: null, day: null, isToday: false, itemCount: null, dayTitle: null })
  }

  // Add days of the month
  for (let i = 0; i < daysInMonth; i++) {
    const currentDate = addDays(startOfMonth, i)
    const dateString = formatDate(currentDate)
    const dayTitle = dayTitlesStore.getDayTitle(dateString)
    days.push({
      date: dateString,
      day: i + 1,
      isToday: isToday(currentDate),
      itemCount: props.getItemCount(dateString),
      dayTitle: dayTitle?.title ?? null,
    })
  }

  return days
})

function handleDayClick(dateString: string | null) {
  if (dateString) {
    emit('selectDate', dateString)
  }
}
</script>

<template>
  <section class="calendar card">
    <div class="calendar-header">
      <div
        v-for="day in weekDays"
        :key="day"
        class="weekday"
        :class="{ sunday: day === '日', saturday: day === '土' }"
      >
        {{ day }}
      </div>
    </div>
    <div class="calendar-grid">
      <div
        v-for="(day, index) in calendarDays"
        :key="index"
        class="calendar-day"
        :class="{
          'empty': !day.date,
          'today': day.isToday,
          'has-items': day.itemCount && day.itemCount.total > 0,
          'sunday': index % 7 === 0,
          'saturday': index % 7 === 6,
        }"
        @click="handleDayClick(day.date)"
      >
        <template v-if="day.date">
          <span class="day-number">{{ day.day }}</span>
          <div
            v-if="day.itemCount || day.dayTitle"
            class="day-info"
          >
            <span
              v-if="settingsStore.calendarDisplay.showMainTask && day.dayTitle"
              class="main-task"
            >
              {{ day.dayTitle }}
            </span>
            <span
              v-if="settingsStore.calendarDisplay.showTaskCount && day.itemCount && day.itemCount.total > 0"
              class="item-count"
            >
              {{ day.itemCount.total }}件
            </span>
            <span
              v-if="settingsStore.calendarDisplay.showIncome && day.itemCount && day.itemCount.income > 0"
              class="income"
            >
              +{{ formatCurrency(day.itemCount.income) }}
            </span>
            <span
              v-if="settingsStore.calendarDisplay.showExpense && day.itemCount && day.itemCount.expense > 0"
              class="expense"
            >
              -{{ formatCurrency(day.itemCount.expense) }}
            </span>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.calendar {
  overflow: hidden;
}

.calendar-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border-bottom: 1px solid #e0e0e0;
}

.weekday {
  padding: 8px 4px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: #666;

  &.sunday {
    color: #f44336;
  }

  &.saturday {
    color: #2196f3;
  }
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.calendar-day {
  min-height: 70px;
  padding: 4px;
  border-right: 1px solid #f0f0f0;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:nth-child(7n) {
    border-right: none;
  }

  &:hover:not(.empty) {
    background-color: #f5f7fa;
  }

  &.empty {
    cursor: default;
    background-color: #fafafa;
  }

  &.today {
    background-color: rgba(74, 144, 217, 0.1);

    .day-number {
      background-color: #4a90d9;
      color: white;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
  }

  &.sunday .day-number {
    color: #f44336;
  }

  &.saturday .day-number {
    color: #2196f3;
  }
}

.day-number {
  font-size: 14px;
  font-weight: 500;
}

.day-info {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.main-task {
  font-size: 10px;
  color: #333;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-count {
  font-size: 10px;
  color: #666;
}

.income {
  font-size: 10px;
  color: #4caf50;
  font-weight: 500;
}

.expense {
  font-size: 10px;
  color: #f44336;
  font-weight: 500;
}

@media (max-width: 600px) {
  .weekday {
    padding: 6px 2px;
    font-size: 11px;
  }

  .calendar-day {
    min-height: 44px;
    padding: 2px;
  }

  .day-number {
    font-size: 12px;
  }

  .day-info {
    display: none;
  }

  .has-items {
    position: relative;

    &::after {
      content: '';
      display: block;
      width: 6px;
      height: 6px;
      background-color: #4a90d9;
      border-radius: 50%;
      margin-top: 2px;
    }
  }

  .today .day-number {
    width: 20px;
    height: 20px;
    font-size: 11px;
  }
}

@media (max-width: 380px) {
  .calendar-day {
    min-height: 38px;
  }

  .day-number {
    font-size: 11px;
  }

  .today .day-number {
    width: 18px;
    height: 18px;
    font-size: 10px;
  }
}
</style>
