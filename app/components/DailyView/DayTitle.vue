<script setup lang="ts">
/**
 * 日タイトルコンポーネント
 * その日のメインタスク（今日やること）を設定・表示するコンポーネント
 */
import { useDayTitlesStore } from '~/stores/dayTitles'

const props = defineProps<{
  /** 対象日（YYYY-MM-DD形式） */
  date: string
}>()

const dayTitlesStore = useDayTitlesStore()
const { t } = useI18n()

// 編集モード状態
const isEditing = ref(false)
// 入力中のタイトル
const editTitle = ref('')

// 現在の日タイトル
const dayTitle = computed(() => dayTitlesStore.getDayTitle(props.date))

// 日付変更時にタイトルを取得
watch(
  () => props.date,
  async () => {
    await dayTitlesStore.fetchDayTitle(props.date)
  },
  { immediate: true },
)

/**
 * 編集モードを開始
 */
function startEdit() {
  editTitle.value = dayTitle.value?.title || ''
  isEditing.value = true
}

/**
 * タイトルを保存
 */
async function saveTitle() {
  const title = editTitle.value.trim()
  if (title) {
    await dayTitlesStore.saveDayTitle(props.date, title)
  }
  else if (dayTitle.value) {
    await dayTitlesStore.removeDayTitle(props.date)
  }
  isEditing.value = false
}

/**
 * 編集をキャンセル
 */
function cancelEdit() {
  isEditing.value = false
  editTitle.value = ''
}

/**
 * Enterキーで保存
 */
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    saveTitle()
  }
  else if (event.key === 'Escape') {
    cancelEdit()
  }
}
</script>

<template>
  <section class="day-title card">
    <div
      v-if="isEditing"
      class="day-title__edit"
    >
      <UiInput
        v-model="editTitle"
        type="text"
        :placeholder="$t('今日やること...')"
        @keydown="handleKeydown"
      />
      <div class="day-title__actions">
        <UiButton
          variant="secondary"
          @click="cancelEdit"
        >
          {{ $t('キャンセル') }}
        </UiButton>
        <UiButton
          variant="primary"
          @click="saveTitle"
        >
          <Icon name="mdi:check" />
          {{ $t('保存') }}
        </UiButton>
      </div>
    </div>
    <div
      v-else
      class="day-title__display"
      @click="startEdit"
    >
      <Icon
        name="mdi:flag"
        class="day-title__icon"
      />
      <span
        v-if="dayTitle?.title"
        class="day-title__text"
      >
        {{ dayTitle.title }}
      </span>
      <span
        v-else
        class="day-title__placeholder"
      >
        {{ $t('今日やることを設定...') }}
      </span>
      <Icon
        name="mdi:pencil"
        class="day-title__edit-icon"
      />
    </div>
  </section>
</template>

<style lang="scss" scoped>
.day-title {
  &__display {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px;
    cursor: pointer;
    border-radius: 8px;
    transition: background-color 0.15s ease;

    &:hover {
      background-color: #f5f7fa;

      // ダークモード対応
      .dark-mode & {
        background-color: #333;
      }
    }
  }

  &__icon {
    font-size: 20px;
    color: #4a90d9;
  }

  &__text {
    flex: 1;
    font-size: 16px;
    font-weight: 600;
    color: #333;

    // ダークモード対応
    .dark-mode & {
      color: #e0e0e0;
    }
  }

  &__placeholder {
    flex: 1;
    font-size: 14px;
    color: #999;
    font-style: italic;

    // ダークモード対応
    .dark-mode & {
      color: #888;
    }
  }

  &__edit-icon {
    font-size: 16px;
    color: #999;
    opacity: 0;
    transition: opacity 0.15s ease;

    .day-title__display:hover & {
      opacity: 1;
    }

    // ダークモード対応
    .dark-mode & {
      color: #888;
    }
  }

  &__edit {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  @media (max-width: 600px) {
    &__edit-icon {
      opacity: 1;
    }

    &__text {
      font-size: 14px;
    }
  }
}
</style>
