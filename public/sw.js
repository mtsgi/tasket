// Service Worker for Tasket PWA
const CACHE_NAME = 'tasket-v1'
const RUNTIME_CACHE = 'tasket-runtime'

// インストール時にキャッシュする静的リソース
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/maskable_icon_x192.png',
  '/maskable_icon_x512.png',
]

// Service Workerのインストール
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  // 新しいService Workerを即座にアクティブ化
  self.skipWaiting()
})

// Service Workerのアクティベーション
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 古いキャッシュを削除
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  // アクティブ化後すぐにクライアントを制御
  self.clients.claim()
})

// フェッチイベントの処理
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 同一オリジンのリクエストのみ処理
  if (url.origin !== location.origin) {
    return
  }

  // ナビゲーションリクエストの場合
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // レスポンスをキャッシュに保存
          const responseClone = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone)
          })
          return response
        })
        .catch(() => {
          // オフライン時はキャッシュから取得、なければルートページを返す
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match('/')
          })
        })
    )
    return
  }

  // その他のリクエスト（画像、CSS、JSなど）
  // Cache First戦略: キャッシュ優先、なければネットワークから取得
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(request).then((response) => {
        // 正常なレスポンスのみキャッシュ
        if (!response || response.status !== 200 || response.type === 'error') {
          return response
        }

        // 画像、CSS、JSファイルをランタイムキャッシュに保存
        if (
          request.destination === 'image' ||
          request.destination === 'style' ||
          request.destination === 'script' ||
          url.pathname.endsWith('.png') ||
          url.pathname.endsWith('.jpg') ||
          url.pathname.endsWith('.svg') ||
          url.pathname.endsWith('.css') ||
          url.pathname.endsWith('.js')
        ) {
          const responseClone = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone)
          })
        }

        return response
      })
    })
  )
})

// メッセージイベントの処理（キャッシュクリアなど）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
      })
    )
  }
})
