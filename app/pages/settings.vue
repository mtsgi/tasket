<script setup lang="ts">
/**
 * 設定画面
 * ダークモードの切り替え、背景画像の選択などのアプリ設定を提供します。
 */
import { useSettingsStore } from '~/stores/settings'

const settingsStore = useSettingsStore()

// 利用可能な背景画像のリスト
const backgroundImages = [
  { value: 'none', label: 'なし', preview: '' },
  { value: '/backgrounds/gradient-1.jpg', label: 'グラデーション 1', preview: '/backgrounds/gradient-1.jpg' },
  { value: '/backgrounds/gradient-2.jpg', label: 'グラデーション 2', preview: '/backgrounds/gradient-2.jpg' },
  { value: '/backgrounds/gradient-3.jpg', label: 'グラデーション 3', preview: '/backgrounds/gradient-3.jpg' },
  { value: '/backgrounds/nature-1.jpg', label: '自然 1', preview: '/backgrounds/nature-1.jpg' },
  { value: '/backgrounds/nature-2.jpg', label: '自然 2', preview: '/backgrounds/nature-2.jpg' },
]

// コンポーネント初期化時に設定を読み込む
onMounted(() => {
  settingsStore.loadSettings()
})

/**
 * 背景画像を選択
 */
function selectBackground(value: string) {
  settingsStore.setBackgroundImage(value)
}
</script>

<template>
  <div class="container">
    <!-- ヘッダー -->
    <header class="settings-header">
      <h1>
        <Icon name="mdi:cog" />
        設定
      </h1>
    </header>

    <!-- ダークモード設定 -->
    <section class="settings-section card">
      <h2>
        <Icon name="mdi:theme-light-dark" />
        表示設定
      </h2>
      <div class="setting-item">
        <div class="setting-info">
          <h3>ダークモード</h3>
          <p>画面を暗い色調で表示します</p>
        </div>
        <label class="toggle-switch">
          <input
            v-model="settingsStore.darkMode"
            type="checkbox"
            @change="settingsStore.saveSettings()"
          >
          <span class="slider" />
        </label>
      </div>
    </section>

    <!-- 背景画像設定 -->
    <section class="settings-section card">
      <h2>
        <Icon name="mdi:image" />
        背景画像
      </h2>
      <p class="section-description">
        アプリの背景に表示する画像を選択できます
      </p>
      <div class="background-grid">
        <div
          v-for="bg in backgroundImages"
          :key="bg.value"
          class="background-option"
          :class="{ active: settingsStore.backgroundImage === bg.value }"
          @click="selectBackground(bg.value)"
        >
          <div
            class="background-preview"
            :style="bg.value !== 'none' ? { backgroundImage: `url(${bg.preview})` } : {}"
          >
            <Icon
              v-if="bg.value === 'none'"
              name="mdi:close"
              class="no-background-icon"
            />
            <Icon
              v-if="settingsStore.backgroundImage === bg.value"
              name="mdi:check-circle"
              class="selected-icon"
            />
          </div>
          <span class="background-label">{{ bg.label }}</span>
        </div>
      </div>
    </section>

    <!-- 戻るボタン -->
    <div class="back-button">
      <UiButton
        variant="secondary"
        block
        @click="$router.back()"
      >
        <Icon name="mdi:arrow-left" />
        戻る
      </UiButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings-header {
  margin-bottom: 24px;

  h1 {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 24px;
    font-weight: 600;
    text-align: center;
  }
}

.settings-section {
  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: #666;
    margin-bottom: 12px;
  }
}

.section-description {
  font-size: 14px;
  color: #666;
  margin-bottom: 16px;
  line-height: 1.5;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;

  .setting-info {
    flex: 1;

    h3 {
      font-size: 16px;
      font-weight: 500;
      margin-bottom: 4px;
    }

    p {
      font-size: 14px;
      color: #666;
    }
  }
}

// トグルスイッチ
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 52px;
  height: 28px;
  cursor: pointer;

  input {
    opacity: 0;
    width: 0;
    height: 0;

    &:checked + .slider {
      background-color: #4a90d9;
    }

    &:checked + .slider:before {
      transform: translateX(24px);
    }
  }

  .slider {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    border-radius: 28px;
    transition: 0.3s;

    &:before {
      content: '';
      position: absolute;
      height: 20px;
      width: 20px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      border-radius: 50%;
      transition: 0.3s;
    }
  }
}

// 背景画像グリッド
.background-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}

.background-option {
  cursor: pointer;
  text-align: center;
  transition: transform 0.15s ease;

  &:hover {
    transform: translateY(-2px);
  }

  &.active .background-preview {
    border-color: #4a90d9;
    box-shadow: 0 0 0 2px rgba(74, 144, 217, 0.2);
  }

  .background-preview {
    width: 100%;
    aspect-ratio: 1;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    background-color: #f5f5f5;
    background-size: cover;
    background-position: center;
    position: relative;
    overflow: hidden;
    transition: all 0.15s ease;

    .no-background-icon {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 32px;
      color: #ccc;
    }

    .selected-icon {
      position: absolute;
      top: 8px;
      right: 8px;
      font-size: 24px;
      color: #4a90d9;
      background-color: white;
      border-radius: 50%;
    }
  }

  .background-label {
    display: block;
    margin-top: 8px;
    font-size: 14px;
    color: #666;
  }
}

.back-button {
  margin-top: 24px;
}

@media (max-width: 600px) {
  .settings-header {
    margin-bottom: 16px;

    h1 {
      font-size: 20px;
    }
  }

  .background-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
  }

  .setting-item {
    padding: 8px 0;

    .setting-info {
      h3 {
        font-size: 14px;
      }

      p {
        font-size: 12px;
      }
    }
  }

  .back-button {
    margin-top: 16px;
  }
}
</style>
