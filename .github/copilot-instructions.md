# Tasket 開発ガイドライン

## プロジェクト概要

Tasketは、TODO・家計簿・カレンダー・健康管理機能を統合したオールインワンの生活管理PWAアプリケーションです。

## 技術スタック

- **フレームワーク**: Nuxt 4 (Vue 3 Composition API)
- **状態管理**: Pinia
- **データベース**: IndexedDB (idb ライブラリ)
- **多言語化**: @nuxtjs/i18n (日本語ベース、英語対応)
- **スタイリング**: SCSS (手書き)
- **グラフ**: Chart.js (vue-chartjs)
- **日付操作**: dayjs
- **PWA**: @vite-pwa/nuxt

## ディレクトリ構造

```
app/
├── assets/scss/      # グローバルスタイル
├── components/       # Vue コンポーネント
│   ├── DailyView/    # 日ごとのビュー用コンポーネント
│   ├── MonthlyView/  # 月ごとのビュー用コンポーネント
│   ├── settings/     # 設定画面用コンポーネント
│   ├── shared/       # 共通コンポーネント
│   └── ui/           # 汎用UIコンポーネント
├── composables/      # Composition API のコンポーザブル
├── pages/            # ルーティングページ
├── stores/           # Pinia ストア
├── types/            # TypeScript 型定義
└── utils/            # ユーティリティ関数
i18n/
└── locales/          # 多言語リソースファイル
    ├── ja.js         # 日本語（ベース言語）
    └── en.js         # 英語
```

## データモデル

### Item (アイテム)

すべてのアイテム（TODO・収入・支出）を統一的に管理します。

```typescript
interface Item {
  id: string           // UUID
  title: string        // アイテム名
  amount: number       // 金額（TODOの場合は0）
  type: 'todo' | 'expense' | 'income'  // 種別
  is_completed: boolean // 完了状態
  scheduled_at: Date   // 予定日時
  executed_at: Date | null  // 実行日時
  created_at: Date     // 作成日時
  notes: string        // 備考
  mealLog?: MealLog    // 食事ログデータ（TODOの場合のみ）
}
```

### MealLog (食事ログ)

TODOアイテムに紐づけて食事内容を記録します。

```typescript
interface MealLog {
  calories?: number    // カロリー（kcal）
  protein?: number     // タンパク質（g）
  carbs?: number       // 炭水化物（g）
  fat?: number         // 脂質（g）
  photo?: string       // 写真（Base64エンコード）
  memo?: string        // 自由メモ
}
```

### HealthData (健康データ)

日ごとの健康状態を記録します。

```typescript
interface HealthData {
  id: string           // UUID
  date: string         // 記録日（YYYY-MM-DD形式）
  
  // 基本測定値
  weight?: number      // 体重（kg）
  bodyFatPercentage?: number // 体脂肪率（%）
  muscleMass?: number  // 筋肉量（kg）
  visceralFatLevel?: number // 内臓脂肪レベル
  basalMetabolicRate?: number // 基礎代謝量（kcal）
  
  // 循環器系
  systolicBloodPressure?: number // 最高血圧（mmHg）
  diastolicBloodPressure?: number // 最低血圧（mmHg）
  heartRate?: number   // 心拍数（bpm）
  
  // その他のバイタル
  bodyTemperature?: number // 体温（℃）
  spo2?: number        // 血中酸素濃度（%）
  
  // 活動量
  sleepHours?: number  // 睡眠時間（時間）
  steps?: number       // 歩数
  exerciseMinutes?: number // 運動時間（分）
  caloriesBurned?: number // 消費カロリー（kcal）
  waterIntake?: number // 水分摂取量（ml）
  
  // その他
  menstrualCycle?: 'menstruation' | 'follicular' | 'ovulation' | 'luteal' | null
  medicationRecord?: string // 服薬記録
  healthMemo?: string  // 体調メモ
  
  created_at: Date     // 作成日時
  updated_at: Date     // 更新日時
}
```

## コーディング規約

### 1. コメント

- ソースコード内のコメントは日本語で記載してください
- 関数やコンポーネントには目的を説明するコメントを追加してください
- 複雑なロジックには適切な説明コメントを入れてください

### 2. 多言語対応

- **すべてのユーザー向けテキストは`$t()`ヘルパーを使用してください**
- 翻訳キーは日本語で統一されています（例: `$t('設定')`）
- 新しいテキストを追加する場合は、`i18n/locales/ja.js`と`i18n/locales/en.js`の両方に追加してください
- パラメータ化メッセージを使用してください（例: `$t('{count}件のアイテム', { count: items.length })`）
- HTML含有メッセージは許可されていますが、XSS対策として`v-html`使用時は注意してください
- フォールバック言語は日本語です（未翻訳項目は自動的に日本語で表示）

### 3. スタイリング

- SCSSを使用し、`<style lang="scss" scoped>`で記述してください
- レスポンシブ対応は必須です（モバイルファースト）
- タッチターゲットは最小44pxを確保してください

### 4. コンポーネント設計

- 単一責任の原則に従ってください
- Props と Emits を明確に定義してください
- TypeScript の型を厳密に使用してください

### 5. 状態管理

- グローバル状態は Pinia ストアで管理してください
- ローカル状態はコンポーネント内で ref/reactive を使用してください

## 多言語化の実装詳細

### 翻訳キーの命名規則

- 日本語テキストをそのままキーとして使用します（例: `'設定'`, `'アイテムを追加'`）
- ネストされた構造を使用する場合はドット記法を使用します（例: `'tutorial.welcome.title'`）
- パラメータ化メッセージは波括弧を使用します（例: `'{count}件のアイテム'`）

### 新しい言語の追加方法

1. `/i18n/locales/`に新しい言語ファイルを作成（例: `zh.js`）
2. `nuxt.config.ts`の`locales`配列に新しい言語を追加
3. `app/types/item.ts`の`AppSettings`インターフェースで言語コードの型を拡張（例: `'ja' | 'en' | 'zh'`）
4. `app/stores/settings.ts`で新しい言語のサポートを確認

### i18n設定

- デフォルト言語: 日本語 (`ja`)
- サポート言語: 日本語、英語
- フォールバック言語: 日本語
- ブラウザ言語検出: 無効（ユーザーが設定した言語を優先）
- 遅延読み込み: 有効（パフォーマンス最適化）
- HTML含有メッセージ: 許可（チュートリアルなどリッチコンテンツ用）

### 翻訳ファイルの構造

```javascript
// i18n/locales/ja.js
export default {
  // 基本
  '設定': '設定',
  'メニュー': 'メニュー',
  
  // パラメータ化
  '{count}件のアイテム': '{count}件のアイテム',
  
  // ネスト構造
  tutorial: {
    welcome: {
      title: 'Tasketへようこそ！',
      description: '<p>説明文...</p>'
    }
  }
}
```

## 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# プロダクションビルド
npm run build

# リント
npm run lint
```

## PWA 対応

- オフライン動作をサポートしてください
- Service Worker でキャッシュ戦略を適用してください
- アプリマニフェストを適切に設定してください

## テスト

- 重要な機能にはユニットテストを追加してください
- E2Eテストでユーザーフローを検証してください

## アクセシビリティ

- セマンティックHTMLを使用してください
- キーボード操作をサポートしてください
- 適切なARIAラベルを設定してください
