// vite.config.ts

/**
 * Vite 專案設定檔
 * 設定 Vite 開發伺服器與打包規則，並定義 @ 代表 src/ 資料夾
 */
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/flightGuard/' : '/',
  plugins: [vue()],
  resolve: {
    //@ 指向 ./src 資料夾，讓程式碼中可以用 @/components/... 進行簡潔引入
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/__tests__/**/*.spec.ts'],
  },
});