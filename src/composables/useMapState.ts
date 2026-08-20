// src/composables/useMapState.ts
// 地圖鏡頭現在要看哪裡

import { ref, shallowRef } from 'vue';
import type { FidsFlight } from '@/types';

/** 預設台灣中心為地圖中心座標 */
const DEFAULT_CENTER: { lat: number; lng: number } = { lat: 23.6, lng: 121.0 };

/** 預設全台檢視縮放層級 */
const DEFAULT_ZOOM = 7;

/** 聚焦單一航班時的縮放層級 */
const FOCUS_ZOOM = 9;

/**
 * 地圖視角狀態管理 
 * 供 FlightMap.vue 讀取後呼叫實際地圖實例的 flyTo/panTo 方法
 */
export function useMapState() {
  /** 目前地圖中心座標 */
  const center = ref<{ lat: number; lng: number }>({ ...DEFAULT_CENTER });
  /** 目前地圖縮放層級 */
  const zoom = ref<number>(DEFAULT_ZOOM);

  /**
   * 設定地圖聚焦位置與縮放層級
   * 供航班卡片點擊時呼叫，觸發地圖平滑移動 (flyTo/panTo) 至指定座標
   */
  function setMapFocus(lat: number, lng: number, targetZoom: number = FOCUS_ZOOM): void {
    center.value = { lat, lng };
    zoom.value = targetZoom;
  }

  /**
   * 重設地圖視角時：退回全台檢視視圖
   * 同時清除目前聚焦中的航班
   */
  function resetMapView(): void {
    center.value = { ...DEFAULT_CENTER };
    zoom.value = DEFAULT_ZOOM;
    //selectedFlight.value = null;
  }

  return {
    center,
    zoom,
    setMapFocus,
    resetMapView,
  };
}