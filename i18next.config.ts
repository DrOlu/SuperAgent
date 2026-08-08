import { defineConfig } from 'i18next-cli'

export default defineConfig({
  locales: ['en-us'],
  extract: {
    input: ['src/renderer/**/*.{tsx,ts}'],
    ignore: ['src/renderer/**/__tests__/*.{tsx,ts}', 'src/renderer/**/*.test.{tsx,ts}'],
    output: 'src/renderer/i18n/locales/{{language}}.json',
    defaultNS: false,
    // 
    removeUnusedKeys: false
  },
  lint: {}
})
