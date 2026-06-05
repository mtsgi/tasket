<script setup lang="ts">
defineProps<{
  previousValue: number | undefined
  formattedPreviousValue: string | undefined
  formattedDiffValue: string | undefined
  diffClass: string
}>()
</script>

<template>
  <div
    class="previous-record"
    :class="diffClass"
  >
    <template v-if="previousValue !== undefined">
      {{ $t('前回') }}: {{ formattedPreviousValue }}
      <span v-if="formattedDiffValue">
        ({{ formattedDiffValue }})
      </span>
    </template>
    <template v-else>
      {{ $t('前回記録なし') }}
    </template>
  </div>
</template>

<style lang="scss" scoped>
.previous-record {
  margin-top: 4px;
  font-size: 11px;
  color: #999999;

  &.diff-positive {
    color: #D32F2F;
  }

  &.diff-negative {
    color: #1976D2;
  }

  &.diff-neutral {
    color: #666666;
  }
}
</style>
