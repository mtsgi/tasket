<script setup lang="ts">
/**
 * アイテム編集モーダルコンポーネント
 * 既存アイテムの編集・削除機能を提供
 */
import type { Item, ItemType } from '~/types/item'
import { useItemsStore } from '~/stores/items'
import { formatDate } from '~/utils/dateHelpers'
import { clearMealLogRefs } from '~/utils/mealLog'
import { ALBUM_MAX_PHOTOS } from '~/utils/constants'

const props = defineProps<{
  item: Item
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const itemsStore = useItemsStore()
const settingsStore = useSettingsStore()

// フォームの状態
const title = ref(props.item.title)
const amount = ref(props.item.amount)
const type = ref<ItemType>(props.item.type)
const time = ref(
  props.item.scheduled_at.toTimeString().slice(0, 5),
)
const date = ref(formatDate(props.item.scheduled_at))
const notes = ref(props.item.notes || '')

// 実行時刻（任意）
const executedTime = ref(
  props.item.executed_at
    ? props.item.executed_at.toTimeString().slice(0, 5)
    : '',
)

// 食事ログの状態
const showMealLog = ref(!!props.item.mealLog)
const mealCalories = ref<number | undefined>(props.item.mealLog?.calories)
const mealProtein = ref<number | undefined>(props.item.mealLog?.protein)
const mealCarbs = ref<number | undefined>(props.item.mealLog?.carbs)
const mealFat = ref<number | undefined>(props.item.mealLog?.fat)
const mealPhoto = ref<string | undefined>(props.item.mealLog?.photo)
const mealMemo = ref(props.item.mealLog?.memo || '')

// アルバム機能の状態（TODO用の写真）
const albumPhotos = ref<string[]>(props.item.photos || [])
const showPhotoGallery = ref(false)

const isSubmitting = ref(false)

/**
 * アイテム種別を選択
 */
function selectType(newType: ItemType) {
  type.value = newType
}

/**
 * フォーム送信処理
 */
async function handleSubmit() {
  if (!title.value.trim()) return

  isSubmitting.value = true
  try {
    // 入力時刻の安全なパース（未入力時は 00:00 を使用）
    const [hoursStr, minutesStr] = (time.value ? time.value.split(':') : ['00', '00'])
    const hours = Number(hoursStr ?? '0')
    const minutes = Number(minutesStr ?? '0')
    const dateChangeLine = settingsStore.dateChangeLine

    // 日付変更線より前の時刻の場合、翌日の日付を使用
    // 例: 日付変更線が4時で、2時のアイテムを編集する場合
    // 12月12日の日付で2時を設定すると、実際には12月13日の2時として保存される
    // （12月12日の実効範囲は12日4:00〜13日3:59なので、2時は13日分）
    const scheduledAt = new Date(date.value)
    if (hours < dateChangeLine) {
      scheduledAt.setDate(scheduledAt.getDate() + 1)
    }
    scheduledAt.setHours(hours, minutes, 0, 0)

    // 実行時刻が設定されている場合のみ変換
    // 実行時刻も日付変更線を考慮する
    let executedAt: Date | null = null
    if (executedTime.value) {
      const [execHoursStr, execMinutesStr] = executedTime.value.split(':')
      const execHours = Number(execHoursStr ?? '0')
      const execMinutes = Number(execMinutesStr ?? '0')
      executedAt = new Date(date.value)
      if (execHours < dateChangeLine) {
        executedAt.setDate(executedAt.getDate() + 1)
      }
      executedAt.setHours(execHours, execMinutes, 0, 0)
    }

    // 食事ログデータ
    const mealLogData = showMealLog.value
      ? {
          calories: mealCalories.value,
          protein: mealProtein.value,
          carbs: mealCarbs.value,
          fat: mealFat.value,
          photo: mealPhoto.value,
          memo: mealMemo.value,
        }
      : undefined

    await itemsStore.updateItemById(props.item.id, {
      title: title.value.trim(),
      amount: type.value === 'todo' ? 0 : amount.value,
      type: type.value,
      scheduled_at: scheduledAt,
      executed_at: executedAt,
      notes: notes.value.trim(),
      mealLog: mealLogData,
      photos: type.value === 'todo' && albumPhotos.value.length > 0 ? albumPhotos.value : undefined,
    })

    emit('close')
  }
  finally {
    isSubmitting.value = false
  }
}

/**
 * アイテム削除処理
 */
async function handleDelete() {
  if (confirm(t('このアイテムを削除しますか？'))) {
    await itemsStore.deleteItemById(props.item.id)
    emit('close')
  }
}

/**
 * 実行時刻をクリア
 */
function clearExecutedTime() {
  executedTime.value = ''
}

/**
 * 食事ログセクションの表示切り替え
 */
function toggleMealLog() {
  showMealLog.value = !showMealLog.value
}

/**
 * 食事ログを削除
 */
function deleteMealLog() {
  clearMealLogRefs({
    showMealLog,
    mealCalories,
    mealProtein,
    mealCarbs,
    mealFat,
    mealPhoto,
    mealMemo,
  })
}

/**
 * 画像ファイルを選択（食事ログ用）
 */
function handlePhotoUpload(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    const file = input.files[0]
    const reader = new FileReader()
    reader.onload = (e) => {
      mealPhoto.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

/**
 * アルバム写真を追加
 */
function handleAlbumPhotoAdded(photo: string) {
  albumPhotos.value.push(photo)
}

/**
 * アルバム写真を削除
 */
function handleAlbumPhotoDeleted(index: number) {
  // Proxyオブジェクトを避けるため、filterを使用して新しい配列を作成
  albumPhotos.value = albumPhotos.value.filter((_, i) => i !== index)
}
</script>

<template>
  <UiModal
    :show="true"
    :title="$t('アイテムを編集')"
    @close="emit('close')"
  >
    <form
      class="edit-form"
      @submit.prevent="handleSubmit"
    >
      <!-- 種別選択ボタン（横並び） -->
      <div class="form-group">
        <div class="type-buttons">
          <UiButton
            variant="secondary"
            class="type-btn type-todo"
            :class="{ active: type === 'todo' }"
            @click="selectType('todo')"
          >
            <Icon name="mdi:checkbox-marked-outline" />
            {{ $t('TODO') }}
          </UiButton>
          <UiButton
            variant="secondary"
            class="type-btn type-expense"
            :class="{ active: type === 'expense' }"
            @click="selectType('expense')"
          >
            <Icon name="mdi:cart-outline" />
            {{ $t('支出') }}
          </UiButton>
          <UiButton
            variant="secondary"
            class="type-btn type-income"
            :class="{ active: type === 'income' }"
            @click="selectType('income')"
          >
            <Icon name="mdi:wallet-plus-outline" />
            {{ $t('収入') }}
          </UiButton>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="edit-date">{{ $t('日付') }}</label>
          <UiInput
            id="edit-date"
            v-model="date"
            type="date"
          />
        </div>
        <div class="form-group">
          <label for="edit-time">{{ $t('予定時刻') }}</label>
          <UiInput
            id="edit-time"
            v-model="time"
            type="time"
          />
        </div>
      </div>

      <!-- 実行時刻 -->
      <div class="form-group">
        <label for="edit-executed-time">
          {{ $t('実行時刻（任意）') }}
        </label>
        <div class="time-input-with-clear">
          <UiInput
            id="edit-executed-time"
            v-model="executedTime"
            type="time"
            placeholder="未設定"
          />
          <UiButton
            v-if="executedTime"
            variant="secondary"
            icon
            class="btn-clear"
            :aria-label="$t('実行時刻をクリア')"
            @click="clearExecutedTime"
          >
            <Icon name="mdi:close-circle" />
          </UiButton>
        </div>
      </div>

      <div class="form-group">
        <label for="edit-title">{{ $t('タイトル') }}</label>
        <UiInput
          id="edit-title"
          v-model="title"
          type="text"
          :placeholder="$t('アイテム名を入力')"
          required
        />
      </div>

      <!-- 備考 -->
      <div class="form-group">
        <label for="edit-notes">{{ $t('備考') }}</label>
        <textarea
          id="edit-notes"
          v-model="notes"
          class="form-control textarea"
          :placeholder="$t('備考（任意）')"
          rows="2"
        />
      </div>

      <!-- 食事ログセクション（TODOまたは支出の場合のみ表示） -->
      <div
        v-if="type === 'todo' || type === 'expense'"
        class="meal-log-section"
      >
        <div class="meal-log-buttons">
          <button
            type="button"
            class="meal-log-toggle"
            @click="toggleMealLog"
          >
            <Icon :name="showMealLog ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
            {{ $t('食事ログを追加') }}
          </button>
          <UiButton
            v-if="showMealLog"
            variant="danger"
            icon
            :aria-label="$t('食事ログを削除')"
            @click="deleteMealLog"
          >
            <Icon name="mdi:delete" />
          </UiButton>
        </div>

        <div
          v-if="showMealLog"
          class="meal-log-form"
        >
          <div class="form-row">
            <div class="form-group">
              <label>{{ $t('カロリー') }}</label>
              <UiInput
                v-model.number="mealCalories"
                type="number"
                :placeholder="$t('{value}kcal', { value: '0' })"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>{{ $t('タンパク質') }}</label>
              <UiInput
                v-model.number="mealProtein"
                type="number"
                step="0.1"
                :placeholder="$t('{value}g', { value: '0' })"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('炭水化物') }}</label>
              <UiInput
                v-model.number="mealCarbs"
                type="number"
                step="0.1"
                :placeholder="$t('{value}g', { value: '0' })"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('脂質') }}</label>
              <UiInput
                v-model.number="mealFat"
                type="number"
                step="0.1"
                :placeholder="$t('{value}g', { value: '0' })"
              />
            </div>
          </div>

          <div class="form-group">
            <label>{{ $t('食事写真') }}</label>
            <div class="photo-upload">
              <input
                type="file"
                accept="image/*"
                @change="handlePhotoUpload"
              >
              <div
                v-if="mealPhoto"
                class="photo-preview"
              >
                <img
                  :src="mealPhoto"
                  alt="Meal photo"
                >
                <UiButton
                  variant="danger"
                  icon
                  class="delete-photo-btn"
                  :aria-label="$t('写真を削除')"
                  @click="mealPhoto = undefined"
                >
                  <Icon name="mdi:delete" />
                </UiButton>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>{{ $t('食事メモ') }}</label>
            <textarea
              v-model="mealMemo"
              :placeholder="$t('食事メモ')"
              rows="2"
            />
          </div>
        </div>
      </div>

      <!-- アルバム機能（TODO専用） -->
      <div
        v-if="type === 'todo'"
        class="album-section"
      >
        <div class="album-header">
          <h4>
            <Icon name="mdi:image-multiple" />
            {{ $t('アルバム') }}
          </h4>
          <UiButton
            v-if="albumPhotos.length > 0"
            variant="secondary"
            size="small"
            @click="showPhotoGallery = true"
          >
            <Icon name="mdi:image-multiple-outline" />
            {{ $t('アルバムを表示') }} ({{ albumPhotos.length }})
          </UiButton>
        </div>
        <UiPhotoUpload
          :multiple="true"
          :max-photos="ALBUM_MAX_PHOTOS"
          :current-photo-count="albumPhotos.length"
          :label="$t('写真を追加')"
          @photo-added="handleAlbumPhotoAdded"
        />
        <div
          v-if="albumPhotos.length > 0"
          class="album-preview"
        >
          <div
            v-for="(photo, index) in albumPhotos.slice(0, 3)"
            :key="index"
            class="album-thumb"
          >
            <img
              :src="photo"
              :alt="`Photo ${index + 1}`"
            >
          </div>
          <div
            v-if="albumPhotos.length > 3"
            class="more-photos"
          >
            +{{ albumPhotos.length - 3 }}
          </div>
        </div>
      </div>

      <div class="form-group">
        <label for="edit-amount">{{ $t('金額') }}</label>
        <UiInput
          id="edit-amount"
          v-model="amount"
          type="number"
          :min="0"
          :placeholder="$t('金額を入力')"
          :disabled="type === 'todo'"
        />
      </div>
    </form>
    <template #footer>
      <UiButton
        variant="danger"
        @click="handleDelete"
      >
        <Icon name="mdi:delete" />
        {{ $t('削除') }}
      </UiButton>
      <UiButton
        variant="secondary"
        @click="emit('close')"
      >
        {{ $t('キャンセル') }}
      </UiButton>
      <UiButton
        variant="primary"
        :disabled="isSubmitting || !title.trim()"
        @click="handleSubmit"
      >
        <Icon name="mdi:content-save" />
        {{ $t('保存') }}
      </UiButton>
    </template>

    <!-- アルバム写真ギャラリーモーダル -->
    <UiPhotoGallery
      :photos="albumPhotos"
      :show="showPhotoGallery"
      :allow-delete="true"
      :title="$t('アルバム')"
      @close="showPhotoGallery = false"
      @delete-photo="handleAlbumPhotoDeleted"
    />
  </UiModal>
