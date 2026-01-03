import license from 'rollup-plugin-license'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@pinia/nuxt', '@nuxt/icon', '@nuxtjs/i18n'],
  devtools: { enabled: true },
  app: {
    head: {
      title: 'Tasket',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'TODO・家計簿・カレンダー統合ライフマネジメントアプリ' },
        { name: 'theme-color', content: '#4a90d9' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'Tasket' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/maskable_icon_x192.png' },
        { rel: 'icon', type: 'image/png', sizes: '512x512', href: '/maskable_icon_x512.png' },
        { rel: 'apple-touch-icon', sizes: '192x192', href: '/maskable_icon_x192.png' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
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
  i18n: {
    locales: [
      {
        code: 'ja',
        name: '日本語',
        file: 'ja.js',
      },
      {
        code: 'en',
        name: 'English',
        file: 'en.js',
      },
    ],
    langDir: 'locales',
    defaultLocale: 'ja',
    strategy: 'no_prefix',
    detectBrowserLanguage: false,
    compilation: {
      strictMessage: false,
      escapeHtml: false,
    },
  },
})
