// tailwind.config.js

/**
 * Tailwind CSS v4 選用設定檔
 * 告訴 Tailwind CSS 去掃描哪些檔案並產生對應的樣式
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};