// src/stores/tdxBaseData.ts

import { ref } from 'vue';
import { defineStore } from 'pinia';
import { getAllAirports } from '@/api/tdx/airport';
import { getAllAirlines } from '@/api/tdx/airline';
import type { TdxAirport, TdxAirline } from '@/types';

/**
 * TDX 基礎資料 Store（機場 / 航空公司）
 * 初始化時一次性呼叫 api/tdx/airport.ts 與 api/tdx/airline.ts 讀取「全量」機場與航空公司資料並快取，
 * 後續所有搜尋皆改由前端 JavaScript Array.filter 進行關鍵字比對，
 * 避免重複打 API 也解決 contains 不支援的問題
 */
export const useTdxBaseDataStore = defineStore('tdxBaseData', () => {
  /** 全量機場快取清單 */
  const airports = ref<TdxAirport[]>([]);
  /** 全量航空公司快取清單 */
  const airlines = ref<TdxAirline[]>([]);

  /** 是否正在初始化載入中 */
  const isLoading = ref(false);
  /** 初始化過程中的錯誤訊息，成功則為 null */
  const error = ref<string | null>(null);
  /** 是否已完成初始化（避免重複請求 API） */
  const isInitialized = ref(false);

  /**
   * 初始化 Store：一次性讀取全量機場與航空公司資料
   * 若已初始化成功過，預設不重複請求（可透過 force 參數強制重新讀取）
   */
  async function initialize(force = false): Promise<void> {
    if (isInitialized.value && !force) {
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      console.debug('[tdxBaseData] 開始載入機場與航空公司全量資料...');

      const [airportList, airlineList] = await Promise.all([
        getAllAirports(),
        getAllAirlines(),
      ]);
      console.debug('[tdxBaseData] 機場筆數:', airportList.length);
      console.debug('[tdxBaseData] 航空公司筆數:', airlineList.length);

      airports.value = airportList;
      airlines.value = airlineList;
      isInitialized.value = true;
    } catch (err) {
      console.error('[tdxBaseData] 初始化失敗:', err);
      error.value = err instanceof Error ? err.message : '讀取 TDX 基礎資料失敗';
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 模糊比對：前端關鍵字搜尋機場
   * 比對範圍：中文名稱、英文名稱、IATA 碼、ICAO 碼（皆為包含比對，忽略大小寫）
   */
  function searchAirports(keyword: string, limit = 30): TdxAirport[] {
    const trimmed = keyword.trim().toLowerCase();
    if (!trimmed) return [];

    return airports.value
      .filter(
        (airport) =>
          airport.airportName.toLowerCase().includes(trimmed) ||
          airport.airportNameEn.toLowerCase().includes(trimmed) ||
          airport.airportIATA.toLowerCase().includes(trimmed) ||
          (airport.airportICAO?.toLowerCase().includes(trimmed) ?? false),
      )
      .slice(0, limit);
  }

  /**
   * 模糊比對：前端關鍵字搜尋航空公司
   * 比對範圍：中文名稱、英文名稱、IATA 碼、ICAO 碼（皆為包含比對，忽略大小寫）
   */
  function searchAirlines(keyword: string, limit = 30): TdxAirline[] {
    const trimmed = keyword.trim().toLowerCase();
    if (!trimmed) return [];

    return airlines.value
      .filter(
        (airline) =>
          airline.airlineName.toLowerCase().includes(trimmed) ||
          airline.airlineNameEn.toLowerCase().includes(trimmed) ||
          airline.airlineIATA.toLowerCase().includes(trimmed) ||
          (airline.airlineICAO?.toLowerCase().includes(trimmed) ?? false),
      )
      .slice(0, limit);
  }

  /**
   * 精準比對：依 IATA 代碼取得單一機場資料（供代碼轉譯、顯示名稱等場景使用）
   */
  function getAirportByIATA(iata: string): TdxAirport | undefined {
    return airports.value.find(
      (a) => a.airportIATA.toLowerCase() === iata.toLowerCase(),
    );
  }

  /**
   * 精準比對：依 IATA 代碼取得單一航空公司資料
   */
  function getAirlineByIATA(iata: string): TdxAirline | undefined {
    return airlines.value.find(
      (a) => a.airlineIATA.toLowerCase() === iata.toLowerCase(),
    );
  }

  return {
    // state
    airports,
    airlines,
    isLoading,
    error,
    isInitialized,
    // actions
    initialize,
    searchAirports,
    searchAirlines,
    getAirportByIATA,
    getAirlineByIATA,
  };
});