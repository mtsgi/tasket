<script setup lang="ts">
/**
 * 写真アップロード共通コンポーネント
 * 単一または複数の写真をアップロードできる汎用的なフォームコンポーネント
 */

const { t } = useI18n()

const props = defineProps<{
  // 複数枚の写真を許可するかどうか
  multiple?: boolean
  // 最大アップロード枚数（multipleがtrueの場合のみ有効）
  maxPhotos?: number
  // ラベルテキスト
  label?: string
  // 現在の写真枚数（親コンポーネントから渡される）
  currentPhotoCount?: number
}>()

const emit = defineEmits<{
  // 写真が追加されたときに発火（Base64エンコードされた画像データ）
  'photo-added': [photo: string]
  // 写真が削除されたときに発火（削除された写真のインデックス）
  'photo-removed': [index: number]
}>()

/**
 * 画像ファイルを選択
 */
function handlePhotoUpload(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files) return

  const files = props.multiple ? Array.from(input.files) : [input.files[0]]

  // 最大枚数チェック
  if (props.multiple && props.maxPhotos && props.currentPhotoCount !== undefined) {
    const remainingSlots = props.maxPhotos - props.currentPhotoCount
    if (remainingSlots <= 0) {
      alert(t('最大{count}枚まで追加できます', { count: props.maxPhotos }))
      input.value = ''
      return
    }
    // 残り枚数分のみ処理
    files.splice(remainingSlots)
  }

  files.forEach((file) => {
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      if (result) {
        emit('photo-added', result)
      }
    }
    reader.readAsDataURL(file)
  })

  // ファイル選択後、inputをリセット（同じファイルを再選択可能にする）
  input.value = ''
}
</script>

<template>
  <div class="photo-upload">
    <label v-if="label">{{ label }}</label>
    <input
      type="file"
      accept="image/*"
      :multiple="multiple"
      class="photo-input"
      @change="handlePhotoUpload"
    >
  </div>
</template>

<style lang="scss" scoped>
.photo-upload {
  label {
    display: block;
    margin-bottom: 4px;
    font-size: 12px;
    color: #666;

    .dark-mode & {
      color: #b0b0b0;
    }
  }

  .photo-input {
    font-size: 13px;
    width: 100%;
  }
}
</style>
