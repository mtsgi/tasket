<script setup lang="ts">
/**
 * 汎用モーダルコンポーネント
 * オーバーレイ付きのモーダルダイアログを提供
 */
defineProps<{
  /** モーダルのタイトル */
  title?: string
  /** 表示状態 */
  show?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

/**
 * オーバーレイクリック時の処理（背景クリックで閉じる）
 */
function handleOverlayClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    emit('close')
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="ui-modal-overlay"
        @click="handleOverlayClick"
      >
        <div class="ui-modal">
          <header
            v-if="title || $slots.header"
            class="ui-modal__header"
          >
            <slot name="header">
              <h2>{{ title }}</h2>
            </slot>
            <UiButton
              variant="secondary"
              icon
              aria-label="閉じる"
              @click="emit('close')"
            >
              <Icon name="mdi:close" />
            </UiButton>
          </header>

          <div class="ui-modal__body">
            <slot />
          </div>

          <footer
            v-if="$slots.footer"
            class="ui-modal__footer"
          >
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.ui-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.ui-modal {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid #e0e0e0;

    h2 {
      font-size: 18px;
      font-weight: 600;
    }
  }

  &__body {
    padding: 16px;
  }

  &__footer {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding: 16px;
    border-top: 1px solid #e0e0e0;
  }
}

// トランジションアニメーション
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;

  .ui-modal {
    transition: transform 0.2s ease;
  }
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;

  .ui-modal {
    transform: scale(0.95);
  }
}

@media (max-width: 600px) {
  .ui-modal-overlay {
    padding: 8px;
    align-items: flex-end;
  }

  .ui-modal {
    max-width: 100%;
    margin: 0;
    border-radius: 12px 12px 0 0;
    max-height: 85vh;

    &__header {
      padding: 12px 16px;
      position: sticky;
      top: 0;
      background: #fff;
      z-index: 1;
    }

    &__body {
      padding: 12px 16px;
    }

    &__footer {
      padding: 12px 16px;
      position: sticky;
      bottom: 0;
      background: #fff;
      flex-wrap: wrap;
    }
  }
}
</style>
