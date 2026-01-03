<script setup lang="ts">
const router = useRouter()

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
