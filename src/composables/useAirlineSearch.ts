// src/composables/useAirlineSearch.ts

import { useTdxBaseDataStore } from '@/stores/tdxBaseData';
import { useEntitySearch } from '@/composables/useEntitySearch';
import type { TdxAirline } from '@/types';

/**
 * 常見推薦航空公司 IATA 代碼清單
 * 於使用者 Focus 輸入框但尚未打字時，顯示此清單供快速選取
 */
const RECOMMENDED_AIRLINE_IATA_LIST = [
  'BR', // 長榮航空
  'CI', // 中華航空
  'JX', // 星宇航空
  'B7', // 立榮航空
  'AE', // 華信航空
  'IT', // 台灣虎航
];

/**
 * 航空公司搜尋輸入框互動邏輯 composable
 *
 * Focus / Blur / 打字三種狀態切換與前端關鍵字篩選邏輯皆共用 useEntitySearch，
 * 本檔案只負責提供航空公司特有的資料存取方式（store 搜尋方法、推薦清單、回填文字格式）
 */
export function useAirlineSearch() {
  const tdxStore = useTdxBaseDataStore();

  const {
    keyword,
    searchMode,
    filteredItems: filteredAirlines,
    selectedItem: selectedAirline,
    recommendedItems: recommendedAirlines,
    onFocus,
    onBlur,
    onInput,
    selectItem: selectAirline,
    clearSelection: clearAirline,
  } = useEntitySearch<TdxAirline>({
    formatKeyword: (airline) => `${airline.airlineName} (${airline.airlineIATA})`,
    search: (keyword, limit) => tdxStore.searchAirlines(keyword, limit),
    recommendedIds: RECOMMENDED_AIRLINE_IATA_LIST,
    getById: (iata) => tdxStore.getAirlineByIATA(iata),
  });

  return {
    // state
    keyword,
    searchMode,
    filteredAirlines,
    selectedAirline,
    recommendedAirlines,
    // actions
    onFocus,
    onBlur,
    onInput,
    selectAirline,
    clearAirline,
  };
}
