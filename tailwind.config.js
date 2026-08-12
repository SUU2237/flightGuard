// tailwind.config.js

/**
 * Tailwind CSS v4 選用設定檔
 * v4 預設會自動掃描專案檔案，此設定檔僅用於明確指定掃描範圍或擴充主題
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};