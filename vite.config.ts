// vite.config.ts

/**
 * Vite 專案設定檔
 * - 掛載 @vitejs/plugin-vue 支援 .vue 單檔元件
 * - 設定 @ 路徑別名指向 src/，對應本專案所有 import '@/...' 寫法
 */
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
});