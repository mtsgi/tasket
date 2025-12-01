<script setup lang="ts">
defineProps<{
  displayDate: string
}>()

const emit = defineEmits<{
  previous: []
  next: []
  goToMonth: []
}>()
</script>

<template>
  <header class="daily-header">
    <div class="nav-row">
      <button
        class="btn btn-secondary btn-icon"
        @click="emit('previous')"
      >
        ‹
      </button>
      <h1>{{ displayDate }}</h1>
      <button
        class="btn btn-secondary btn-icon"
        @click="emit('next')"
      >
        ›
      </button>
    </div>
    <button
      class="btn btn-secondary month-link"
      @click="emit('goToMonth')"
    >
      月表示へ
    </button>
  </header>
</template>

<style lang="scss" scoped>
.daily-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}

.nav-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;

  h1 {
    font-size: 20px;
    font-weight: 600;
    min-width: 180px;
    text-align: center;
  }
}

.month-link {
  margin-top: 8px;
  font-size: 14px;
}
</style>
