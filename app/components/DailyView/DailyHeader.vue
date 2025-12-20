<script setup lang="ts">
/**
 * 日次ビューのヘッダーコンポーネント
 * 日付の表示と前後日へのナビゲーション、月表示へのリンクを提供
 */
defineProps<{
  displayDate: string
}>()

const emit = defineEmits<{
  previous: []
  next: []
  goToMonth: []
  goToMenu: []
  goToSearch: []
}>()
</script>

<template>
  <header class="daily-header">
    <div class="header-top">
      <button
        class="btn btn-secondary"
        @click="emit('goToMonth')"
      >
        <Icon name="mdi:calendar-month" />
        月表示へ
      </button>
      <hr>
      <button
        class="btn btn-secondary btn-icon"
        aria-label="検索"
        @click="emit('goToSearch')"
      >
        <Icon name="mdi:magnify" />
      </button>
      <button
        class="btn btn-secondary btn-icon menu-btn"
        aria-label="メニュー"
        @click="emit('goToMenu')"
      >
        <Icon name="mdi:menu" />
      </button>
    </div>
    <div class="nav-row">
      <button
        class="btn btn-secondary btn-icon"
        aria-label="前日へ"
        @click="emit('previous')"
      >
        <Icon name="mdi:chevron-left" />
      </button>
      <h1>{{ displayDate }}</h1>
      <button
        class="btn btn-secondary btn-icon"
        aria-label="翌日へ"
        @click="emit('next')"
      >
        <Icon name="mdi:chevron-right" />
      </button>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.daily-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}

.header-top {
  display: flex;
  justify-content: flex-end;
  width: 100%;
  margin-bottom: 8px;

  hr {
    flex-grow: 1;
    margin: 0 8px;
    border: none;
  }
}

.nav-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;

  h1 {
    font-size: 18px;
    font-weight: 600;
    min-width: 160px;
    text-align: center;
  }

  @media (min-width: 500px) {
    gap: 16px;

    h1 {
      font-size: 20px;
      min-width: 180px;
    }
  }
}

@media (max-width: 380px) {
  .daily-header {
    margin-bottom: 16px;
  }

  .nav-row {
    gap: 8px;

    h1 {
      font-size: 16px;
      min-width: 140px;
    }
  }
}
</style>
