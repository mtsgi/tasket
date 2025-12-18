<script setup lang="ts">
/**
 * 月ごとのビューページ
 * 月間カレンダー、収支サマリー、支出チャート、支出ランキングを表示します。
 */
import { useItemsStore } from '~/stores/items'
import { useDayTitlesStore } from '~/stores/dayTitles'
import { useStatistics } from '~/composables/useStatistics'
import { formatDisplayYearMonth, formatYearMonth, addMonths, formatDate, getDaysInMonth, getStartOfMonth, addDays } from '~/utils/dateHelpers'
import Calendar from '~/components/MonthlyView/Calendar.vue'
import CalendarSettings from '~/components/MonthlyView/CalendarSettings.vue'
import ExpenseChart from '~/components/MonthlyView/ExpenseChart.vue'
import MonthlySummaryComponent from '~/components/MonthlyView/MonthlySummary.vue'
import ExpenseRanking from '~/components/MonthlyView/ExpenseRanking.vue'

const route = useRoute()
const router = useRouter()
const itemsStore = useItemsStore()
const dayTitlesStore = useDayTitlesStore()
const { calculateMonthlySummary, calculateExpenseRanking, calculateDailyTotals, getItemCountByDate } = useStatistics()

const showCalendarSettings = ref(false)

const yearMonthParam = computed(() => route.params.yearMonth as string)

const items = computed(() => itemsStore.getItemsByMonth(yearMonthParam.value))
const summary = computed(() => calculateMonthlySummary(items.value, yearMonthParam.value))
const expenseRanking = computed(() => calculateExpenseRanking(items.value))
const dailyTotals = computed(() => calculateDailyTotals(items.value, yearMonthParam.value))

const displayYearMonth = computed(() => formatDisplayYearMonth(yearMonthParam.value + '-01'))

function goToPreviousMonth() {
  const prevMonth = addMonths(yearMonthParam.value + '-01', -1)
  router.push(`/month/${formatYearMonth(prevMonth)}`)
}

function goToNextMonth() {
  const nextMonth = addMonths(yearMonthParam.value + '-01', 1)
  router.push(`/month/${formatYearMonth(nextMonth)}`)
}

function goToDay(dateString: string) {
  router.push(`/day/${dateString}`)
}

function goToToday() {
  const today = new Date()
  router.push(`/day/${formatDate(today)}`)
}

function goToMenu() {
  router.push('/menu')
}

function getItemCountForDate(dateString: string) {
  return getItemCountByDate(items.value, dateString)
}

function openCalendarSettings() {
  showCalendarSettings.value = true
}

function closeCalendarSettings() {
  showCalendarSettings.value = false
}

/**
 * 月の全日付のDayTitleを事前に読み込む
 */
async function fetchMonthDayTitles() {
  const startOfMonth = getStartOfMonth(yearMonthParam.value + '-01')
  const daysInMonth = getDaysInMonth(yearMonthParam.value + '-01')

  const fetchPromises = []
  for (let i = 0; i < daysInMonth; i++) {
    const currentDate = addDays(startOfMonth, i)
    const dateString = formatDate(currentDate)
    fetchPromises.push(dayTitlesStore.fetchDayTitle(dateString))
  }

  await Promise.all(fetchPromises)
}

onMounted(async () => {
  itemsStore.fetchItems()
  await fetchMonthDayTitles()
})

watch(yearMonthParam, async () => {
  await fetchMonthDayTitles()
})
</script>

<template>
  <div class="container">
    <div class="header-top">
      <button
        class="btn btn-primary"
        @click="goToToday"
      >
        <Icon name="mdi:calendar-today" />
        今日
      </button>
      <hr>
      <button
        class="btn btn-secondary btn-icon"
        aria-label="メニュー"
        @click="goToMenu"
      >
        <Icon name="mdi:menu" />
      </button>
    </div>

    <header class="monthly-header">
      <button
        class="btn btn-secondary btn-icon"
        aria-label="前月へ"
        @click="goToPreviousMonth"
      >
        <Icon name="mdi:chevron-left" />
      </button>
      <h1>{{ displayYearMonth }}</h1>
      <button
        class="btn btn-secondary btn-icon"
        aria-label="翌月へ"
        @click="goToNextMonth"
      >
        <Icon name="mdi:chevron-right" />
      </button>
    </header>

    <div class="calendar-section">
      <div class="calendar-header-actions">
        <button
          class="btn btn-secondary btn-small"
          @click="openCalendarSettings"
        >
          <Icon name="mdi:cog" />
          表示設定
        </button>
      </div>

      <Calendar
        :year-month="yearMonthParam"
        :get-item-count="getItemCountForDate"
        @select-date="goToDay"
      />
    </div>

    <CalendarSettings
      :show="showCalendarSettings"
      @close="closeCalendarSettings"
    />

    <ExpenseChart :daily-totals="dailyTotals" />

    <ExpenseRanking :ranking="expenseRanking" />

    <MonthlySummaryComponent :summary="summary" />
  </div>
</template>

<style lang="scss" scoped>
.header-top {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;

  hr {
    flex-grow: 1;
    margin: 0 8px;
    border: none;
  }
}

.monthly-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 16px;

  h1 {
    font-size: 20px;
    font-weight: 600;
    min-width: 130px;
    text-align: center;
  }

  @media (min-width: 500px) {
    gap: 16px;

    h1 {
      font-size: 24px;
      min-width: 150px;
    }
  }
}

.calendar-section {
  margin-bottom: 16px;
}

.calendar-header-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;

  .btn-small {
    padding: 6px 12px;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

@media (max-width: 380px) {
  .monthly-header {
    gap: 8px;

    h1 {
      font-size: 18px;
      min-width: 110px;
    }
  }

  .calendar-header-actions .btn-small {
    padding: 5px 10px;
    font-size: 12px;
  }
}
</style>
