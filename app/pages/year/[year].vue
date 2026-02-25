<script setup lang="ts">
/**
 * 年ごとのビューページ
 * 年間の収支サマリー、月別収支推移、支出ランキング、各月へのリンクを表示します。
 */
import { formatYear, formatDisplayYear, addYears, formatYearMonth } from '~/utils/dateHelpers'
import YearlySummary from '~/components/YearlyView/YearlySummary.vue'
import YearlyExpenseChart from '~/components/YearlyView/YearlyExpenseChart.vue'
import YearlyExpenseRanking from '~/components/YearlyView/YearlyExpenseRanking.vue'
import MonthGrid from '~/components/YearlyView/MonthGrid.vue'
import type { MonthlySummary } from '~/types/item'

const route = useRoute()
const router = useRouter()
const itemsStore = useItemsStore()
const { calculateYearlySummary, calculateMonthlySummary, calculateExpenseRanking } = useStatistics()

const yearParam = computed(() => route.params.year as string)

// 年のアイテムを取得
const items = computed(() => itemsStore.getItemsByYear(yearParam.value))

// 年次サマリーを計算
const summary = computed(() => calculateYearlySummary(items.value, yearParam.value))

// 年間の支出ランキングを計算
const expenseRanking = computed(() => calculateExpenseRanking(items.value))

// 表示用の年
const displayYear = computed(() => formatDisplayYear(yearParam.value + '-01-01'))

/**
 * 各月のサマリーを計算
 */
const monthlySummaries = computed<MonthlySummary[]>(() => {
  const summaries: MonthlySummary[] = []

  // 1月から12月まで
  for (let month = 1; month <= 12; month++) {
    const yearMonth = `${yearParam.value}-${String(month).padStart(2, '0')}`
    const monthItems = itemsStore.getItemsByMonth(yearMonth)
    summaries.push(calculateMonthlySummary(monthItems, yearMonth))
  }

  return summaries
})

/**
 * 前年に移動する
 */
function goToPreviousYear() {
  const prevYear = addYears(yearParam.value + '-01-01', -1)
  router.push(`/year/${formatYear(prevYear)}`)
}

/**
 * 翌年に移動する
 */
function goToNextYear() {
  const nextYear = addYears(yearParam.value + '-01-01', 1)
  router.push(`/year/${formatYear(nextYear)}`)
}

/**
 * 今日の月表示に移動する
 */
function goToThisMonth() {
  const today = new Date()
  router.push(`/month/${formatYearMonth(today)}`)
}

/**
 * メニュー画面に移動する
 */
function goToMenu() {
  router.push('/menu')
}

/**
 * 検索画面に移動する
 */
function goToSearch() {
  router.push('/search')
}

/**
 * 月を選択して月表示に移動
 */
function handleMonthSelect(yearMonth: string) {
  router.push(`/month/${yearMonth}`)
}

// コンポーネントマウント時にアイテムを取得
onMounted(() => {
  itemsStore.fetchItems()
})
</script>

<template>
  <div class="container">
    <div class="header-top">
      <button
        class="btn btn-primary"
        @click="goToThisMonth"
      >
        <Icon name="mdi:calendar-today" />
        {{ $t('今日') }}
      </button>
      <hr>
      <button
        class="btn btn-secondary btn-icon"
        :aria-label="$t('検索')"
        @click="goToSearch"
      >
        <Icon name="mdi:magnify" />
      </button>
      <button
        class="btn btn-secondary btn-icon"
        :aria-label="$t('メニュー')"
        @click="goToMenu"
      >
        <Icon name="mdi:menu" />
      </button>
    </div>

    <header class="yearly-header">
      <button
        class="btn btn-secondary btn-icon"
        :aria-label="$t('前年へ')"
        @click="goToPreviousYear"
      >
        <Icon name="mdi:chevron-left" />
      </button>
      <h1>{{ displayYear }}</h1>
      <button
        class="btn btn-secondary btn-icon"
        :aria-label="$t('翌年へ')"
        @click="goToNextYear"
      >
        <Icon name="mdi:chevron-right" />
      </button>
    </header>

    <YearlySummary :summary="summary" />

    <YearlyExpenseChart :monthly-summaries="monthlySummaries" />

    <YearlyExpenseRanking :ranking="expenseRanking" />

    <MonthGrid
      :monthly-summaries="monthlySummaries"
      :year="yearParam"
      @select-month="handleMonthSelect"
    />
  </div>
</template>

<style lang="scss" scoped>
.header-top {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
  gap: 8px;

  hr {
    flex-grow: 1;
    margin: 0 8px;
    border: none;
  }
}

.yearly-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 16px;

  h1 {
    font-size: 22px;
    font-weight: 600;
    min-width: 100px;
    text-align: center;
  }

  @media (min-width: 500px) {
    gap: 16px;

    h1 {
      font-size: 26px;
      min-width: 120px;
    }
  }
}

@media (max-width: 380px) {
  .yearly-header {
    gap: 8px;

    h1 {
      font-size: 20px;
      min-width: 90px;
    }
  }
}
</style>
