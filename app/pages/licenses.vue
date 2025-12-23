<script setup lang="ts">
/**
 * OSSライセンス表示画面
 * 使用しているOSSモジュールのライセンス情報を表示します。
 */

// ライセンステキストを取得
const licensesText = ref<string>('')
const isLoading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const response = await fetch('/licenses.txt')
    if (!response.ok) {
      throw new Error(`ライセンス情報の取得に失敗しました: ${response.status} ${response.statusText}`)
    }
    licensesText.value = await response.text()
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'エラーが発生しました'
  }
  finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="container">
    <!-- ヘッダー -->
    <header class="licenses-header">
      <NuxtLink
        to="/menu"
        class="back-button"
      >
        <Icon name="mdi:arrow-left" />
      </NuxtLink>
      <h1>
        <Icon name="mdi:license" />
        OSSライセンス
      </h1>
    </header>

    <!-- 説明 -->
    <section class="description card">
      <p>
        このアプリケーションは、以下のオープンソースソフトウェア（OSS）を使用しています。
        各ライセンスの詳細を以下に記載します。
      </p>
    </section>

    <!-- ライセンス表示 -->
    <section class="licenses-section card">
      <div
        v-if="isLoading"
        class="loading-state"
      >
        <Icon
          name="mdi:loading"
          class="loading-icon"
        />
        <p>ライセンス情報を読み込み中...</p>
      </div>

      <div
        v-else-if="error"
        class="error-state"
      >
        <Icon
          name="mdi:alert-circle"
          class="error-icon"
        />
        <p>{{ error }}</p>
      </div>

      <div
        v-else
        class="licenses-content"
      >
        <pre>{{ licensesText }}</pre>
      </div>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.licenses-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;

  .back-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background-color: #f5f7fa;
    color: #666;
    text-decoration: none;
    transition: all 0.2s ease;

    &:hover {
      background-color: #e8ecf1;
      color: #333;
    }
  }

  h1 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 24px;
    font-weight: 600;
    margin: 0;
  }
}

.description {
  margin-bottom: 16px;

  p {
    font-size: 14px;
    color: #666;
    line-height: 1.5;
    margin: 0;
  }
}

.licenses-section {
  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;

    p {
      margin-top: 12px;
      font-size: 14px;
      color: #666;
    }
  }

  .loading-icon {
    font-size: 32px;
    color: #4a90d9;
    animation: spin 1s linear infinite;
  }

  .error-icon {
    font-size: 32px;
    color: #f44336;
  }

  .licenses-content {
    max-height: 70vh;
    overflow-y: auto;

    pre {
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      line-height: 1.6;
      color: #333;
      white-space: pre-wrap;
      word-wrap: break-word;
      margin: 0;
    }
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 600px) {
  .licenses-header {
    margin-bottom: 16px;

    h1 {
      font-size: 20px;
    }
  }

  .licenses-section {
    .licenses-content {
      max-height: 60vh;

      pre {
        font-size: 11px;
      }
    }
  }
}
</style>