</template>

<style lang="scss" scoped>
/* 種別選択ボタン */
.type-buttons {
  display: flex;
  gap: 8px;

  .type-btn {
    flex: 1;

    &.type-todo.active {
      background: #e3f2fd;
      color: #1976d2;
      border-color: #2196f3;
    }

    &.type-expense.active {
      background: #ffebee;
      color: #d32f2f;
      border-color: #f44336;
    }

    &.type-income.active {
      background: #e8f5e9;
      color: #388e3c;
      border-color: #4caf50;
    }
  }

  @media (max-width: 380px) {
    .type-btn {
      padding: 8px;
      font-size: 12px;
    }
  }
}

/* 実行時刻入力 */
.time-input-with-clear {
  position: relative;
  display: flex;
  align-items: center;

  .btn-clear {
    position: absolute;
    right: 8px;
  }
}

.label-hint {
  font-size: 11px;
  color: #999;
  font-weight: normal;

  // ダークモード対応
  .dark-mode & {
    color: #888;
  }
}

/* 備考テキストエリア */
.textarea {
  width: 100%;
  padding: 8px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 16px;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.15s ease;

  // ダークモード対応
  .dark-mode & {
    background-color: #2a2a2a;
    border-color: #444;
    color: #e0e0e0;
  }

  &:focus {
    outline: none;
    border-color: #4a90d9;
  }

  @media (max-width: 600px) {
    min-height: 44px;
    font-size: 16px;
  }
}

