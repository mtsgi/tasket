/**
 * English locale file
 * English translations for all application text
 */
export default {
  // Common
  '読み込み中': 'Loading...',
  '戻る': 'Back',
  '保存': 'Save',
  '削除': 'Delete',
  'キャンセル': 'Cancel',
  '追加': 'Add',
  '編集': 'Edit',
  '完了': 'Complete',
  '確認': 'Confirm',
  '閉じる': 'Close',
  '設定': 'Settings',
  'メニュー': 'Menu',
  '検索': 'Search',

  // Item types
  'TODO': 'TODO',
  '収入': 'Income',
  '支出': 'Expense',
  'やること': 'Tasks',

  // Menu screen
  'チュートリアル': 'Tutorial',
  'チュートリアルを見る': 'View Tutorial',
  'Tasketの使い方や機能を確認できます。いつでも見直すことができます。':
    'Learn how to use Tasket and explore its features. You can review it anytime.',
  'アプリ設定': 'App Settings',
  'ダークモード、背景画像などの表示設定を変更できます。':
    'Change display settings such as dark mode and background image.',
  '設定を開く': 'Open Settings',
  '日課管理': 'Routine Management',
  '毎日繰り返し行う習慣やタスクを月ごとに設定できます。':
    'Set up daily habits and tasks on a monthly basis.',
  'データ管理': 'Data Management',
  'アプリのデータをJSONファイルとしてバックアップ・復元できます。':
    'Back up and restore app data as JSON files.',
  'エクスポート': 'Export',
  'インポート': 'Import',
  'インポート中': 'Importing...',
  'サンプルデータを追加': 'Add Sample Data',
  'サンプルデータ追加中': 'Adding Sample Data...',
  '既にデータが存在するため、サンプルデータを追加できません':
    'Cannot add sample data as data already exists',
  'サンプルデータには、TODO・収入・支出・日課・プリセットの例が含まれます':
    'Sample data includes examples of TODOs, income, expenses, routines, and presets',
  '危険な操作': 'Danger Zone',
  'すべてのデータを削除': 'Delete All Data',
  'アプリ情報': 'App Information',
  'TODO・家計簿・カレンダー統合ライフマネジメントPWAアプリケーション':
    'Integrated Life Management PWA: TODO, Budget, and Calendar',
  '権利表記': 'Credits',
  'ライセンス': 'License',
  '使用技術': 'Technologies',
  'オープンソースライセンス': 'Open Source Licenses',
  'このアプリケーションは多くのOSSモジュールを使用しています。':
    'This application uses many open source modules.',
  'OSSライセンスを表示': 'View OSS Licenses',

  // Notification messages
  'データのエクスポートが完了しました': 'Data export completed',
  'エクスポートに失敗しました': 'Export failed',
  '{count}件のアイテムをインポートしました': '{count} items imported',
  'インポートに失敗しました': 'Import failed',
  '無効なファイル形式です': 'Invalid file format',
  'すべてのデータを削除しました': 'All data has been deleted',
  'データの削除に失敗しました': 'Failed to delete data',
  'サンプルデータを追加しました（アイテム: {itemsCount}件、日課: {routinesCount}件、プリセット: {presetsCount}件）':
    'Sample data added (Items: {itemsCount}, Routines: {routinesCount}, Presets: {presetsCount})',
  'サンプルデータの追加に失敗しました': 'Failed to add sample data',

  // Confirmation dialogs
  '本当にすべてのデータを削除しますか？\nこの操作は取り消せません。\n事前にエクスポートすることをお勧めします。':
    'Are you sure you want to delete all data?\nThis action cannot be undone.\nWe recommend exporting your data first.',
  '現在{count}件のアイテムがあります。\nインポートすると{importCount}件のアイテムが追加されます。\n続行しますか？':
    'You currently have {count} items.\n{importCount} items will be added by importing.\nDo you want to continue?',

  // Settings screen
  '表示設定': 'Display Settings',
  'ダークモード': 'Dark Mode',
  '画面を暗い色調で表示します': 'Display the screen in dark colors',
  '日付変更線': 'Date Change Line',
  '日付変更線を設定すると、指定した時刻から翌日同時刻の直前までを1日として扱います。深夜作業が多い場合に便利です。':
    'Set a date change line to treat the period from a specified time to just before the same time the next day as one day. Useful for late-night work.',
  '日付変更線の時刻': 'Date Change Line Time',
  '時': 'h',
  '（通常の日付変更）': '(Normal date change)',
  '（当日{hour}時〜翌日{nextHour}時台）': '(Today {hour}:00 to tomorrow {nextHour}:59)',
  '例: 4時に設定した場合、12月12日は当日4:00から翌日3:59までを指します':
    'Example: If set to 4:00, December 12 refers to the period from 4:00 on the 12th to 3:59 on the 13th',
  'セキュリティ': 'Security',
  'PINコードまたは生体認証でアプリをロックできます':
    'Lock the app with a PIN code or biometric authentication',
  'ロック機能を有効にすると、アプリ起動時にPINコードの入力が必要になります。':
    'When lock is enabled, a PIN code will be required when launching the app.',
  'PINコードを設定': 'Set PIN Code',
  'ロック機能': 'Lock Function',
  '有効': 'Enabled',
  '生体認証': 'Biometric Authentication',
  '登録済み - 指紋認証・顔認証を使用する': 'Registered - Use fingerprint or face authentication',
  '指紋認証・顔認証を使用する': 'Use fingerprint or face authentication',
  'ロック機能を無効化': 'Disable Lock',
  'ロック機能を無効化しますか？\nPINコードもリセットされます。':
    'Disable the lock function?\nYour PIN code will also be reset.',
  'ロック機能を無効化しました': 'Lock function disabled',
  '背景画像': 'Background Image',
  'アプリの背景に表示する画像を選択できます': 'Select an image to display as the app background',
  'なし': 'None',
  'グラデーション 1': 'Gradient 1',
  'グラデーション 2': 'Gradient 2',
  'グラデーション 3': 'Gradient 3',
  '自然 1': 'Nature 1',
  '自然 2': 'Nature 2',
  'カスタム画像': 'Custom Image',
  '画像ファイルを選択してください': 'Please select an image file',
  'ファイルサイズは5MB以下にしてください': 'File size must be 5MB or less',
  '言語': 'Language',
  'アプリの表示言語を選択できます': 'Select the display language for the app',
  '日本語': 'Japanese',
  '英語': 'English',

  // PIN setup modal
  'PINコード設定': 'PIN Code Setup',
  'PINコードを入力してください（4桁以上）': 'Enter a PIN code (4 digits or more)',
  'もう一度PINコードを入力してください': 'Enter the PIN code again',
  'PINコードは4桁以上で入力してください': 'PIN code must be 4 digits or more',
  'PINコードが一致しません': 'PIN codes do not match',
  'PINコードを設定しました': 'PIN code has been set',
  'PIN設定に失敗しました': 'Failed to set PIN',
  '生体認証を登録しました': 'Biometric authentication registered',
  '生体認証の登録に失敗しました。デバイスが生体認証に対応しているか確認してください。':
    'Failed to register biometric authentication. Please check if your device supports biometric authentication.',
  'このブラウザは生体認証に対応していません': 'This browser does not support biometric authentication',

  // Preset management
  'プリセット管理': 'Preset Management',
  'よく使うタスクをプリセットとして登録しておくと、簡単に追加できます':
    'Register frequently used tasks as presets for easy addition',
  '新しいプリセットを作成': 'Create New Preset',
  'プリセットがありません': 'No presets',
  'プリセット名': 'Preset Name',
  '時刻': 'Time',
  '金額': 'Amount',
  '備考': 'Notes',
  'プリセットを作成': 'Create Preset',
  'プリセットを更新': 'Update Preset',
  'プリセットを削除しますか？': 'Delete this preset?',

  // Item form
  'タイトル': 'Title',
  'タイトルを入力': 'Enter title',
  '種別': 'Type',
  '予定時刻': 'Scheduled Time',
  'プリセットから選択': 'Select from Presets',

  // Item card
  '完了済み': 'Completed',
  '未完了': 'Incomplete',
  '円': 'yen',

  // Routines
  '未確認': 'Unconfirmed',
  '未達成': 'Not Achieved',
  '達成': 'Achieved',
  '日課': 'Routine',
  '日課を追加': 'Add Routine',
  '日課がありません': 'No routines',
  '日課のタイトル': 'Routine Title',
  '日課を作成': 'Create Routine',
  '日課を削除しますか？': 'Delete this routine?',

  // Calendar
  '月（単位）': 'Month',
  '日（単位）': 'Day',
  '月曜': 'Monday',
  '火曜': 'Tuesday',
  '水曜': 'Wednesday',
  '木曜': 'Thursday',
  '金曜': 'Friday',
  '土曜': 'Saturday',
  '日曜': 'Sunday',
  '月（省略形）': 'Mon',
  '火（省略形）': 'Tue',
  '水（省略形）': 'Wed',
  '木（省略形）': 'Thu',
  '金（省略形）': 'Fri',
  '土（省略形）': 'Sat',
  '日（省略形）': 'Sun',

  // Summary
  '収支': 'Balance',
  '残高': 'Total',
  'タスク': 'Tasks',
  '件': '',
  '合計': 'Total',
  '今月の収支': 'This Month\'s Balance',
  '今月のタスク': 'This Month\'s Tasks',
  '今日の収支': 'Today\'s Balance',
  '今日のタスク': 'Today\'s Tasks',

  // Expense ranking
  '支出ランキング': 'Expense Ranking',
  '今月の支出が多い項目': 'Top expenses this month',
  '回': 'times',

  // Search
  '検索結果': 'Search Results',
  'キーワードで検索': 'Search by keyword',
  '該当するアイテムがありません': 'No matching items',

  // Calendar display settings
  'カレンダー表示設定': 'Calendar Display Settings',
  '収入合計を表示': 'Show Total Income',
  '支出合計を表示': 'Show Total Expenses',
  'メインタスクを表示': 'Show Main Task',
  'タスク数を表示': 'Show Task Count',

  // Error messages
  'エラーが発生しました': 'An error occurred',
  '不明なエラー': 'Unknown error',
}
