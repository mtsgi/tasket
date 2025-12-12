<script setup lang="ts">
/**
 * アイテム追加フォームコンポーネント
 * 新規アイテム（TODO、支出、収入）を作成するためのフォームを提供
 */
import { useItemsStore } from '~/stores/items'
import { usePresetsStore } from '~/stores/presets'
import { useSettingsStore } from '~/stores/settings'
import type { ItemType } from '~/types/item'

const props = defineProps<{
  date: string
}>()

const itemsStore = useItemsStore()
const presetsStore = usePresetsStore()
const settingsStore = useSettingsStore()

// フォームの状態
const title = ref('')
const amount = ref(0)
const type = ref<ItemType>('todo')
const time = ref('12:00')
const notes = ref('')

const isSubmitting = ref(false)

// プリセット選択のドロップダウン表示状態
const showPresetDropdown = ref(false)

// プリセットをロード
onMounted(async () => {
  await presetsStore.fetchPresets()
})

// 現在の種別に対応するプリセットを取得
const filteredPresets = computed(() => {
  return presetsStore.getPresetsByType(type.value)
})

/**
 * アイテム種別を選択
 */
function selectType(newType: ItemType) {
  type.value = newType
  showPresetDropdown.value = false // 種別を変更したらドロップダウンを閉じる
}

/**
 * プリセットを選択してフォームに反映
 */
function selectPreset(presetId: string) {
  const preset = presetsStore.presets.find(p => p.id === presetId)
  if (preset) {
    title.value = preset.title
    time.value = preset.time
    type.value = preset.type
    amount.value = preset.amount
    notes.value = preset.notes
    showPresetDropdown.value = false
  }
}

/**
 * プリセットドロップダウンの表示切り替え
 */
function togglePresetDropdown() {
  showPresetDropdown.value = !showPresetDropdown.value
}

/**
 * フォーム送信処理
 * 入力データからアイテムを作成し、ストアに追加
 * 注：作成後、種別と時刻はリセットしない（連続入力に便利）
 * 日付変更線を考慮して、0時〜日付変更線までの時刻の場合は翌日の日付を使用
 */
async function handleSubmit() {
  if (!title.value.trim()) return

  isSubmitting.value = true
  try {
    const [hours, minutes] = time.value.split(':').map(Number)
    const dateChangeLine = settingsStore.dateChangeLine

    // 日付変更線より前の時刻の場合、翌日の日付を使用
    // 例: 日付変更線が4時で、2時のアイテムを作成する場合
    // 12月12日のビューで作成すると、実際には12月13日の2時として保存される
    // （12月12日の実効範囲は12日4:00〜13日3:59なので、2時は13日分）
    const scheduledAt = new Date(props.date)
    if (hours < dateChangeLine) {
      scheduledAt.setDate(scheduledAt.getDate() + 1)
    }
    scheduledAt.setHours(hours, minutes, 0, 0)

    await itemsStore.createItem({
      title: title.value.trim(),
      amount: type.value === 'todo' ? 0 : amount.value,
      type: type.value,
      scheduled_at: scheduledAt,
      notes: notes.value.trim(),
    })

    // フォームをリセット（種別と時刻はリセットしない）
    title.value = ''
    amount.value = 0
    notes.value = ''
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="item-form card">
    <h2>
      <Icon name="mdi:plus-circle-outline" />
      新規アイテム
    </h2>
    <form @submit.prevent="handleSubmit">
      <!-- プリセット選択 -->
      <div
        v-if="presetsStore.presets.length > 0"
        class="form-group"
      >
        <UiDropdown
          :show="showPresetDropdown"
          :empty-message="type === 'todo' ? 'TODOのプリセットがありません' : type === 'expense' ? '支出のプリセットがありません' : '収入のプリセットがありません'"
          @toggle="togglePresetDropdown"
        >
          <template #trigger>
            <UiButton
              variant="secondary"
              block
            >
              <Icon name="mdi:bookmark-outline" />
              プリセットから選択
              <Icon
                :name="showPresetDropdown ? 'mdi:chevron-up' : 'mdi:chevron-down'"
                class="dropdown-icon"
              />
            </UiButton>
          </template>
          <template
            v-if="filteredPresets.length > 0"
            #content
          >
            <div class="preset-list">
              <button
                v-for="preset in filteredPresets"
                :key="preset.id"
                type="button"
                class="preset-option"
                @click="selectPreset(preset.id)"
              >
                <div class="preset-time">
                  <Icon name="mdi:clock-outline" />
                  {{ preset.time }}
                </div>
                <div class="preset-title">
                  {{ preset.title }}
                </div>
              </button>
            </div>
          </template>
        </UiDropdown>
      </div>

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
            TODO
          </UiButton>
          <UiButton
            variant="secondary"
            class="type-btn type-expense"
            :class="{ active: type === 'expense' }"
            @click="selectType('expense')"
          >
            <Icon name="mdi:cart-outline" />
            支出
          </UiButton>
          <UiButton
            variant="secondary"
            class="type-btn type-income"
            :class="{ active: type === 'income' }"
            @click="selectType('income')"
          >
            <Icon name="mdi:wallet-plus-outline" />
            収入
          </UiButton>
        </div>
      </div>

      <div class="form-group">
        <UiInput
          id="time"
          v-model="time"
          type="time"
        />
      </div>

      <div class="form-group">
        <UiInput
          id="title"
          v-model="title"
          type="text"
          placeholder="アイテム名を入力"
          required
        />
      </div>

      <!-- 備考 -->
      <div class="form-group">
        <textarea
          id="notes"
          v-model="notes"
          class="form-control textarea"
          placeholder="備考（任意）"
          rows="2"
        />
      </div>

      <div
        v-if="type !== 'todo'"
        class="form-group"
      >
        <label for="amount">金額</label>
        <UiInput
          id="amount"
          v-model="amount"
          type="number"
          :min="0"
          placeholder="金額を入力"
        />
      </div>

      <UiButton
        type="submit"
        variant="primary"
        block
        :disabled="isSubmitting || !title.trim()"
      >
        <Icon name="mdi:plus" />
        追加
      </UiButton>
    </form>
  </section>
</template>

<style lang="scss" scoped>
.item-form {
  h2 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 16px;
    color: #666;

    @media (max-width: 600px) {
      font-size: 14px;
      margin-bottom: 12px;
    }
  }
}

/* プリセット選択 */
.dropdown-icon {
  margin-left: auto;
}

.preset-list {
  .preset-option {
    width: 100%;
    padding: 12px 16px;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.15s ease;
    display: flex;
    align-items: center;
    gap: 12px;

    &:hover {
      background-color: #f5f7fa;

      .dark-mode & {
        background-color: #333;
      }
    }

    &:not(:last-child) {
      border-bottom: 1px solid #e0e0e0;

      .dark-mode & {
        border-color: #444;
      }
    }

    .preset-time {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 14px;
      font-weight: 500;
      color: #666;
      min-width: 70px;

      .dark-mode & {
        color: #b0b0b0;
      }
    }

    .preset-title {
      font-size: 14px;
      color: #333;
      flex: 1;

      .dark-mode & {
        color: #e0e0e0;
      }
    }
  }
}

/* 種別選択ボタン */
.type-buttons {
  display: flex;
  gap: 8px;

  .type-btn {
    flex: 1;
    padding: 8px;
    font-size: 12px;

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
</style>
