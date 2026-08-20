// src/router/index.ts

import { createRouter, type RouteRecordRaw ,createWebHashHistory } from 'vue-router';

/**
 * 路由設定清單
 * - `/`：導向 `/search`
 * - `/search`：搜尋與航班列表主頁面
 * - `/flight/:id`：單一航班詳細資訊頁面（id 由航班號與表定時間組合編碼而成，供跨頁面還原查詢用）
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/search',
  },
  {
    path: '/search',
    name: 'search',
    component: () => import('@/views/SearchView.vue'),
    meta: { keepAlive: true },
  },
  {
    path: '/flight/:id',
    name: 'flight-detail',
    component: () => import('@/views/FlightDetailView.vue'),
    //代表會自動把 id 作為 Prop 傳入頁面元件
    props: true,
  },
];

/**
 * Vue Router 實例
 * 使用 HTML5 History 模式 (createWebHistory)
 */
const router = createRouter({
  //Hash 路由模式（網址帶 /#/）：確保在 GitHub Pages 上重新整理時不會觸發伺服器 404
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;