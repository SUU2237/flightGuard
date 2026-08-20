// src/composables/useAirportSearch.ts

import { ref, computed } from 'vue';
import { useTdxBaseDataStore } from '@/stores/tdxBaseData';
import {
  SearchMode,
  AirportSearchOrigin,
  FlightDirection,
  type TdxAirport,
} from '@/types';

/**
 * 常見推薦機場 IATA 代碼清單
 * 於使用者 Focus 輸入框但尚未打字時，顯示此清單供快速選取
 */
const RECOMMENDED_AIRPORT_IATA_LIST = [
  'TPE', // 台灣桃園國際機場
  'TSA', // 台北松山機場
  'KHH', // 高雄小港機場
  'RMQ', // 台中機場
  'NRT', // 東京成田
  'HND', // 東京羽田
  'KIX', // 大阪關西
  'ICN', // 首爾仁川
  'HKG', // 香港國際機場
  'BKK', // 曼谷素萬那普
];

/** 輸入偵測後觸發前端 Array.filter 篩選的 Debounce 延遲時間（毫秒） */
const FILTER_DEBOUNCE_MS = 300;

/** Blur 收起下拉選單前的延遲時間（毫秒），確保點擊選項的 click 事件能先觸發 */
const BLUR_CLOSE_DELAY_MS = 150;

/**
 * 機場搜尋輸入框互動邏輯 composable
 *
 * 管理項目：
 * - Focus / Blur / 打字三種狀態切換 (SearchMode)
 * - 前端關鍵字篩選（透過 useTdxBaseDataStore.searchAirports，限前 30 筆）
 * - 國外機場離站/進站語意反轉標記與查詢代碼轉換
 */
export function useAirportSearch(instanceLabel = 'default') {
  const tdxStore = useTdxBaseDataStore();

  /** 使用者輸入框中的原始文字內容 */
  const keyword = ref('');
  /** 目前輸入框互動狀態 */
  const searchMode = ref<SearchMode>(SearchMode.Idle);
  /** 打字篩選後的機場清單（限前 30 筆） */
  const filteredAirports = ref<TdxAirport[]>([]);
  /** 已選定的機場（選取後回填至輸入框） */
  const selectedAirport = ref<TdxAirport | null>(null);

  /** Debounce 計時器 handle */
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  /** Blur 延遲關閉計時器 handle */
  let blurTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * 常見推薦機場清單（由全量快取中依白名單 IATA 代碼篩出，保持顯示順序）
   */
  const recommendedAirports = computed<TdxAirport[]>(() => {
    return RECOMMENDED_AIRPORT_IATA_LIST.map((iata) =>
      tdxStore.getAirportByIATA(iata),
    ).filter((airport): airport is TdxAirport => Boolean(airport));
  });

  /**
   * 台灣國內機場 IATA 代碼白名單
   */
  const DOMESTIC_AIRPORT_IATA_LIST = [
    'TPE', // 桃園
    'TSA', // 松山
    'KHH', // 高雄小港
    'RMQ', // 台中
    'MZG', // 馬公
    'TTT', // 台東
    'HUN', // 花蓮
    'KYD', // 蘭嶼
    'CMJ', // 七美
    'WOT', // 望安
    'KNH', // 金門
    'LZN', // 南竿
    'GNI', // 綠島
  ];

  /**
   * 判斷指定機場是否為台灣本地機場
   */
  function isDomesticAirport(airport: TdxAirport): boolean {
    return DOMESTIC_AIRPORT_IATA_LIST.includes(airport.airportIATA.toUpperCase());
  }

  /** 是否已選取國外機場（供 UI 顯示提示文字與查詢邏輯反轉判斷使用） */

  const isForeignAirport = computed(() => {
    return selectedAirport.value ? !isDomesticAirport(selectedAirport.value) : false;
  });

  /**
   * Focus 彈出「常見推薦視窗」
   */
  function onFocus(): void {
    if (blurTimer) {
      clearTimeout(blurTimer);
      blurTimer = null;
    }
    searchMode.value = keyword.value ? SearchMode.FilterTyping : SearchMode.RecommendOpen;
  }

  /**
   * Blur 點擊空白處後收起下拉選單
   */
  function onBlur(): void {
    blurTimer = setTimeout(() => {
      searchMode.value = SearchMode.Idle;
    }, BLUR_CLOSE_DELAY_MS);
  }

  /**
   * 偵測到輸入框正在打字時，關閉推薦視窗，做進行關鍵字篩選
   */
  function onInput(value: string): void {
    keyword.value = value;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    if (!value.trim()) {
      searchMode.value = SearchMode.RecommendOpen;
      filteredAirports.value = [];
      return;
    }

    searchMode.value = SearchMode.FilterTyping;

    debounceTimer = setTimeout(() => {
      filteredAirports.value = tdxStore.searchAirports(value, 30);
    }, FILTER_DEBOUNCE_MS);
  }

  /**
   * 記錄選取的機場（可能來自推薦清單或篩選清單點擊）
   */
  function selectAirport(airport: TdxAirport): void {
    selectedAirport.value = airport;
    keyword.value = `${airport.airportName} (${airport.airportIATA})`;
    filteredAirports.value = [];
    searchMode.value = SearchMode.Idle;
  }

  /**
   * 清空機場搜尋（清空關鍵字、已選機場、篩選結果，並重設互動狀態為 Idle）
   */
  function clearAirport(): void {
    keyword.value = '';
    selectedAirport.value = null;
    filteredAirports.value = [];
    searchMode.value = SearchMode.Idle;
    if (debounceTimer) clearTimeout(debounceTimer);
    if (blurTimer) clearTimeout(blurTimer);
  }

  /**
   * 取得實際應送往 TDX 查詢的機場代碼（桃園機場 or 其餘台灣機場）
   */
  function getEffectiveQueryAirportCode(): string | null {
    if (!selectedAirport.value) return null;
    return isForeignAirport.value ? 'TPE' : selectedAirport.value.airportIATA;
  }

  /**
   * 取得實際應送往 TDX 查詢的航班方向
   * - 國內機場：照常
   * - 國外機場：離站/進站語意反轉
   */
  function getEffectiveDirection(uiDirection: FlightDirection): FlightDirection {
    if (!isForeignAirport.value) return uiDirection;

    return uiDirection === FlightDirection.Departure
      ? FlightDirection.Arrival
      : FlightDirection.Departure;
  }

  /**
   * 選擇國外機場時需額外提示「與桃園機場往返」及方向反轉語意，避免使用者混淆
   */
  function getDirectionUiHint(uiDirection: FlightDirection): string {
    if (!isForeignAirport.value) {
      return uiDirection === FlightDirection.Departure ? '離站航班' : '進站航班';
    }

    return uiDirection === FlightDirection.Departure
      ? '離站航班（從該機場出發，抵達桃園機場）'
      : '進站航班（從桃園機場出發，抵達該機場）';
  }

  return {
    // state
    keyword,
    searchMode,
    filteredAirports,
    selectedAirport,
    recommendedAirports,
    // getters
    isForeignAirport,
    // actions
    onFocus,
    onBlur,
    onInput,
    selectAirport,
    clearAirport,
    getEffectiveQueryAirportCode,
    getEffectiveDirection,
    getDirectionUiHint,
  };
}