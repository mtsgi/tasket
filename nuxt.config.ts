// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@pinia/nuxt', '@vite-pwa/nuxt', '@nuxt/icon'],
  devtools: { enabled: true },
  app: {
    head: {
      title: 'Tasket',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'TODO・家計簿・カレンダー統合ライフマネジメントアプリ' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },
  css: ['~/assets/scss/main.scss'],
  future: {
    compatibilityVersion: 5,
  },
  compatibilityDate: '2025-07-15',
  eslint: {
    config: { stylistic: true },
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Tasket',
      short_name: 'Tasket',
      description: 'TODO・家計簿・カレンダー統合ライフマネジメントアプリ',
      theme_color: '#4a90d9',
      background_color: '#ffffff',
      display: 'standalone',
      icons: [
        {
          src: '/icon-192.svg',
          sizes: '192x192',
          type: 'image/svg+xml',
        },
        {
          src: '/icon-512.svg',
          sizes: '512x512',
          type: 'image/svg+xml',
        },
      ],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
    },
    client: {
      installPrompt: true,
    },
    devOptions: {
      enabled: true,
      type: 'module',
    },
  },
})
