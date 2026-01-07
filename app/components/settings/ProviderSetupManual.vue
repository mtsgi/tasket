<script setup lang="ts">
/**
 * プロバイダーセットアップマニュアルコンポーネント
 * 各クラウドプロバイダーのAPIキー取得方法を案内
 */
import type { CloudProvider } from '~/types/cloudBackup'

const props = defineProps<{
  provider: CloudProvider
}>()

const { t } = useI18n()

// マニュアルコンテンツの定義
const manuals: Record<CloudProvider, { title: string, steps: string[] }> = {
  's3-compatible': {
    title: t('S3互換ストレージの設定方法'),
    steps: [
      '<strong>AWS S3の場合：</strong>',
      '1. AWSマネジメントコンソールにログイン',
      '2. IAM（Identity and Access Management）を開く',
      '3. 「ユーザー」→「ユーザーを追加」をクリック',
      '4. ユーザー名を入力し、「アクセスキー - プログラムによるアクセス」を選択',
      '5. 「次へ: アクセス権限」をクリック',
      '6. 「既存のポリシーを直接アタッチ」を選択し、「AmazonS3FullAccess」を選択',
      '7. レビュー後、「ユーザーの作成」をクリック',
      '8. <strong>アクセスキーID</strong>と<strong>シークレットアクセスキー</strong>をコピー',
      '',
      '<strong>MinIOの場合：</strong>',
      '1. MinIOコンソールにログイン',
      '2. 「Identity」→「Users」を開く',
      '3. 「Create User」をクリック',
      '4. ユーザー名とパスワードを入力',
      '5. 適切なポリシー（readwrite）を割り当て',
      '6. 「Access Keys」タブで新しいアクセスキーを作成',
      '7. <strong>アクセスキー</strong>と<strong>シークレットキー</strong>をコピー',
      '',
      '<strong>Cloudflare R2の場合：</strong>',
      '1. Cloudflareダッシュボードにログイン',
      '2. 「R2」→「概要」を開く',
      '3. バケットを作成または既存のバケットを選択',
      '4. バケット設定で「CORS policy」を設定：',
      '   • 「Settings」タブを開く',
      '   • 「CORS policy」セクションで「Edit CORS policy」をクリック',
      '   • 以下のCORS設定を追加（GETリクエスト対応版）：',
      '   <code>[{',
      '     "AllowedOrigins": ["*"],',
      '     "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],',
      '     "AllowedHeaders": ["*"],',
      '     "ExposeHeaders": ["ETag", "Content-Length", "Content-Type", "x-amz-request-id"]',
      '   }]</code>',
      '   • または本番環境では特定のオリジンのみを許可：',
      '   <code>"AllowedOrigins": ["https://your-domain.com"]</code>',
      '5. 「R2 APIトークンの管理」をクリック',
      '6. 「APIトークンを作成」をクリック',
      '7. トークン名を入力し、アクセス許可を設定',
      '8. <strong>アクセスキーID</strong>と<strong>シークレットアクセスキー</strong>をコピー',
      '9. エンドポイントURLをメモ（例: https://[account-id].r2.cloudflarestorage.com）',
      '',
      '<strong>⚠️ CORS設定に関する重要な注意：</strong>',
      '• ブラウザから直接S3互換APIを呼び出す場合、CORS設定が必須です',
      '• <code>AllowedHeaders: ["*"]</code> でAWS署名ヘッダー（x-amz-*）を許可します',
      '• <code>ExposeHeaders</code> にレスポンスヘッダーを明示的に指定することで、GETリクエストのCORSエラーを回避できます',
      '• 開発環境では <code>"AllowedOrigins": ["*"]</code> を使用できますが、本番環境では特定のドメインのみを許可してください',
      '• Cloudflare R2のCORS設定は、バケット作成後に個別に設定する必要があります',
      '• R2 APIはデフォルトでCORSヘッダーを返さないため、上記の設定が必須です',
      '• GETリクエストがブロックされる場合、<code>ExposeHeaders</code> の設定を確認してください',
      '',
      '<strong>🔍 トラブルシューティング：</strong>',
      '• <strong>CORSエラーが表示される場合：</strong>',
      '  1. ブラウザの開発者ツール（F12）→ ネットワークタブを開く',
      '  2. 失敗したリクエストを選択し、レスポンスヘッダーを確認',
      '  3. <code>access-control-allow-origin</code> ヘッダーが含まれているか確認',
      '  4. 含まれていない場合、バケットのCORS設定が正しく適用されていない可能性',
      '• <strong>署名エラー（SignatureDoesNotMatch）の場合：</strong>',
      '  1. アクセスキーIDとシークレットアクセスキーが正しいか確認',
      '  2. エンドポイントURLが正しいか確認（末尾のスラッシュに注意）',
      '  3. リージョン設定が正しいか確認（R2の場合は "auto"）',
      '  4. バケット名にスペースや特殊文字が含まれていないか確認',
      '• <strong>接続テストが失敗する場合：</strong>',
      '  1. エンドポイントURLが正しいか確認（https://で始まること）',
      '  2. バケットが実際に存在するか確認',
      '  3. APIキーにバケットへのアクセス権限があるか確認',
      '  4. 開発者ツールのコンソールでエラー詳細を確認',
      '',
      '<strong>共通設定項目：</strong>',
      '• <strong>エンドポイント：</strong> ストレージサービスのURL（例: https://s3.amazonaws.com）',
      '  - Cloudflare R2: https://[account-id].r2.cloudflarestorage.com',
      '  - AWS S3: https://s3.[region].amazonaws.com',
      '• <strong>リージョン：</strong> データセンターの地域（例: us-east-1, ap-northeast-1）',
      '  - Cloudflare R2: auto （リージョン指定不要）',
      '• <strong>バケット名：</strong> データを保存するバケットの名前',
    ],
  },
  'webdav': {
    title: t('WebDAVの設定方法'),
    steps: [
      '<strong>Nextcloudの場合：</strong>',
      '1. Nextcloudにログイン',
      '2. 右上のアカウントアイコンをクリック→「設定」を開く',
      '3. 左メニューの「セキュリティ」を選択',
      '4. 「デバイスとセッション」セクションまでスクロール',
      '5. 「新しいアプリパスワードを作成」欄にアプリ名（例: Tasket）を入力',
      '6. 「作成」をクリック',
      '7. 生成された<strong>パスワード</strong>をコピー（ユーザー名は通常のログインIDと同じ）',
      '8. WebDAV URLは通常: <code>https://[your-domain]/remote.php/dav/files/[username]/</code>',
      '',
      '<strong>ownCloudの場合：</strong>',
      '1. ownCloudにログイン',
      '2. 右上の歯車アイコン→「個人設定」を開く',
      '3. 左メニューの「セキュリティ」を選択',
      '4. 「アプリパスワード」セクションで新しいパスワードを作成',
      '5. アプリ名を入力して「作成」をクリック',
      '6. 生成された<strong>パスワード</strong>をコピー',
      '7. WebDAV URLは通常: <code>https://[your-domain]/remote.php/webdav/</code>',
      '',
      '<strong>Boxの場合：</strong>',
      '1. Box開発者コンソール（https://app.box.com/developers/console）にアクセス',
      '2. 「My Apps」→「Create New App」をクリック',
      '3. 「Custom App」を選択',
      '4. 認証方法で「OAuth 2.0 with JWT」を選択',
      '5. アプリ名を入力して作成',
      '6. 「Configuration」タブで必要な権限を設定',
      '7. アプリの承認後、認証情報を取得',
      '8. WebDAV URL: <code>https://dav.box.com/dav/</code>',
      '',
      '<strong>共通設定項目：</strong>',
      '• <strong>エンドポイント：</strong> WebDAV URL（上記参照）',
      '• <strong>ユーザー名：</strong> アカウントのユーザー名またはメールアドレス',
      '• <strong>パスワード：</strong> アプリパスワードまたはアカウントパスワード',
      '',
      '<strong>⚠️ セキュリティに関する注意：</strong>',
      '• 可能な限りアプリ専用パスワードを使用してください',
      '• アカウントパスワードの直接使用は避けることを推奨します',
      '• HTTPSを使用した安全な接続を確保してください',
    ],
  },
  'custom': {
    title: 'カスタムプロバイダーの設定',
    steps: [
      'カスタムプロバイダーは現在開発中です。',
    ],
  },
  'dropbox': {
    title: t('Dropboxの設定方法'),
    steps: [
      '<strong>Dropbox App Consoleでの設定：</strong>',
      '1. <a href="https://www.dropbox.com/developers/apps" target="_blank">Dropbox App Console</a>にアクセス',
      '2. 「Create app」をクリック',
      '3. 「Scoped access」を選択',
      '4. 「Full Dropbox」または「App folder」を選択（Full Dropboxを推奨）',
      '5. アプリ名を入力（例: Tasket Backup）',
      '6. 「Create app」をクリック',
      '',
      '<strong>アクセストークンの生成：</strong>',
      '1. アプリの設定ページで「Permissions」タブを開く',
      '2. 以下の権限を有効化：',
      '   • files.metadata.write',
      '   • files.metadata.read',
      '   • files.content.write',
      '   • files.content.read',
      '3. 「Submit」をクリックして権限を保存',
      '4. 「Settings」タブに戻る',
      '5. 「OAuth 2」セクションで「Generated access token」をクリック',
      '6. 「Generate」ボタンをクリック',
      '7. 表示された<strong>アクセストークン</strong>をコピー',
      '',
      '<strong>設定項目：</strong>',
      '• <strong>アクセストークン：</strong> 上記で生成したアクセストークン',
      '',
      '<strong>⚠️ セキュリティに関する注意：</strong>',
      '• アクセストークンは安全に保管してください',
      '• 本番環境では、OAuth 2.0フローを使用してユーザーごとにトークンを取得することを推奨します',
      '• Generated access tokenは期限なしですが、定期的に再生成することを推奨します',
    ],
  },
  'azure-blob': {
    title: t('Azure Blob Storageの設定方法'),
    steps: [
      '<strong>Azure Portalでの設定：</strong>',
      '1. <a href="https://portal.azure.com/" target="_blank">Azure Portal</a>にログイン',
      '2. 「ストレージアカウント」を検索して選択',
      '3. 「作成」をクリックして新しいストレージアカウントを作成するか、既存のアカウントを選択',
      '',
      '<strong>新規作成の場合：</strong>',
      '1. サブスクリプション、リソースグループを選択',
      '2. ストレージアカウント名を入力（グローバルで一意な名前）',
      '3. リージョンを選択',
      '4. パフォーマンス: Standard、冗長性: LRS を選択（用途に応じて変更可）',
      '5. 「確認および作成」→「作成」をクリック',
      '',
      '<strong>コンテナの作成：</strong>',
      '1. ストレージアカウントを開く',
      '2. 左メニューから「コンテナー」を選択',
      '3. 「+ コンテナー」をクリック',
      '4. 名前に「tasket-backups」を入力',
      '5. パブリックアクセスレベル: プライベート',
      '6. 「作成」をクリック',
      '',
      '<strong>SASトークンの生成：</strong>',
      '1. ストレージアカウントの左メニューから「Shared Access Signature」を選択',
      '2. 許可されたサービス: Blob にチェック',
      '3. 許可されたリソースの種類: オブジェクト にチェック',
      '4. 許可されたアクセス許可: 読み取り、書き込み、一覧表示、作成 にチェック',
      '5. 開始日時と終了日時を設定（推奨: 1年間）',
      '6. 「SASと接続文字列を生成する」をクリック',
      '7. <strong>SASトークン</strong>（?sv=で始まる文字列）をコピー',
      '',
      '<strong>設定項目：</strong>',
      '• <strong>ストレージアカウント名：</strong> 作成したストレージアカウントの名前',
      '• <strong>SASトークン：</strong> 上記で生成したSASトークン',
      '• <strong>コンテナ名：</strong> tasket-backups（または作成したコンテナ名）',
      '',
      '<strong>⚠️ セキュリティに関する注意：</strong>',
      '• SASトークンには有効期限を設定してください',
      '• 必要最小限の権限のみを付与してください',
      '• トークンは安全に保管し、定期的に再生成することを推奨します',
    ],
  },
}
</script>