/* 食事ログセクション */
.meal-log-section {
  margin-bottom: 12px;

  .dark-mode & {
    border-color: #444;
  }
}

.meal-log-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
}

.meal-log-toggle {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: none;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;

  &:hover {
    background: #f5f7fa;
  }

  .dark-mode & {
    border-color: #444;
    color: #e0e0e0;

    &:hover {
      background: #333;
    }
  }
}

.meal-log-form {
  margin-top: 12px;
  padding: 8px;
  background: #f9fafb;
  border-radius: 8px;

  .dark-mode & {
    background: #2a2a2a;
  }

  .form-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;

    @media (max-width: 480px) {
      grid-template-columns: 1fr;
    }
  }

  .form-group {
    label {
      display: block;
      margin-bottom: 4px;
      font-size: 12px;
      color: #666;

      .dark-mode & {
        color: #b0b0b0;
      }
    }
    textarea {
      width: 100%;
      padding: 6px 10px;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      font-size: 14px;
      resize: vertical;

      .dark-mode & {
        background: #333333;
        border-color: #444444;
        color: #e0e0e0;
      }

      &:focus {
        outline: none;
        border-color: #4a90d9;
      }
    }
  }

  .photo-upload {
    input[type="file"] {
      font-size: 13px;
    }

    .photo-preview {
      margin-top: 8px;
      position: relative;

      img {
        width: 100%;
        max-height: 200px;
        object-fit: cover;
        border-radius: 8px;
        overflow: hidden;
      }

      .delete-photo-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        min-width: auto;
        padding: 0 16px;
        opacity: 0.9;

        &:hover {
          opacity: 1;
        }
      }
    }
  }
}

/* アルバムセクション */
.album-section {
  margin-bottom: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;

  .dark-mode & {
    background: #2a2a2a;
  }

  .album-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    h4 {
      font-size: 14px;
      font-weight: 600;
      color: #333;
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0;

      .dark-mode & {
        color: #e0e0e0;
      }
    }
  }

  .album-preview {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    align-items: center;

    .album-thumb {
      width: 60px;
      height: 60px;
      border-radius: 6px;
      overflow: hidden;
      background: white;

      .dark-mode & {
        background: #333333;
      }

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .more-photos {
      font-size: 12px;
      color: #666;
      font-weight: 500;

      .dark-mode & {
        color: #b0b0b0;
      }
    }
  }
}
</style>
