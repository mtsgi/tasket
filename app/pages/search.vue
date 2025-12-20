<script setup lang="ts">
/**
 * 検索ページ
 * アイテムをキーワードや種別で検索できます。
 */
import { useItemsStore } from '~/stores/items'
import ItemCard from '~/components/shared/ItemCard.vue'
import type { ItemType } from '~/types/item'

const router = useRouter()
const itemsStore = useItemsStore()

// 検索キーワード
const searchKeyword = ref('')

// フィルタ用の種別
const selectedType = ref<ItemType | ''>('')

// 検索結果
const searchResults = computed(() => {
  const type = selectedType.value === '' ? undefined : selectedType.value
  return itemsStore.searchItems(searchKeyword.value, type)
})

// 検索結果の件数
const resultCount = computed(() => searchResults.value.length)

/**
 * 戻るボタン処理
 */
function goBack() {
  router.back()
}

/**
 * 種別フィルタをリセット
 */
function resetTypeFilter() {
  selectedType.value = ''
}

// マウント時にアイテムを取得
onMounted(() => {
  itemsStore.fetchItems()
})
</script>

<template>
  <div class="container">
    <!-- ヘッダー -->
    <header class="search-header">
      <button
        class="btn btn-secondary btn-icon"
        aria-label="戻る"
        @click="goBack"
      >
        <Icon name="mdi:arrow-left" />
      </button>
      <h1>
        <Icon name="mdi:magnify" />
        アイテム検索
      </h1>
    </header>

    <!-- 検索フォーム -->
    <section class="search-form card">
      <div class="form-group">
        <label for="search-input">
          <Icon name="mdi:magnify" />
          キーワード
        </label>
        <UiInput
          id="search-input"
          v-model="searchKeyword"
          type="text"
          placeholder="タイトル、備考、金額で検索..."
        />
      </div>

      <div class="form-group">
        <label>
          <Icon name="mdi:filter" />
          種別でフィルタ
        </label>
        <div class="type-filters">
          <button
            class="filter-btn"
            :class="{ active: selectedType === '' }"
            @click="resetTypeFilter"
          >
            <Icon name="mdi:all-inclusive" />
            すべて
          </button>
          <button
            class="filter-btn"
            :class="{ active: selectedType === 'todo' }"
            @click="selectedType = 'todo'"
          >
            <Icon name="mdi:checkbox-marked-circle-outline" />
            TODO
          </button>
          <button
            class="filter-btn"
            :class="{ active: selectedType === 'expense' }"
            @click="selectedType = 'expense'"
          >
            <Icon name="mdi:cash-minus" />
            支出
          </button>
          <button
            class="filter-btn"
            :class="{ active: selectedType === 'income' }"
            @click="selectedType = 'income'"
          >
            <Icon name="mdi:cash-plus" />
            収入
          </button>
        </div>
      </div>
    </section>

    <!-- 検索結果 -->
    <section class="search-results">
      <div class="results-header">
        <h2>
          <Icon name="mdi:format-list-bulleted" />
          検索結果
        </h2>
        <span class="result-count">{{ resultCount }}件</span>
      </div>

      <div
        v-if="searchResults.length === 0"
        class="empty-state"
      >
        <Icon
          name="mdi:inbox-outline"
          class="empty-icon"
        />
        <p v-if="searchKeyword || selectedType">
          検索条件に一致するアイテムが見つかりません
        </p>
        <p v-else>
          キーワードを入力して検索してください
        </p>
      </div>

      <div
        v-else
        class="results-list"
      >
        <ItemCard
          v-for="item in searchResults"
          :key="item.id"
          :item="item"
        />
      </div>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.search-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;

  h1 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 20px;
    font-weight: 600;
    flex: 1;
  }
}

.search-form {
  margin-bottom: 24px;

  .form-group {
    margin-bottom: 16px;

    &:last-child {
      margin-bottom: 0;
    }

    label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 600;
      color: #666;
      margin-bottom: 8px;
    }
  }

  .type-filters {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;

    @media (min-width: 500px) {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .filter-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 12px;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    background-color: white;
    color: #666;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background-color: #f5f7fa;
    }

    &.active {
      background-color: #4a90d9;
      color: white;
      border-color: #4a90d9;
    }

    @media (max-width: 600px) {
      min-height: 44px;
    }
  }
}

.search-results {
  .results-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;

    h2 {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 16px;
      font-weight: 600;
      color: #666;
    }

    .result-count {
      font-size: 14px;
      font-weight: 600;
      color: #4a90d9;
      background-color: rgba(74, 144, 217, 0.1);
      padding: 4px 12px;
      border-radius: 12px;
    }
  }

  .empty-state {
    text-align: center;
    padding: 48px 16px;

    .empty-icon {
      font-size: 64px;
      color: #ccc;
      margin-bottom: 16px;
    }

    p {
      font-size: 14px;
      color: #666;
      line-height: 1.5;
    }
  }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
}

// ダークモード対応
.dark-mode {
  .filter-btn {
    background-color: #2a2a2a;
    border-color: #444;
    color: #e0e0e0;

    &:hover {
      background-color: #333;
    }

    &.active {
      background-color: #4a90d9;
      color: white;
      border-color: #4a90d9;
    }
  }

  .result-count {
    background-color: rgba(74, 144, 217, 0.2);
  }
}
</style>
