# Tasket 開発ガイドライン

## プロジェクト概要

Tasketは、TODO・家計簿・カレンダー機能を統合したオールインワンの生活管理PWAアプリケーションです。

## 技術スタック

- **フレームワーク**: Nuxt 4 (Vue 3 Composition API)
- **状態管理**: Pinia
- **データベース**: IndexedDB (idb ライブラリ)
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
│   └── shared/       # 共通コンポーネント
├── composables/      # Composition API のコンポーザブル
├── pages/            # ルーティングページ
├── stores/           # Pinia ストア
├── types/            # TypeScript 型定義
└── utils/            # ユーティリティ関数
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
}
```

## コーディング規約

### 1. コメント

- ソースコード内のコメントは日本語で記載してください
- 関数やコンポーネントには目的を説明するコメントを追加してください
- 複雑なロジックには適切な説明コメントを入れてください

### 2. スタイリング

- SCSSを使用し、`<style lang="scss" scoped>`で記述してください
- レスポンシブ対応は必須です（モバイルファースト）
- タッチターゲットは最小44pxを確保してください

### 3. コンポーネント設計

- 単一責任の原則に従ってください
- Props と Emits を明確に定義してください
- TypeScript の型を厳密に使用してください

### 4. 状態管理

- グローバル状態は Pinia ストアで管理してください
- ローカル状態はコンポーネント内で ref/reactive を使用してください

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
