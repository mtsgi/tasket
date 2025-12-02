<script setup lang="ts">
import { useItemsStore } from '~/stores/items'
import { useStatistics } from '~/composables/useStatistics'
import { formatDisplayYearMonth, formatYearMonth, addMonths, formatDate } from '~/utils/dateHelpers'
import Calendar from '~/components/MonthlyView/Calendar.vue'
import ExpenseChart from '~/components/MonthlyView/ExpenseChart.vue'
import MonthlySummaryComponent from '~/components/MonthlyView/MonthlySummary.vue'
import ExpenseRanking from '~/components/MonthlyView/ExpenseRanking.vue'

const route = useRoute()
const router = useRouter()
const itemsStore = useItemsStore()
const { calculateMonthlySummary, calculateExpenseRanking, calculateDailyTotals, getItemCountByDate } = useStatistics()

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

function getItemCountForDate(dateString: string) {
  return getItemCountByDate(items.value, dateString)
}

onMounted(() => {
  itemsStore.fetchItems()
})
</script>

<template>
  <div class="container">
    <header class="monthly-header">
      <button
        class="btn btn-secondary btn-icon"
        @click="goToPreviousMonth"
      >
        ‹
      </button>
      <h1>{{ displayYearMonth }}</h1>
      <button
        class="btn btn-secondary btn-icon"
        @click="goToNextMonth"
      >
        ›
      </button>
    </header>

    <div class="today-button-container">
      <button
        class="btn btn-primary"
        @click="goToToday"
      >
        今日
      </button>
    </div>

    <MonthlySummaryComponent :summary="summary" />

    <Calendar
      :year-month="yearMonthParam"
      :get-item-count="getItemCountForDate"
      @select-date="goToDay"
    />

    <ExpenseChart :daily-totals="dailyTotals" />

    <ExpenseRanking :ranking="expenseRanking" />
  </div>
</template>

<style lang="scss" scoped>
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

.today-button-container {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

@media (max-width: 380px) {
  .monthly-header {
    gap: 8px;

    h1 {
      font-size: 18px;
      min-width: 110px;
    }
  }
}
</style>
