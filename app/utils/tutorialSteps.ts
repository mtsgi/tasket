/**
 * チュートリアルステップ定義
 * 各ステップのタイトル、説明、アイコンを定義します。
 */

export interface TutorialStep {
  titleKey: string // タイトルの翻訳キー
  descriptionKey: string // 説明の翻訳キー（HTML可）
  icon: string // Material Design Iconの名前
  image?: string // オプション: 説明用の画像
}

/**
 * チュートリアルステップの配列
 */
export const tutorialSteps: TutorialStep[] = [
  {
    titleKey: 'tutorial.welcome.title',
    descriptionKey: 'tutorial.welcome.description',
    icon: 'mdi:hand-wave',
  },
  {
    titleKey: 'tutorial.datamodel.title',
    descriptionKey: 'tutorial.datamodel.description',
    icon: 'mdi:database',
  },
  {
    titleKey: 'tutorial.monthview.title',
    descriptionKey: 'tutorial.monthview.description',
    icon: 'mdi:calendar-month',
  },
  {
    titleKey: 'tutorial.dayview.title',
    descriptionKey: 'tutorial.dayview.description',
    icon: 'mdi:calendar-today',
  },
  {
    titleKey: 'tutorial.health.title',
    descriptionKey: 'tutorial.health.description',
    icon: 'mdi:heart-pulse',
  },
  {
    titleKey: 'tutorial.meallog.title',
    descriptionKey: 'tutorial.meallog.description',
    icon: 'mdi:food',
  },
  {
    titleKey: 'tutorial.routines.title',
    descriptionKey: 'tutorial.routines.description',
    icon: 'mdi:checkbox-multiple-marked',
  },
  {
    titleKey: 'tutorial.presets.title',
    descriptionKey: 'tutorial.presets.description',
    icon: 'mdi:star',
  },
  {
    titleKey: 'tutorial.data.title',
    descriptionKey: 'tutorial.data.description',
    icon: 'mdi:database-export',
  },
  {
    titleKey: 'tutorial.features.title',
    descriptionKey: 'tutorial.features.description',
    icon: 'mdi:cog',
  },
  {
    titleKey: 'tutorial.start.title',
    descriptionKey: 'tutorial.start.description',
    icon: 'mdi:rocket-launch',
  },
]
