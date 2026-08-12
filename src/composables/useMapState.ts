// src/composables/useMapState.ts

import { ref, shallowRef } from 'vue';
import type { FidsFlight } from '@/types';

/** 台灣預設地圖中心座標（約略位於台灣本島中心點） */
const DEFAULT_CENTER: { lat: number; lng: number } = { lat: 23.6, lng: 121.0 };

/** 預設全台檢視縮放層級 */
const DEFAULT_ZOOM = 7;

/** 聚焦單一航班時的縮放層級 */
const FOCUS_ZOOM = 9;

/**
 * 地圖視角狀態管理 composable
 *
 * 管理 Leaflet / Mapbox 共用的地圖視角狀態（不綁定特定地圖函式庫實作），
 * 供 components/map/FlightMap.vue 讀取後呼叫實際地圖實例的 flyTo/panTo 方法
 */
export function useMapState() {
  /** 目前地圖中心座標 */
  const center = ref<{ lat: number; lng: number }>({ ...DEFAULT_CENTER });
  /** 目前地圖縮放層級 */
  const zoom = ref<number>(DEFAULT_ZOOM);
  /** 目前聚焦中的航班（用於高亮顯示與資訊面板連動），使用 shallowRef 避免深層響應式開銷 */
  const selectedFlight = shallowRef<FidsFlight | null>(null);

  /**
   * 設定地圖聚焦位置與縮放層級
   * 供航班卡片點擊時呼叫，觸發地圖平滑移動 (flyTo/panTo) 至指定座標
   *
   * @param lat 目標緯度
   * @param lng 目標經度
   * @param targetZoom 目標縮放層級，未指定時使用預設聚焦層級 FOCUS_ZOOM
   */
  function setMapFocus(lat: number, lng: number, targetZoom: number = FOCUS_ZOOM): void {
    center.value = { lat, lng };
    zoom.value = targetZoom;
  }

  /**
   * 設定目前聚焦中的航班
   * 通常與 setMapFocus 搭配使用：點擊航班卡片時同時更新聚焦航班與地圖視角
   *
   * @param flight 欲聚焦的航班資料，傳入 null 代表取消聚焦
   */
  function setSelectedFlight(flight: FidsFlight | null): void {
    selectedFlight.value = flight;
  }

  /**
   * 重設地圖視角為預設全台檢視視圖
   * 同時清除目前聚焦中的航班
   */
  function resetMapView(): void {
    center.value = { ...DEFAULT_CENTER };
    zoom.value = DEFAULT_ZOOM;
    selectedFlight.value = null;
  }

  return {
    center,
    zoom,
    selectedFlight,
    setMapFocus,
    setSelectedFlight,
    resetMapView,
  };
}