// src/router/index.ts

import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

/**
 * 路由設定清單
 * - `/`：導向 `/search`
 * - `/search`：搜尋與航班列表主頁面
 * - `/flight/:id`：單一航班詳細資訊頁面（id 由航班號與表定時間組合編碼而成，供跨頁面還原查詢用）
 * - `/map`：獨立地圖檢視頁面
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
    props: true,
  },
  {
    path: '/map',
    name: 'map',
    component: () => import('@/views/MapView.vue'),
  },
];

/**
 * Vue Router 實例
 * 使用 HTML5 History 模式 (createWebHistory)
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;