// src/composables/useEntitySearch.ts

import { ref, computed, type ComputedRef } from 'vue';
import { SearchMode } from '@/types';

/** 輸入偵測後觸發前端 Array.filter 篩選的 Debounce 延遲時間（毫秒） */
const FILTER_DEBOUNCE_MS = 300;

/** Blur 收起下拉選單前的延遲時間（毫秒），確保點擊選項的 click 事件能先觸發 */
const BLUR_CLOSE_DELAY_MS = 150;

/** 打字篩選結果的預設筆數上限 */
const DEFAULT_LIMIT = 30;

export interface UseEntitySearchOptions<T> {
  /** 選取項目後回填至輸入框的顯示文字，如 `${item.name} (${item.code})` */
  formatKeyword: (item: T) => string;
  /** 依關鍵字模糊搜尋（呼叫端負責串接 store 的搜尋方法），回傳已限制筆數的結果 */
  search: (keyword: string, limit: number) => T[];
  /** 常見推薦項目的白名單 id 清單，依原始順序顯示 */
  recommendedIds: string[];
  /** 依 id 取得單一項目，用於組出推薦清單（找不到則自動略過） */
  getById: (id: string) => T | undefined;
  /** 篩選結果筆數上限，預設 30 */
  limit?: number;
}

/**
 * 「輸入框 + Focus 常見推薦清單 + 打字 Debounce 篩選清單」共用互動邏輯 composable
 *
 * 抽出機場搜尋 (useAirportSearch) 與航空公司搜尋 (useAirlineSearch) 完全相同的
 * Focus / Blur / Debounce 篩選 / 選取 / 清空狀態機，兩者只需提供各自的資料存取方式即可複用，
 * 避免同一套邏輯在兩個檔案各維護一份
 */
export function useEntitySearch<T>(options: UseEntitySearchOptions<T>) {
  const { formatKeyword, search, recommendedIds, getById, limit = DEFAULT_LIMIT } = options;

  /** 使用者輸入框中的原始文字內容 */
  const keyword = ref('');
  /** 目前輸入框互動狀態 */
  const searchMode = ref<SearchMode>(SearchMode.Idle);
  /** 打字篩選後的項目清單（限前 limit 筆） */
  const filteredItems = ref<T[]>([]);
  /** 已選定的項目（選取後回填至輸入框） */
  const selectedItem = ref<T | null>(null);

  /** Debounce 計時器 handle */
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  /** Blur 延遲關閉計時器 handle */
  let blurTimer: ReturnType<typeof setTimeout> | null = null;

  /** 常見推薦項目清單（由全量快取中依白名單 id 篩出，保持顯示順序） */
  const recommendedItems: ComputedRef<T[]> = computed(() =>
    recommendedIds.map((id) => getById(id)).filter((item): item is T => Boolean(item)),
  );

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
   * 偵測到輸入框正在打字時，關閉推薦視窗，改進行 Debounce 關鍵字篩選
   */
  function onInput(value: string): void {
    keyword.value = value;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    if (!value.trim()) {
      searchMode.value = SearchMode.RecommendOpen;
      filteredItems.value = [];
      return;
    }

    searchMode.value = SearchMode.FilterTyping;

    debounceTimer = setTimeout(() => {
      filteredItems.value = search(value, limit);
    }, FILTER_DEBOUNCE_MS);
  }

  /**
   * 選取項目（可能來自推薦清單或篩選清單點擊）
   */
  function selectItem(item: T): void {
    selectedItem.value = item;
    keyword.value = formatKeyword(item);
    filteredItems.value = [];
    searchMode.value = SearchMode.Idle;
  }

  /**
   * 清空搜尋（清空關鍵字、已選項目、篩選結果，並重設互動狀態為 Idle）
   */
  function clearSelection(): void {
    keyword.value = '';
    selectedItem.value = null;
    filteredItems.value = [];
    searchMode.value = SearchMode.Idle;
    if (debounceTimer) clearTimeout(debounceTimer);
    if (blurTimer) clearTimeout(blurTimer);
  }

  return {
    // state
    keyword,
    searchMode,
    filteredItems,
    selectedItem,
    recommendedItems,
    // actions
    onFocus,
    onBlur,
    onInput,
    selectItem,
    clearSelection,
  };
}
