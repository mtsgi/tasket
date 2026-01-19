<script setup lang="ts">
/**
 * 写真ギャラリーモーダルコンポーネント
 * 写真をサムネイル・拡大表示し、削除機能を提供
 */
const { t } = useI18n()

const props = defineProps<{
  // 表示する写真の配列（Base64エンコードされた画像データ）
  photos: string[]
  // モーダルを表示するかどうか
  show: boolean
  // 削除ボタンを表示するかどうか
  allowDelete?: boolean
  // タイトル
  title?: string
}>()

const emit = defineEmits<{
  'close': []
  // 写真削除（削除された写真のインデックス）
  'delete-photo': [index: number]
}>()

// 現在拡大表示している写真のインデックス
const selectedPhotoIndex = ref<number | null>(null)

/**
 * 写真を拡大表示
 */
function viewPhoto(index: number) {
  selectedPhotoIndex.value = index
}

/**
 * 拡大表示を閉じる
 */
function closePhotoView() {
  selectedPhotoIndex.value = null
}

/**
 * 前の写真を表示
 */
function showPrevPhoto() {
  if (selectedPhotoIndex.value === null) return
  if (selectedPhotoIndex.value > 0) {
    selectedPhotoIndex.value--
  }
}

/**
 * 次の写真を表示
 */
function showNextPhoto() {
  if (selectedPhotoIndex.value === null) return
  if (selectedPhotoIndex.value < props.photos.length - 1) {
    selectedPhotoIndex.value++
  }
}

/**
 * 写真を削除
 */
function deletePhoto(index: number) {
  if (confirm(t('この写真を削除しますか？'))) {
    emit('delete-photo', index)
    // 拡大表示中の写真が削除された場合、拡大表示を閉じる
    if (selectedPhotoIndex.value === index) {
      closePhotoView()
    }
    else if (selectedPhotoIndex.value !== null && selectedPhotoIndex.value > index) {
      // 削除された写真より後ろを見ている場合、インデックスを調整
      selectedPhotoIndex.value--
    }
  }
}

/**
 * キーボードナビゲーション
 */
function handleKeydown(event: KeyboardEvent) {
  if (selectedPhotoIndex.value === null) return

  if (event.key === 'ArrowLeft') {
    showPrevPhoto()
  }
  else if (event.key === 'ArrowRight') {
    showNextPhoto()
  }
  else if (event.key === 'Escape') {
    closePhotoView()
  }
}

// コンポーネントマウント時にキーボードイベントリスナーを追加
onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

// コンポーネントアンマウント時にイベントリスナーを削除
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <UiModal
    v-if="show"
    :show="show"
    :title="title || $t('写真ギャラリー')"
    @close="emit('close')"
  >
    <div class="photo-gallery">
      <div
        v-if="photos.length === 0"
        class="empty-state"
      >
        <Icon
          name="mdi:image-off-outline"
          class="empty-icon"
        />
        <p>{{ $t('写真がありません') }}</p>
      </div>
      <div
        v-else
        class="photo-grid"
      >
        <div
          v-for="(photo, index) in photos"
          :key="index"
          class="photo-item"
        >
          <img
            :src="photo"
            :alt="`Photo ${index + 1}`"
            class="photo-thumbnail"
            @click="viewPhoto(index)"
          >
          <UiButton
            v-if="allowDelete"
            variant="danger"
            icon
            class="delete-btn"
            :aria-label="$t('削除')"
            @click="deletePhoto(index)"
          >
            <Icon name="mdi:delete" />
          </UiButton>
        </div>
      </div>
    </div>

    <!-- 拡大表示モーダル -->
    <div
      v-if="selectedPhotoIndex !== null"
      class="photo-viewer"
      @click="closePhotoView"
    >
      <div class="photo-viewer-content">
        <button
          class="nav-btn prev-btn"
          :disabled="selectedPhotoIndex === 0"
          :aria-label="$t('前の写真')"
          @click.stop="showPrevPhoto"
        >
          <Icon name="mdi:chevron-left" />
        </button>
        <img
          :src="photos[selectedPhotoIndex]"
          :alt="`Photo ${selectedPhotoIndex + 1}`"
          class="photo-full"
          @click.stop
        >
        <button
          class="nav-btn next-btn"
          :disabled="selectedPhotoIndex === photos.length - 1"
          :aria-label="$t('次の写真')"
          @click.stop="showNextPhoto"
        >
          <Icon name="mdi:chevron-right" />
        </button>
        <button
          class="close-btn"
          :aria-label="$t('閉じる')"
          @click.stop="closePhotoView"
        >
          <Icon name="mdi:close" />
        </button>
        <div class="photo-counter">
          {{ selectedPhotoIndex + 1 }} / {{ photos.length }}
        </div>
      </div>
    </div>
  </UiModal>
</template>

<style lang="scss" scoped>
.photo-gallery {
  min-height: 200px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #999;

  .empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  p {
    font-size: 14px;
  }
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;

  @media (max-width: 480px) {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
  }
}

.photo-item {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 8px;
  background: #f5f7fa;

  .dark-mode & {
    background: #2a2a2a;
  }

  .photo-thumbnail {
    width: 100%;
    height: 100%;
    object-fit: cover;
    cursor: pointer;
    transition: transform 0.2s;

    &:hover {
      transform: scale(1.05);
    }
  }

  .delete-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    padding: 0px 15px;
    min-width: auto;
    opacity: 0.9;

    &:hover {
      opacity: 1;
    }
  }
}

.photo-viewer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.photo-viewer-content {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 80px;

  @media (max-width: 768px) {
    padding: 60px 20px;
  }

  .photo-full {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    cursor: default;
  }

  .nav-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.9);
    border: none;
    border-radius: 50%;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 24px;
    color: #333;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background: white;
      transform: translateY(-50%) scale(1.1);
    }

    &:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    &.prev-btn {
      left: 20px;
    }

    &.next-btn {
      right: 20px;
    }

    @media (max-width: 768px) {
      width: 40px;
      height: 40px;
      font-size: 20px;

      &.prev-btn {
        left: 10px;
      }

      &.next-btn {
        right: 10px;
      }
    }
  }

  .close-btn {
    position: absolute;
    top: 20px;
    right: 20px;
    background: rgba(255, 255, 255, 0.9);
    border: none;
    border-radius: 50%;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 24px;
    color: #333;
    transition: all 0.2s;

    &:hover {
      background: white;
      transform: scale(1.1);
    }

    @media (max-width: 768px) {
      width: 40px;
      height: 40px;
      font-size: 20px;
      top: 10px;
      right: 10px;
    }
  }

  .photo-counter {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(255, 255, 255, 0.9);
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 500;
    color: #333;

    @media (max-width: 768px) {
      bottom: 10px;
      font-size: 12px;
      padding: 6px 12px;
    }
  }
}
</style>
