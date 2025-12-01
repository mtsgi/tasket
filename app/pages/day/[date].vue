<script setup lang="ts">
import { useItemsStore } from '~/stores/items'
import { useStatistics } from '~/composables/useStatistics'
import { formatDate, formatDisplayDate, addDays, formatYearMonth } from '~/utils/dateHelpers'
import DailyHeader from '~/components/DailyView/DailyHeader.vue'
import ItemList from '~/components/DailyView/ItemList.vue'
import ItemForm from '~/components/DailyView/ItemForm.vue'
import DailySummaryComponent from '~/components/DailyView/DailySummary.vue'

const route = useRoute()
const router = useRouter()
const itemsStore = useItemsStore()
const { calculateDailySummary } = useStatistics()

const dateParam = computed(() => route.params.date as string)

const items = computed(() => itemsStore.getItemsByDate(dateParam.value))
const summary = computed(() => calculateDailySummary(items.value, dateParam.value))

const displayDate = computed(() => formatDisplayDate(dateParam.value))

function goToPreviousDay() {
  const prevDate = addDays(dateParam.value, -1)
  router.push(`/day/${formatDate(prevDate)}`)
}

function goToNextDay() {
  const nextDate = addDays(dateParam.value, 1)
  router.push(`/day/${formatDate(nextDate)}`)
}

function goToMonth() {
  const yearMonth = formatYearMonth(dateParam.value)
  router.push(`/month/${yearMonth}`)
}

onMounted(() => {
  itemsStore.fetchItems()
})
</script>

<template>
  <div class="container">
    <DailyHeader
      :display-date="displayDate"
      @previous="goToPreviousDay"
      @next="goToNextDay"
      @go-to-month="goToMonth"
    />

    <DailySummaryComponent :summary="summary" />

    <ItemForm :date="dateParam" />

    <ItemList :items="items" />
  </div>
</template>

<style lang="scss" scoped>
.container {
  padding-top: 16px;
}
</style>
