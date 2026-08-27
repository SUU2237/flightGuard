// src/types/claim.ts

import type { FidsFlight } from './tdx';

/**
 * 理賠案件處理狀態
 * - watching：追蹤中（航班正常或延誤未達理賠門檻）
 * - pending：待審核（航班取消或延誤已達理賠門檻，等待人工審核撥款）
 * - approved：已核付
 * - rejected：駁回／已結案
 */
export type ClaimStatus = 'watching' | 'pending' | 'approved' | 'rejected';

/**
 * 理賠待處理工作台單筆案件
 * 包裝原始 FidsFlight 航班動態資料，附加案件處理狀態與加入時間
 */
export interface ClaimItem {
  /** 案件識別 id（與 utils/flightId.ts 產生的航班 id 一致，用於去重與狀態更新） */
  id: string;
  /** 原始航班動態資料 */
  flight: FidsFlight;
  /** 目前處理狀態 */
  status: ClaimStatus;
  /** 加入工作台的時間戳（Date.now()） */
  addedAt: number;
}
