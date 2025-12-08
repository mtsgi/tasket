<script setup lang="ts">
/**
 * 日ごとのビューページ
 * 特定の日のタスクと収支を時系列で管理する詳細ビューです。
 * 日タイトル、週表示カレンダー、日課チェックリスト、収支サマリー、アイテム追加フォーム、アイテム一覧を表示します。
 */
import { useItemsStore } from '~/stores/items'
import { useStatistics } from '~/composables/useStatistics'
import { formatDate, formatDisplayDate, addDays, formatYearMonth } from '~/utils/dateHelpers'
import DailyHeader from '~/components/DailyView/DailyHeader.vue'
import DayTitle from '~/components/DailyView/DayTitle.vue'
import WeekView from '~/components/DailyView/WeekView.vue'
import RoutineChecklist from '~/components/DailyView/RoutineChecklist.vue'
import ItemList from '~/components/DailyView/ItemList.vue'
import ItemForm from '~/components/DailyView/ItemForm.vue'
import DailySummaryComponent from '~/components/DailyView/DailySummary.vue'

// ルーターとストアの初期化
const route = useRoute()
const router = useRouter()
const itemsStore = useItemsStore()
const { calculateDailySummary } = useStatistics()

// URLパラメータから日付を取得
const dateParam = computed(() => route.params.date as string)

// 選択された日のアイテムを取得
const items = computed(() => itemsStore.getItemsByDate(dateParam.value))

// 日次サマリーを計算
const summary = computed(() => calculateDailySummary(items.value, dateParam.value))

// 表示用の日付フォーマット
const displayDate = computed(() => formatDisplayDate(dateParam.value))

/**
 * 前日に移動する
 */
function goToPreviousDay() {
  const prevDate = addDays(dateParam.value, -1)
  router.push(`/day/${formatDate(prevDate)}`)
}

/**
 * 翌日に移動する
 */
function goToNextDay() {
  const nextDate = addDays(dateParam.value, 1)
  router.push(`/day/${formatDate(nextDate)}`)
}

/**
 * 月表示に移動する
 */
function goToMonth() {
  const yearMonth = formatYearMonth(dateParam.value)
  router.push(`/month/${yearMonth}`)
}

/**
 * メニュー画面に移動する
 */
function goToMenu() {
  router.push('/menu')
}

/**
 * 週表示から日付が選択されたときの処理
 */
function handleDateSelect(dateString: string) {
  router.push(`/day/${dateString}`)
}

// コンポーネントマウント時にアイテムを取得
onMounted(() => {
  itemsStore.fetchItems()
})
</script>

<template>
  <div class="container">
    <!-- 日付ナビゲーションヘッダー -->
    <DailyHeader
      :display-date="displayDate"
      @previous="goToPreviousDay"
      @next="goToNextDay"
      @go-to-month="goToMonth"
      @go-to-menu="goToMenu"
    />

    <!-- 週表示カレンダー -->
    <WeekView
      :current-date="dateParam"
      @select-date="handleDateSelect"
    />

    <!-- 日タイトル（今日やること） -->
    <DayTitle :date="dateParam" />

    <!-- 日課チェックリスト -->
    <RoutineChecklist :date="dateParam" />

    <!-- アイテム一覧 -->
    <ItemList :items="items" />

    <!-- アイテム追加フォーム -->
    <ItemForm :date="dateParam" />

    <!-- 日次収支サマリー -->
    <DailySummaryComponent :summary="summary" />
  </div>
</template>
