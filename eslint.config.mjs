// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // Your custom configs here
  {
    rules: {
      // v-htmlはチュートリアルコンテンツなどでHTMLを含む多言語メッセージに使用されているため許可
      'vue/no-v-html': 'off',
    },
  },
)
