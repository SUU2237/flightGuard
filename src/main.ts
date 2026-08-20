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
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const app = createApp(App);
//Pinia 狀態管理庫：供後續快取機場與航空公司資料
app.use(createPinia());
app.use(router);
//將整個 Vue 實例掛載到 index.html 裡面 id 為 app 的 DOM 節點上
app.mount('#app');