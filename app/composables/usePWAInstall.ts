/**
 * PWAインストール機能を管理するコンポーザブル
 * A2HS (Add to Home Screen) のプロンプト表示とインストール処理を提供します
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed', platform: string }>
}

export function usePWAInstall() {
  // インストールプロンプトイベントを保持
  const deferredPrompt = useState<BeforeInstallPromptEvent | null>('pwa-install-prompt', () => null)

  // インストール可能かどうか
  const canInstall = computed(() => deferredPrompt.value !== null)

  // インストール済みかどうか
  const isInstalled = useState<boolean>('pwa-is-installed', () => false)

  // スタンドアロンモードで実行中かどうか
  const isStandalone = computed(() => {
    if (import.meta.client) {
      // iOS Safari standalone mode check
      const nav = window.navigator as Navigator & { standalone?: boolean }
      return window.matchMedia('(display-mode: standalone)').matches
        || nav.standalone === true
        || document.referrer.includes('android-app://')
    }
    return false
  })

  /**
   * beforeinstallpromptイベントをリスン
   */
  function setupInstallPrompt() {
    if (!import.meta.client) return

    // 既にインストール済みの場合は何もしない
    if (isStandalone.value) {
      isInstalled.value = true
      return
    }

    window.addEventListener('beforeinstallprompt', (e: Event) => {
      // デフォルトのミニインフォバーを抑制
      e.preventDefault()
      // 後で使用するためにイベントを保存
      deferredPrompt.value = e as BeforeInstallPromptEvent
      console.log('PWA install prompt available')
    })

    // アプリがインストールされたときのイベント
    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed')
      isInstalled.value = true
      deferredPrompt.value = null
    })
  }

  /**
   * インストールプロンプトを表示
   */
  async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!deferredPrompt.value) {
      return 'unavailable'
    }

    try {
      // プロンプトを表示
      await deferredPrompt.value.prompt()

      // ユーザーの選択を待つ
      const choiceResult = await deferredPrompt.value.userChoice

      console.log('User choice:', choiceResult.outcome)

      if (choiceResult.outcome === 'accepted') {
        isInstalled.value = true
      }

      // プロンプトは一度しか使用できないため、クリア
      deferredPrompt.value = null

      return choiceResult.outcome
    }
    catch (error) {
      console.error('Error showing install prompt:', error)
      return 'unavailable'
    }
  }

  /**
   * インストール状態をチェック
   */
  function checkInstallStatus() {
    if (import.meta.client) {
      isInstalled.value = isStandalone.value
    }
  }

  // クライアントサイドでのみセットアップ
  if (import.meta.client) {
    onMounted(() => {
      setupInstallPrompt()
      checkInstallStatus()
    })
  }

  return {
    canInstall,
    isInstalled,
    isStandalone,
    promptInstall,
    checkInstallStatus,
  }
}
