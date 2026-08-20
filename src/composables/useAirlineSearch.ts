// src/composables/useAirlineSearch.ts

import { ref, computed } from 'vue';
import { useTdxBaseDataStore } from '@/stores/tdxBaseData';
import { SearchMode, type TdxAirline } from '@/types';

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

/** 輸入偵測後觸發前端 Array.filter 篩選的 Debounce 延遲時間（毫秒） */
const FILTER_DEBOUNCE_MS = 300;

/** Blur 收起下拉選單前的延遲時間（毫秒），確保點擊選項的 click 事件能先觸發 */
const BLUR_CLOSE_DELAY_MS = 150;

/**
 * 航空公司搜尋輸入框
 */
export function useAirlineSearch() {
  const tdxStore = useTdxBaseDataStore();

  /** 使用者輸入框中的原始文字內容 */
  const keyword = ref('');
  /** 目前輸入框互動狀態 */
  const searchMode = ref<SearchMode>(SearchMode.Idle);
  /** 打字篩選後的航空公司清單（限前 30 筆） */
  const filteredAirlines = ref<TdxAirline[]>([]);
  /** 已選定的航空公司（選取後回填至輸入框） */
  const selectedAirline = ref<TdxAirline | null>(null);

  /** Debounce 計時器 handle */
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  /** Blur 延遲關閉計時器 handle */
  let blurTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * 常見推薦航空公司清單（由全量快取中依白名單 IATA 代碼篩出，保持顯示順序）
   */
  const recommendedAirlines = computed<TdxAirline[]>(() => {
    return RECOMMENDED_AIRLINE_IATA_LIST.map((iata) =>
      tdxStore.getAirlineByIATA(iata),
    ).filter((airline): airline is TdxAirline => Boolean(airline));
  });

  /**
   * Focus：彈出「常見推薦視窗」
   */
  function onFocus(): void {
    if (blurTimer) {
      clearTimeout(blurTimer);
      blurTimer = null;
    }
    searchMode.value = keyword.value ? SearchMode.FilterTyping : SearchMode.RecommendOpen;
  }

  /**
   * Blur：點擊空白處後收起下拉選單
   */
  function onBlur(): void {
    blurTimer = setTimeout(() => {
      searchMode.value = SearchMode.Idle;
    }, BLUR_CLOSE_DELAY_MS);
  }

  /**
   * 輸入框
   */
  function onInput(value: string): void {
    keyword.value = value;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    if (!value.trim()) {
      searchMode.value = SearchMode.RecommendOpen;
      filteredAirlines.value = [];
      return;
    }

    searchMode.value = SearchMode.FilterTyping;

    debounceTimer = setTimeout(() => {
      filteredAirlines.value = tdxStore.searchAirlines(value, 30);
    }, FILTER_DEBOUNCE_MS);
  }

  /**
   * 選取航空公司（可能來自推薦清單或篩選清單點擊）
   *
   * @param airline 使用者選取的航空公司物件
   */
  function selectAirline(airline: TdxAirline): void {
    selectedAirline.value = airline;
    keyword.value = `${airline.airlineName} (${airline.airlineIATA})`;
    filteredAirlines.value = [];
    searchMode.value = SearchMode.Idle;
  }

  /**
   * 清空航空公司搜尋（清空關鍵字、已選航空公司、篩選結果，並重設互動狀態為 Idle）
   */
  function clearAirline(): void {
    keyword.value = '';
    selectedAirline.value = null;
    filteredAirlines.value = [];
    searchMode.value = SearchMode.Idle;
    if (debounceTimer) clearTimeout(debounceTimer);
    if (blurTimer) clearTimeout(blurTimer);
  }

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