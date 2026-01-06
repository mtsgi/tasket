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
      '3. 「R2 APIトークンの管理」をクリック',
      '4. 「APIトークンを作成」をクリック',
      '5. トークン名を入力し、アクセス許可を設定',
      '6. <strong>アクセスキーID</strong>と<strong>シークレットアクセスキー</strong>をコピー',
      '',
      '<strong>共通設定項目：</strong>',
      '• <strong>エンドポイント：</strong> ストレージサービスのURL（例: https://s3.amazonaws.com）',
      '• <strong>リージョン：</strong> データセンターの地域（例: us-east-1, ap-northeast-1）',
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
