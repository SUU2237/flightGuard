// src/types/common.ts

/**
 * 通用下拉選項結構
 * 用於機場、航空公司等下拉選單 / 推薦清單 / 篩選清單的顯示與選取
 */
export interface SelectOption {
  /** 顯示於畫面上的文字，如 "台灣桃園國際機場 (TPE)" */
  label: string;
  /** 實際選取值，通常為 IATA 或 ICAO 代碼 */
  value: string;
  /** 對應代碼（可能是 IATA 或 ICAO，依使用情境而定） */
  code: string;
}

/**
 * 通用 API 回應包裝型別
 * 統一封裝 loading / error / data 狀態，方便 composable 與元件消費
 */
export interface ApiResponse<T> {
  /** 請求是否進行中 */
  loading: boolean;
  /** 請求成功時的資料內容，失敗或尚未完成時為 null */
  data: T | null;
  /** 請求失敗時的錯誤訊息，成功時為 null */
  error: string | null;
}

/**
 * 輸入元件（機場/航空公司搜尋框）目前所處的互動狀態
 * - Idle：初始狀態，僅顯示 placeholder
 * - RecommendOpen：Focus 觸發，顯示「常見推薦視窗」
 * - FilterTyping：偵測到打字，關閉推薦視窗，改為顯示關鍵字篩選清單
 */
export enum SearchMode {
  /** 尚未互動，顯示 placeholder */
  Idle = 'IDLE',
  /** 已 Focus，顯示常見推薦視窗 */
  RecommendOpen = 'RECOMMEND_OPEN',
  /** 使用者輸入中，顯示關鍵字篩選清單（前端 filter） */
  FilterTyping = 'FILTER_TYPING',
}

/**
 * 標記使用者選擇的機場歸屬類別
 * 用於判斷是否需要套用「國外機場離站/進站語意反轉」邏輯
 * - Domestic：台灣本地機場（TDX 直接支援）
 * - Foreign：國外機場（TDX 僅回傳與桃園機場的往返航班，且離站/進站語意相反）
 */
export enum AirportSearchOrigin {
  /** 台灣本地機場 */
  Domestic = 'DOMESTIC',
  /** 國外機場 */
  Foreign = 'FOREIGN',
}