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