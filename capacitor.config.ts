import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitorのネイティブアプリ設定。
 * Nuxtの静的出力`.output/public`を同梱し、Androidのシステムバー領域を避けて表示する。
 */
const config: CapacitorConfig = {
  appId: 'com.mtsgi.tasket',
  appName: 'Tasket',
  webDir: '.output/public',
  backgroundColor: '#f5f7fa',
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'LIGHT',
    },
  },
}

export default config
