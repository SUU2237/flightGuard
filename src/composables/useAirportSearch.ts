// src/composables/useAirportSearch.ts

import { computed } from 'vue';
import { useTdxBaseDataStore } from '@/stores/tdxBaseData';
import { useEntitySearch } from '@/composables/useEntitySearch';
import { FlightDirection, type TdxAirport } from '@/types';

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

/**
 * 機場搜尋輸入框互動邏輯 composable
 *
 * 共用 Focus / Blur / 打字三種狀態切換與前端關鍵字篩選邏輯（見 useEntitySearch），
 * 本檔案只額外處理機場搜尋特有的「國外機場離站/進站語意反轉」標記與查詢代碼轉換
 */
export function useAirportSearch() {
  const tdxStore = useTdxBaseDataStore();

  const {
    keyword,
    searchMode,
    filteredItems: filteredAirports,
    selectedItem: selectedAirport,
    recommendedItems: recommendedAirports,
    onFocus,
    onBlur,
    onInput,
    selectItem: selectAirport,
    clearSelection: clearAirport,
  } = useEntitySearch<TdxAirport>({
    formatKeyword: (airport) => `${airport.airportName} (${airport.airportIATA})`,
    search: (keyword, limit) => tdxStore.searchAirports(keyword, limit),
    recommendedIds: RECOMMENDED_AIRPORT_IATA_LIST,
    getById: (iata) => tdxStore.getAirportByIATA(iata),
  });

  /** 是否已選取國外機場（供 UI 顯示提示文字與查詢邏輯反轉判斷使用） */
  const isForeignAirport = computed(() => {
    return selectedAirport.value ? !isDomesticAirport(selectedAirport.value) : false;
  });

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