<template>
  <div class="setup-manual">
    <h3>{{ manuals[provider].title }}</h3>
    <div class="manual-content">
      <div
        v-for="(step, index) in manuals[provider].steps"
        :key="index"
        class="manual-step"
        v-html="step"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.setup-manual {
  h3 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 16px;
    color: #333;

    .dark-mode & {
      color: #e0e0e0;
    }
  }
}

.manual-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 500px;
  overflow-y: auto;
  padding-right: 8px;
}

.manual-step {
  font-size: 14px;
  line-height: 1.6;
  color: #555;

  .dark-mode & {
    color: #b0b0b0;
  }

  :deep(strong) {
    color: #333;
    font-weight: 600;

    .dark-mode & {
      color: #e0e0e0;
    }
  }

  :deep(code) {
    background-color: #f5f5f5;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 13px;
    color: #d63384;

    .dark-mode & {
      background-color: #2a2a2a;
      color: #ff79c6;
    }
  }

  // 空行の処理
  &:empty::after {
    content: '';
    display: block;
    height: 8px;
  }
}

// スクロールバーのスタイリング
.manual-content::-webkit-scrollbar {
  width: 8px;
}

.manual-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;

  .dark-mode & {
    background: #2a2a2a;
  }
}

.manual-content::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;

  &:hover {
    background: #555;
  }

  .dark-mode & {
    background: #555;

    &:hover {
      background: #777;
    }
  }
}
</style>
