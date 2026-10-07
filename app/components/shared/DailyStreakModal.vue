<script setup lang="ts">
import { useStreakStore } from '~/stores/streak'
import { useSettingsStore } from '~/stores/settings'

defineProps<{ show: boolean }>()
const streakStore = useStreakStore()
const settingsStore = useSettingsStore()
const { t } = useI18n()
const title = computed(() => {
  const count = streakStore.usage.current
  if (count === 1) return t('今日から連続記録スタート！')
  if (count === 7) return t('1週間達成！')
  if (count === 30 || count === 100) return t('{count}日連続達成！', { count })
  return t('{count}日連続！', { count })
})
function close() {
  streakStore.showDailyModal = false
}
</script>

<template>
  <UiModal
    :show="show"
    :title="title"
    :dark="settingsStore.darkMode"
    @close="close"
  >
    <div
      class="daily-streak"
      role="status"
    >
      <div
        class="daily-streak__icon"
        aria-hidden="true"
      >
        <Icon :name="streakStore.usage.current >= 30 ? 'mdi:trophy' : 'mdi:fire'" />
      </div>
      <p>{{ t('今日もTasketを開きました') }}</p>
      <p>{{ t('この調子で毎日の記録を続けましょう') }}</p>
      <p>{{ t('最長{count}日', { count: streakStore.usage.longest }) }}</p>
    </div>
    <template #footer>
      <UiButton
        variant="primary"
        @click="close"
      >
        {{ t('閉じる') }}
      </UiButton>
    </template>
  </UiModal>
</template>

<style lang="scss" scoped>
.daily-streak {
  text-align: center;
  p { margin: 12px 0; }
  &__icon { font-size: 3rem; color: #d86a24; }
}
</style>
