// src/stores/flightCache.ts

import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { FidsFlight } from '@/types';

/**
 * 航班暫存 Store
 *
 * 使用者於 SearchView 點擊航班卡片跳轉至 FlightDetailView 時，
 * 將當下已取得的 flight 物件暫存於此，供 FlightDetailView 直接讀取使用，
 * 避免同一筆資料在轉頁後又重新呼叫一次 TDX API（頻繁觸發 429）
 */
export const useFlightCacheStore = defineStore('flightCache', () => {
  /** 暫存資料對應的路由 id（格式："航班號-YYYYMMDD"），用於比對是否為同一筆導航 */
  const cachedRouteId = ref<string | null>(null);
  /** 暫存的航班資料 */
  const cachedFlight = ref<FidsFlight | null>(null);

  /** 把即將前往的網址 ID 與整包航班資料存入 Store，準備帶給下一頁 */
  function setFlight(routeId: string, flight: FidsFlight): void {
    cachedRouteId.value = routeId;
    cachedFlight.value = flight;
  }

  /** 在詳細頁載入時呼叫，讀取並清除暫存資料；僅在 routeId 吻合時才回傳，否則回傳 null */
  function consumeFlight(routeId: string): FidsFlight | null {
    //若 ID 不吻合（例如使用者是手動貼網址進來），回傳 null，讓詳細頁走原本的 API 查詢流程。
    if (cachedRouteId.value !== routeId || !cachedFlight.value) {
      return null;
    }
    //領取資料並清空暫存
    const flight = cachedFlight.value;
    cachedRouteId.value = null;
    cachedFlight.value = null;
    return flight;
  }

  return {
    setFlight,
    consumeFlight,
  };
});
