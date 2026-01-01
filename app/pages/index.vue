<script setup lang="ts">
import { formatYearMonth } from '~/utils/dateHelpers'

const router = useRouter()
const { t } = useI18n()

onMounted(() => {
  const today = new Date()
  const yearMonth = formatYearMonth(today)
  router.replace(`/month/${yearMonth}`)
})
</script>

<template>
  <div class="loading">
    {{ $t('読み込み中') }}...
  </div>
</template>
