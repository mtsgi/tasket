/**
 * チュートリアルステップ定義
 * 各ステップのタイトル、説明、アイコンを定義します。
 */

export interface TutorialStep {
  title: string // ステップのタイトル
  description: string // ステップの説明（HTML可）
  icon: string // Material Design Iconの名前
  image?: string // オプション: 説明用の画像
}

/**
 * チュートリアルステップの配列
 */
export const tutorialSteps: TutorialStep[] = [
  {
    title: 'Tasketへようこそ！',
    description: `
      <p>Tasketは、TODO・家計簿・カレンダーを統合したオールインワンの生活管理アプリです。</p>
      <p>このチュートリアルでは、主な機能と使い方をご紹介します。</p>
      <p>いつでもスキップできますし、メニューからまた見ることができます。</p>
    `,
    icon: 'mdi:hand-wave',
  },
  {
    title: '統一データモデル',
    description: `
      <p>Tasketの特徴は、<strong>TODO・収入・支出をすべて「アイテム」として統一管理</strong>することです。</p>
      <p>すべてのアイテムには「予定日時」があり、カレンダー上に配置されます。</p>
      <ul>
        <li><strong>TODO</strong>: タスク管理に（金額は0円）</li>
        <li><strong>収入</strong>: 給料や臨時収入の記録に</li>
        <li><strong>支出</strong>: 日々の出費の記録に</li>
      </ul>
    `,
    icon: 'mdi:database',
  },
  {
    title: '月ごとのビュー',
    description: `
      <p><strong>月ごとのビュー</strong>では、月全体を俯瞰できます。</p>
      <ul>
        <li><strong>カレンダー</strong>: 各日のアイテム数や金額を表示</li>
        <li><strong>収支推移グラフ</strong>: 日ごとの収支の変化を可視化</li>
        <li><strong>月次サマリー</strong>: 月の収支とタスク数の集計</li>
        <li><strong>支出ランキング</strong>: 何にお金を使っているか一目で把握</li>
        <li><strong>日課達成グリッド</strong>: 毎日の習慣の継続状況を確認</li>
      </ul>
      <p>日付をクリックすると、その日の詳細ビューに移動します。</p>
    `,
    icon: 'mdi:calendar-month',
  },
  {
    title: '日ごとのビュー',
    description: `
      <p><strong>日ごとのビュー</strong>では、特定の日のタスクと収支を詳細に管理できます。</p>
      <ul>
        <li><strong>日タイトル</strong>: その日のメインタスクを設定</li>
        <li><strong>週表示カレンダー</strong>: 前後の日付に素早く移動</li>
        <li><strong>日課チェックリスト</strong>: 毎日の習慣をチェック</li>
        <li><strong>日次サマリー</strong>: その日の収支とタスク数を表示</li>
        <li><strong>アイテム一覧</strong>: 時刻順にアイテムを管理</li>
      </ul>
      <p>アイテムをタップすると詳細編集ができます。</p>
    `,
    icon: 'mdi:calendar-today',
  },
  {
    title: '日課機能',
    description: `
      <p><strong>日課（ルーティン）</strong>は、毎日繰り返し行う習慣やタスクを管理する機能です。</p>
      <ul>
        <li>月ごとに日課を設定できます</li>
        <li>毎日の達成状況を3段階で記録（未確認・未達成・達成）</li>
        <li>達成グリッドで継続状況を視覚的に確認</li>
      </ul>
      <p>メニューの「日課管理」から設定できます。</p>
    `,
    icon: 'mdi:checkbox-multiple-marked',
  },
  {
    title: 'プリセット機能',
    description: `
      <p><strong>プリセット</strong>は、よく使うアイテムをテンプレートとして保存する機能です。</p>
      <ul>
        <li>繰り返し入力するアイテム（定期的な支出など）を登録</li>
        <li>アイテム追加時に素早く呼び出せる</li>
        <li>時刻や金額も保存されるので入力の手間が省けます</li>
      </ul>
      <p>アイテム編集画面から「プリセットとして保存」できます。</p>
    `,
    icon: 'mdi:star',
  },
  {
    title: 'データ管理',
    description: `
      <p>Tasketのデータは<strong>ブラウザのIndexedDB</strong>に保存されます。</p>
      <ul>
        <li><strong>エクスポート</strong>: データをJSONファイルでバックアップ</li>
        <li><strong>インポート</strong>: バックアップからデータを復元</li>
        <li><strong>サンプルデータ</strong>: 初めての方向けにサンプルを追加可能</li>
      </ul>
      <p>メニューの「データ管理」からアクセスできます。</p>
      <p><strong>※注意</strong>: ブラウザのデータを削除するとアプリのデータも消えます。定期的なバックアップをお勧めします。</p>
    `,
    icon: 'mdi:database-export',
  },
  {
    title: 'その他の機能',
    description: `
      <ul>
        <li><strong>検索</strong>: すべてのアイテムから横断検索</li>
        <li><strong>ダークモード</strong>: 設定から切り替え可能</li>
        <li><strong>背景画像</strong>: お好みの画像を設定できます</li>
        <li><strong>日付変更線</strong>: 深夜まで作業する方向けの設定</li>
        <li><strong>カレンダー表示設定</strong>: 月ビューの表示項目をカスタマイズ</li>
        <li><strong>ロック機能</strong>: PINコードでアプリを保護</li>
      </ul>
      <p>設定画面から各種カスタマイズができます。</p>
    `,
    icon: 'mdi:cog',
  },
  {
    title: 'さあ、始めましょう！',
    description: `
      <p>チュートリアルは以上です。</p>
      <p>まずは<strong>サンプルデータを追加</strong>して機能を試してみることをお勧めします。</p>
      <p>サンプルデータには、TODO・収入・支出・日課・プリセットの例が含まれています。</p>
      <p>メニュー画面の「サンプルデータを追加」ボタンから追加できます。</p>
      <br>
      <p>このチュートリアルは、メニュー画面の「チュートリアル」ボタンからいつでも見直せます。</p>
      <p><strong>楽しいライフマネジメントを！</strong></p>
    `,
    icon: 'mdi:rocket-launch',
  },
]
