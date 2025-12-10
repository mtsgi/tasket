<script setup lang="ts">
/**
 * プリセット追加/編集モーダルコンポーネント
 * プリセットの作成と編集を行うためのフォームを提供
 */
import type { ItemType, Preset } from '~/types/item'

const props = defineProps<{
  show: boolean
  preset?: Preset | null
}>()

const emit = defineEmits<{
  close: []
  save: [data: {
    title: string
    time: string
    type: ItemType
    amount: number
    notes: string
  }]
}>()

// フォームの状態
const title = ref('')
const time = ref('12:00')
const type = ref<ItemType>('todo')
const amount = ref(0)
const notes = ref('')

// プリセットが渡された場合は編集モード
const isEditMode = computed(() => !!props.preset)

// モーダルが開かれたときにプリセットの値をフォームに反映
watch(() => props.show, (show) => {
  if (show) {
    if (props.preset) {
      // 編集モード：プリセットの値をフォームに設定
      title.value = props.preset.title
      time.value = props.preset.time
      type.value = props.preset.type
      amount.value = props.preset.amount
      notes.value = props.preset.notes
    }
    else {
      // 新規作成モード：フォームをリセット
      title.value = ''
      time.value = '12:00'
      type.value = 'todo'
      amount.value = 0
      notes.value = ''
    }
  }
})

/**
 * アイテム種別を選択
 */
function selectType(newType: ItemType) {
  type.value = newType
}

/**
 * フォーム送信処理
 */
function handleSubmit() {
  if (!title.value.trim()) return

  emit('save', {
    title: title.value.trim(),
    time: time.value,
    type: type.value,
    amount: type.value === 'todo' ? 0 : amount.value,
    notes: notes.value.trim(),
  })
}

/**
 * モーダルを閉じる
 */
function handleClose() {
  emit('close')
}
</script>

<template>
  <UiModal
    :show="show"
    :title="isEditMode ? 'プリセットを編集' : '新規プリセット'"
    @close="handleClose"
  >
    <form
      class="preset-form"
      @submit.prevent="handleSubmit"
    >
      <!-- 種別選択ボタン -->
      <div class="form-group">
        <label>種別</label>
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

      <!-- 時刻 -->
      <div class="form-group">
        <label for="preset-time">時刻</label>
        <UiInput
          id="preset-time"
          v-model="time"
          type="time"
          required
        />
      </div>

      <!-- タイトル -->
      <div class="form-group">
        <label for="preset-title">タイトル</label>
        <UiInput
          id="preset-title"
          v-model="title"
          type="text"
          placeholder="例: 昼食、買い物、給料"
          required
        />
      </div>

      <!-- 金額（収入・支出のみ） -->
      <div
        v-if="type !== 'todo'"
        class="form-group"
      >
        <label for="preset-amount">金額</label>
        <UiInput
          id="preset-amount"
          v-model="amount"
          type="number"
          :min="0"
          placeholder="金額を入力"
        />
      </div>

      <!-- 備考 -->
      <div class="form-group">
        <label for="preset-notes">備考（任意）</label>
        <textarea
          id="preset-notes"
          v-model="notes"
          class="form-control textarea"
          placeholder="備考を入力"
          rows="2"
        />
      </div>

      <!-- ボタン -->
      <div class="form-actions">
        <UiButton
          variant="secondary"
          @click="handleClose"
        >
          キャンセル
        </UiButton>
        <UiButton
          type="submit"
          variant="primary"
          :disabled="!title.trim()"
        >
          <Icon :name="isEditMode ? 'mdi:check' : 'mdi:plus'" />
          {{ isEditMode ? '更新' : '作成' }}
        </UiButton>
      </div>
    </form>
  </UiModal>
</template>

<style lang="scss" scoped>
.preset-form {
  .form-group {
    margin-bottom: 16px;

    label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 8px;
      color: #666;

      // ダークモード対応
      .dark-mode & {
        color: #b0b0b0;
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
    padding: 8px 12px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    font-size: 14px;
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

  /* フォームアクション */
  .form-actions {
    display: flex;
    gap: 12px;
    margin-top: 24px;

    button {
      flex: 1;
    }
  }
}
</style>
