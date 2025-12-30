import license from 'rollup-plugin-license'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@pinia/nuxt', '@vite-pwa/nuxt', '@nuxt/icon', '@nuxtjs/i18n'],
  devtools: { enabled: true },
  i18n: {
    locales: [
      {
        code: 'ja',
        name: '日本語',
        file: 'ja.ts',
      },
      {
        code: 'en',
        name: 'English',
        file: 'en.ts',
      },
    ],
    lazy: true,
    langDir: 'locales',
    defaultLocale: 'ja',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
    },
  },
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
  vite: {
    plugins: [
      // OSSライセンス表記をビルド成果物に含める
      license({
        thirdParty: {
          includePrivate: false,
          output: {
            file: path.join(__dirname, 'public', 'licenses.txt'),
            template(dependencies) {
              return dependencies
                .map(
                  dep =>
                    `${dep.name}@${dep.version}\nLicense: ${dep.license || 'Unknown'}\n${dep.licenseText || 'No license text available'}\n${'='.repeat(80)}\n`,
                )
                .join('\n')
            },
          },
        },
      }),
    ],
  },
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
