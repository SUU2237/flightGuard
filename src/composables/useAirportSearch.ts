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
 *
 * @param instanceLabel 選填識別字串，供多個輸入框（如出發地/目的地）除錯用途區分
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
   * TDX 機場資料的國家欄位為中文（如「中華民國」），不適合用字串比對，
   * 改用固定白名單精確判斷是否為台灣本地機場，避免誤判導致方向邏輯反轉錯誤
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
   * 改為白名單精確比對，取代原本不可靠的國家欄位字串判斷
   */
  function isDomesticAirport(airport: TdxAirport): boolean {
    return DOMESTIC_AIRPORT_IATA_LIST.includes(airport.airportIATA.toUpperCase());
  }

  /**
   * 已選機場的歸屬類別（台灣本地 / 國外）
   * 尚未選取任何機場時為 null
   */
  const airportOrigin = computed<AirportSearchOrigin | null>(() => {
    if (!selectedAirport.value) return null;
    return isDomesticAirport(selectedAirport.value)
      ? AirportSearchOrigin.Domestic
      : AirportSearchOrigin.Foreign;
  });

  /** 是否已選取國外機場（供 UI 顯示提示文字與查詢邏輯反轉判斷使用） */
  const isForeignAirport = computed(
    () => airportOrigin.value === AirportSearchOrigin.Foreign,
  );

  /**
   * Focus 事件處理：彈出「常見推薦視窗」
   * 僅在輸入框目前無文字時才顯示推薦清單，避免蓋掉既有篩選結果
   */
  function onFocus(): void {
    if (blurTimer) {
      clearTimeout(blurTimer);
      blurTimer = null;
    }
    searchMode.value = keyword.value ? SearchMode.FilterTyping : SearchMode.RecommendOpen;
  }

  /**
   * Blur 事件處理：點擊空白處後收起下拉選單
   * 延遲執行，確保點擊推薦/篩選清單項目的 click 事件能優先觸發完成選取
   */
  function onBlur(): void {
    blurTimer = setTimeout(() => {
      searchMode.value = SearchMode.Idle;
    }, BLUR_CLOSE_DELAY_MS);
  }

  /**
   * 輸入框文字變更事件處理
   * 偵測到打字時關閉推薦視窗，改以 Debounce 後的前端 Array.filter 進行關鍵字篩選
   *
   * @param value 使用者輸入的最新文字內容
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
   * 選取機場（可能來自推薦清單或篩選清單點擊）
   * 選取後回填輸入框文字並收起下拉選單
   *
   * @param airport 使用者選取的機場物件
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
   * 取得實際應送往 TDX 查詢的機場代碼
   * 依規範：TDX 僅支援台灣相關航班，選擇國外機場時一律改查與桃園機場(TPE)的往返航班
   *
   * @returns 查詢用機場 IATA 代碼，尚未選取機場時回傳 null
   */
  function getEffectiveQueryAirportCode(): string | null {
    if (!selectedAirport.value) return null;
    return isForeignAirport.value ? 'TPE' : selectedAirport.value.airportIATA;
  }

  /**
   * 取得實際應送往 TDX 查詢的航班方向
   *
   * 依規範：選擇國外機場的「離站航班」代表「從該國外機場離站抵達桃園」，
   * 邏輯與台灣機場相反，故實際查詢桃園機場時需反轉方向
   * （UI 上選 Departure，實際查詢應打 Arrival at TPE；反之亦然）
   *
   * @param uiDirection 使用者於 UI 上選擇的方向
   * @returns 實際應送往 TDX API 查詢的方向
   */
  function getEffectiveDirection(uiDirection: FlightDirection): FlightDirection {
    if (!isForeignAirport.value) return uiDirection;

    return uiDirection === FlightDirection.Departure
      ? FlightDirection.Arrival
      : FlightDirection.Departure;
  }

  /**
   * 取得 UI 顯示用的方向提示文字
   * 國外機場時需額外說明「與桃園機場往返」及方向反轉語意，避免使用者混淆
   *
   * @param uiDirection 使用者於 UI 上選擇的方向
   * @returns 對應的提示文字
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
    airportOrigin,
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

  // eslint-disable-next-line no-unused-labels
  void instanceLabel;
}