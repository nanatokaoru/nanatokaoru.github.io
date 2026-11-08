import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import { chapterConfigPlugin } from './src/data/chapterConfigPlugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
    chapterConfigPlugin(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
