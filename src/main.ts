// src/main.ts

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from '@/router';
import App from '@/App.vue';
import '@/assets/main.css';

// Leaflet 預設 Marker 圖示於 Vite 環境下路徑解析修正
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';


console.log('[ENV CHECK]', import.meta.env.VITE_TDX_CLIENT_ID);
/**
 * 修正 Leaflet 預設 Icon 路徑
 * Leaflet 原生透過相對路徑（webpack 慣例）取得圖示資源，於 Vite 環境下會解析失敗，
 * 需手動 import 圖片並覆寫 Icon.Default 的 options，確保預設 Marker 正常顯示
 */
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const app = createApp(App);

app.use(createPinia());
app.use(router);

app.mount('#app');