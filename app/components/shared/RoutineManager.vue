<script setup lang="ts">
/**
 * 日課管理コンポーネント
 * 月ごとの日課の追加・編集・削除を行うコンポーネント
 */
import type { Routine } from '~/types/item'

const routinesStore = useRoutinesStore()

// 現在選択中の年月
const currentYearMonth = ref(formatYearMonth(new Date()))

// 日課リスト
const routines = computed(() => routinesStore.routines)

// 新規日課のタイトル
const newRoutineTitle = ref('')

// 編集中の日課
const editingRoutine = ref<Routine | null>(null)
const editTitle = ref('')

// 表示用の年月
const displayYearMonth = computed(() => formatDisplayYearMonth(currentYearMonth.value + '-01'))

// 初回読み込み
onMounted(async () => {
  await routinesStore.fetchRoutines(currentYearMonth.value)
})

/**
 * 前月に移動
 */
async function goToPreviousMonth() {
  const prevMonth = addMonths(currentYearMonth.value + '-01', -1)
  currentYearMonth.value = formatYearMonth(prevMonth)
  await routinesStore.fetchRoutines(currentYearMonth.value)
}

/**
 * 翌月に移動
 */
async function goToNextMonth() {
  const nextMonth = addMonths(currentYearMonth.value + '-01', 1)
  currentYearMonth.value = formatYearMonth(nextMonth)
  await routinesStore.fetchRoutines(currentYearMonth.value)
}

/**
 * 新しい日課を追加
 */
async function addNewRoutine() {
  const title = newRoutineTitle.value.trim()
  if (!title) return

  await routinesStore.createRoutine({
    title,
    yearMonth: currentYearMonth.value,
  })
  newRoutineTitle.value = ''
}

/**
 * 編集モードを開始
 */
function startEdit(routine: Routine) {
  editingRoutine.value = routine
  editTitle.value = routine.title
}

/**
 * 編集を保存
 */
async function saveEdit() {
  if (!editingRoutine.value) return

  const title = editTitle.value.trim()
  if (!title) return

  await routinesStore.updateRoutineById(editingRoutine.value.id, { title })
  editingRoutine.value = null
  editTitle.value = ''
}

/**
 * 編集をキャンセル
 */
function cancelEdit() {
  editingRoutine.value = null
  editTitle.value = ''
}

/**
 * 日課を削除
 */
async function deleteRoutine(id: string) {
  if (confirm('この日課を削除しますか？')) {
    await routinesStore.deleteRoutineById(id)
  }
}

/**
 * 前月から日課をコピー
 */
async function copyFromPreviousMonth() {
  const prevMonth = addMonths(currentYearMonth.value + '-01', -1)
  const prevYearMonth = formatYearMonth(prevMonth)

  // 前月の日課を取得
  await routinesStore.fetchRoutines(prevYearMonth)
  const prevRoutines = [...routinesStore.routines]

  // 現在の月に戻す
  await routinesStore.fetchRoutines(currentYearMonth.value)

  if (prevRoutines.length === 0) {
    alert('前月に日課がありません')
    return
  }

  // 前月の日課をコピー
  for (const routine of prevRoutines) {
    await routinesStore.createRoutine({
      title: routine.title,
      yearMonth: currentYearMonth.value,
    })
  }
}
</script>

<template>
  <div class="routine-manager">
    <!-- 月選択ヘッダー -->
    <div class="routine-manager__header">
      <UiButton
        variant="secondary"
        icon
        aria-label="前月へ"
        @click="goToPreviousMonth"
      >
        <Icon name="mdi:chevron-left" />
      </UiButton>
      <span class="routine-manager__month">{{ displayYearMonth }}</span>
      <UiButton
        variant="secondary"
        icon
        aria-label="翌月へ"
        @click="goToNextMonth"
      >
        <Icon name="mdi:chevron-right" />
      </UiButton>
    </div>

    <!-- 日課リスト -->
    <ul
      v-if="routines.length > 0"
      class="routine-manager__list"
    >
      <li
        v-for="routine in routines"
        :key="routine.id"
        class="routine-manager__item"
      >
        <template v-if="editingRoutine?.id === routine.id">
          <UiInput
            v-model="editTitle"
            type="text"
            :placeholder="$t('日課のタイトル')"
            @keydown.enter="saveEdit"
            @keydown.escape="cancelEdit"
          />
          <div class="routine-manager__item-actions">
            <UiButton
              variant="secondary"
              icon
              @click="cancelEdit"
            >
              <Icon name="mdi:close" />
            </UiButton>
            <UiButton
              variant="primary"
              icon
              @click="saveEdit"
            >
              <Icon name="mdi:check" />
            </UiButton>
          </div>
        </template>
        <template v-else>
          <span class="routine-manager__item-title">{{ routine.title }}</span>
          <div class="routine-manager__item-actions">
            <UiButton
              variant="secondary"
              icon
              @click="startEdit(routine)"
            >
              <Icon name="mdi:pencil" />
            </UiButton>
            <UiButton
              variant="danger"
              icon
              @click="deleteRoutine(routine.id)"
            >
              <Icon name="mdi:delete" />
            </UiButton>
          </div>
        </template>
      </li>
    </ul>
    <p
      v-else
      class="routine-manager__empty"
    >
      {{ $t('この月の日課はありません') }}
    </p>

    <!-- 新規日課追加 -->
    <div class="routine-manager__add">
      <UiInput
        v-model="newRoutineTitle"
        type="text"
        :placeholder="$t('新しい日課を追加...')"
        @keydown.enter="addNewRoutine"
      />
      <UiButton
        variant="primary"
        :disabled="!newRoutineTitle.trim()"
        @click="addNewRoutine"
      >
        <Icon name="mdi:plus" />
        {{ $t('追加') }}
      </UiButton>
    </div>

    <!-- 前月からコピー -->
    <div class="routine-manager__copy">
      <UiButton
        variant="secondary"
        block
        @click="copyFromPreviousMonth"
      >
        <Icon name="mdi:content-copy" />
        {{ $t('前月の日課をコピー') }}
      </UiButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.routine-manager {
  &__header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-bottom: 8px;
  }

  &__month {
    font-size: 16px;
    font-weight: 600;
    min-width: 100px;
    text-align: center;
  }

  &__list {
    list-style: none;
    padding: 0;
    margin: 0 0 8px;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    border-bottom: 1px solid #f0f0f0;

    &:last-child {
      border-bottom: none;
    }
  }

  &__item-title {
    flex: 1;
    font-size: 14px;
  }

  &__item-actions {
    display: flex;
    gap: 4px;
  }

  &__empty {
    text-align: center;
    color: #999;
    padding: 24px;
    font-size: 14px;
  }

  &__add {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    margin-bottom: 12px;
  }

  &__copy {
    margin-top: 8px;
  }
}
</style>
