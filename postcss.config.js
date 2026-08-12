// postcss.config.js

/**
 * PostCSS 設定檔
 * Tailwind CSS v4 起，PostCSS 外掛改為獨立套件 @tailwindcss/postcss，
 * 不再直接使用 tailwindcss 套件本身作為 PostCSS plugin
 */
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};