<script setup lang="ts">
/**
 * 月ごとの写真アルバムコンポーネント
 * 特定の月のすべての写真をグリッド表示
 */
import type { Item } from '~/types/item'
import { formatDisplayDate } from '~/utils/dateHelpers'

const props = defineProps<{
  // 表示する月のアイテムリスト
  items: Item[]
}>()

const showPhotoGallery = ref(false)
const selectedItemPhotos = ref<string[]>([])
const selectedItemTitle = ref('')

/**
 * 月ごとのすべての写真を取得（日付情報付き）
 */
const allPhotos = computed(() => {
  const photos: Array<{
    photo: string
    itemTitle: string
    itemId: string
    date: string
    displayDate: string
  }> = []

  props.items.forEach((item) => {
    const dateStr = formatDisplayDate(item.scheduled_at)

    // 食事ログの写真
    if (item.mealLog?.photo) {
      photos.push({
        photo: item.mealLog.photo,
        itemTitle: item.title,
        itemId: item.id,
        date: item.scheduled_at.toISOString(),
        displayDate: dateStr,
      })
    }

    // アルバム写真
    if (item.photos && item.photos.length > 0) {
      item.photos.forEach((photo) => {
        photos.push({
          photo,
          itemTitle: item.title,
          itemId: item.id,
          date: item.scheduled_at.toISOString(),
          displayDate: dateStr,
        })
      })
    }
  })

  // 日付順にソート（新しい順）
  return photos.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
})

/**
 * 写真をクリックしたとき、そのアイテムの写真をギャラリー表示
 */
function handlePhotoClick(photoData: {
  photo: string
  itemTitle: string
  itemId: string
  date: string
  displayDate: string
}) {
  const item = props.items.find(i => i.id === photoData.itemId)
  if (!item) return

  // そのアイテムのすべての写真を取得
  const itemAllPhotos: string[] = []

  if (item.mealLog?.photo) {
    itemAllPhotos.push(item.mealLog.photo)
  }

  if (item.photos && item.photos.length > 0) {
    itemAllPhotos.push(...item.photos)
  }

  selectedItemPhotos.value = itemAllPhotos
  selectedItemTitle.value = `${item.title} (${photoData.displayDate})`
  showPhotoGallery.value = true
}
</script>

<template>
  <section
    v-if="allPhotos.length > 0"
    class="monthly-photo-album card"
  >
    <h2>
      <Icon name="mdi:image-multiple" />
      {{ $t('アルバム') }}
    </h2>
    <p class="photo-count">
      {{ $t('{count}枚の写真', { count: allPhotos.length }) }}
    </p>
    <div class="photo-grid">
      <div
        v-for="(photoData, index) in allPhotos"
        :key="index"
        class="photo-item"
        @click="handlePhotoClick(photoData)"
      >
        <img
          :src="photoData.photo"
          :alt="photoData.itemTitle"
          class="photo-thumbnail"
        >
        <div class="photo-info">
          <div class="photo-date">
            {{ photoData.displayDate }}
          </div>
          <div class="photo-label">
            {{ photoData.itemTitle }}
          </div>
        </div>
      </div>
    </div>

    <!-- 写真ギャラリーモーダル -->
    <UiPhotoGallery
      :photos="selectedItemPhotos"
      :show="showPhotoGallery"
      :allow-delete="false"
      :title="selectedItemTitle"
      @close="showPhotoGallery = false"
    />
  </section>
</template>

<style lang="scss" scoped>
.monthly-photo-album {
  h2 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 8px;
    color: #666;
    display: flex;
    align-items: center;
    gap: 6px;

    // ダークモード対応
    .dark-mode & {
      color: #b0b0b0;
    }

    @media (max-width: 600px) {
      font-size: 14px;
    }
  }

  .photo-count {
    font-size: 13px;
    color: #999;
    margin-bottom: 16px;

    .dark-mode & {
      color: #888;
    }
  }
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;

  @media (max-width: 600px) {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px;
  }

  @media (max-width: 480px) {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
  }
}

.photo-item {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 8px;
  background: #f5f7fa;
  cursor: pointer;
  transition: transform 0.2s;

  .dark-mode & {
    background: #2a2a2a;
  }

  &:hover {
    transform: scale(1.05);

    .photo-info {
      opacity: 1;
    }
  }

  .photo-thumbnail {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .photo-info {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 8px;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
    color: white;
    opacity: 0.85;
    transition: opacity 0.2s;

    .photo-date {
      font-size: 10px;
      font-weight: 600;
      margin-bottom: 2px;
      opacity: 0.9;
    }

    .photo-label {
      font-size: 11px;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}
</style>
