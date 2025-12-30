<script setup lang="ts">
/**
 * チュートリアルモーダルコンポーネント
 * アプリの機能説明をステップバイステップで表示します。
 */
import { useTutorialStore } from '~/stores/tutorial'
import { tutorialSteps } from '~/utils/tutorialSteps'

const tutorialStore = useTutorialStore()

// 現在のステップ情報
const currentStepData = computed(() => {
  return tutorialSteps[tutorialStore.currentStep] || tutorialSteps[0]
})

// 進捗状況
const progress = computed(() => {
  return ((tutorialStore.currentStep + 1) / tutorialSteps.length) * 100
})

// 最初のステップか
const isFirstStep = computed(() => tutorialStore.currentStep === 0)

// 最後のステップか
const isLastStep = computed(() => tutorialStore.currentStep === tutorialSteps.length - 1)

/**
 * 次へボタンのクリック
 */
async function handleNext() {
  if (isLastStep.value) {
    await tutorialStore.endTutorial()
  }
  else {
    tutorialStore.nextStep()
  }
}

/**
 * 戻るボタンのクリック
 */
function handlePrevious() {
  tutorialStore.previousStep()
}

/**
 * スキップボタンのクリック
 */
async function handleSkip() {
  const confirmed = confirm('チュートリアルをスキップしますか？\nメニュー画面からいつでも見直すことができます。')
  if (confirmed) {
    await tutorialStore.skipTutorial()
  }
}

/**
 * ステップインジケーターをクリック
 */
function goToStep(index: number) {
  tutorialStore.goToStep(index)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="tutorial-fade">
      <div
        v-if="tutorialStore.isActive"
        class="tutorial-overlay"
        @click.self="handleSkip"
      >
        <div class="tutorial-modal">
          <!-- プログレスバー -->
          <div class="tutorial-progress">
            <div
              class="tutorial-progress-bar"
              :style="{ width: `${progress}%` }"
            />
          </div>

          <!-- ヘッダー -->
          <div class="tutorial-header">
            <div class="tutorial-icon">
              <Icon
                :name="currentStepData.icon"
                class="icon"
              />
            </div>
            <h2 class="tutorial-title">
              {{ currentStepData.title }}
            </h2>
            <button
              class="tutorial-close"
              @click="handleSkip"
            >
              <Icon name="mdi:close" />
            </button>
          </div>

          <!-- コンテンツ -->
          <div
            class="tutorial-content"
            v-html="currentStepData.description"
          />

          <!-- ステップインジケーター -->
          <div class="tutorial-steps">
            <button
              v-for="(step, index) in tutorialSteps"
              :key="index"
              class="step-dot"
              :class="{ active: index === tutorialStore.currentStep }"
              :aria-label="`ステップ ${index + 1}: ${step.title}`"
              @click="goToStep(index)"
            />
          </div>

          <!-- フッター -->
          <div class="tutorial-footer">
            <button
              v-if="!isFirstStep"
              class="btn btn-secondary"
              @click="handlePrevious"
            >
              <Icon name="mdi:chevron-left" />
              戻る
            </button>
            <div class="spacer" />
            <button
              class="btn btn-primary"
              @click="handleNext"
            >
              {{ isLastStep ? '完了' : '次へ' }}
              <Icon
                v-if="!isLastStep"
                name="mdi:chevron-right"
              />
              <Icon
                v-else
                name="mdi:check"
              />
            </button>
          </div>

          <!-- ステップカウンター -->
          <div class="tutorial-counter">
            {{ tutorialStore.currentStep + 1 }} / {{ tutorialSteps.length }}
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.tutorial-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 16px;
  overflow-y: auto;
}

.tutorial-modal {
  background-color: #ffffff;
  border-radius: 16px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;

  // ダークモード対応
  .dark-mode & {
    background-color: #2a2a2a;
    color: #e0e0e0;
  }
}

.tutorial-progress {
  height: 4px;
  background-color: #e0e0e0;
  width: 100%;

  .dark-mode & {
    background-color: #444;
  }
}

.tutorial-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #4a90d9, #5ba3f5);
  transition: width 0.3s ease;
}

.tutorial-header {
  padding: 24px 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.tutorial-icon {
  margin-bottom: 12px;

  .icon {
    font-size: 48px;
    color: #4a90d9;
  }
}

.tutorial-title {
  font-size: 24px;
  font-weight: 700;
  color: #333;
  text-align: center;
  margin: 0;

  .dark-mode & {
    color: #e0e0e0;
  }
}

.tutorial-close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  font-size: 24px;
  color: #999;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }

  .dark-mode &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
}

.tutorial-content {
  padding: 16px 32px;
  flex: 1;
  overflow-y: auto;
  font-size: 15px;
  line-height: 1.7;
  color: #555;

  .dark-mode & {
    color: #b0b0b0;
  }

  :deep(p) {
    margin: 0 0 12px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(ul) {
    margin: 8px 0 12px;
    padding-left: 24px;

    li {
      margin-bottom: 6px;
    }
  }

  :deep(strong) {
    color: #4a90d9;
    font-weight: 600;
  }
}

.tutorial-steps {
  display: flex;
  gap: 8px;
  justify-content: center;
  padding: 16px 24px 8px;
}

.step-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #d0d0d0;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 0;

  &.active {
    background-color: #4a90d9;
    transform: scale(1.3);
  }

  &:hover {
    background-color: #b0b0b0;
  }

  .dark-mode & {
    background-color: #555;

    &.active {
      background-color: #4a90d9;
    }

    &:hover {
      background-color: #777;
    }
  }
}

.tutorial-footer {
  padding: 16px 24px 24px;
  display: flex;
  gap: 12px;
  align-items: center;
}

.spacer {
  flex: 1;
}

.btn {
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  min-height: 44px;

  &.btn-primary {
    background-color: #4a90d9;
    color: #ffffff;

    &:hover {
      background-color: #3d7bbf;
    }

    &:active {
      transform: scale(0.98);
    }
  }

  &.btn-secondary {
    background-color: #e0e0e0;
    color: #333;

    &:hover {
      background-color: #d0d0d0;
    }

    &:active {
      transform: scale(0.98);
    }

    .dark-mode & {
      background-color: #444;
      color: #e0e0e0;

      &:hover {
        background-color: #555;
      }
    }
  }
}

.tutorial-counter {
  position: absolute;
  bottom: 32px;
  left: 24px;
  font-size: 13px;
  color: #999;
  font-weight: 500;

  .dark-mode & {
    color: #777;
  }
}

// アニメーション
.tutorial-fade-enter-active,
.tutorial-fade-leave-active {
  transition: opacity 0.3s ease;
}

.tutorial-fade-enter-from,
.tutorial-fade-leave-to {
  opacity: 0;
}

// レスポンシブ対応
@media (max-width: 600px) {
  .tutorial-modal {
    max-height: 95vh;
    border-radius: 12px;
  }

  .tutorial-header {
    padding: 20px 20px 12px;
  }

  .tutorial-icon .icon {
    font-size: 40px;
  }

  .tutorial-title {
    font-size: 20px;
  }

  .tutorial-content {
    padding: 12px 24px;
    font-size: 14px;
  }

  .tutorial-footer {
    padding: 12px 20px 20px;
    flex-wrap: wrap;

    .btn {
      font-size: 14px;
      padding: 10px 20px;
    }
  }

  .tutorial-counter {
    bottom: 28px;
    left: 20px;
    font-size: 12px;
  }
}
</style>
