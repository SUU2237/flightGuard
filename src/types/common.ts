// src/types/common.ts

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