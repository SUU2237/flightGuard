// src/types/insurance.ts

import type { TripStatus } from './tdx';

/**
 * 不便險理賠原因分類列舉
 */
export enum InsuranceReasonType {
  /** 航班取消，直接符合理賠資格 */
  Cancelled = 'CANCELLED',
  /** 航班延誤且時間差 >= 4 小時，符合理賠資格 */
  DelayOver4Hours = 'DELAY_OVER_4_HOURS',
  /** 不符合理賠資格（正常、延誤未達門檻，或狀態未知） */
  NotEligible = 'NOT_ELIGIBLE',
}

/**
 * 延誤時間計算結果
 * 由 utils/insuranceRule.ts 依「表定時間」與「實際/預估時間」計算得出
 */
export interface DelayCalculationResult {
  /** 是否有足夠資料可進行延誤計算（缺少表定或實際時間時為 false） */
  isCalculable: boolean;
  /** 延誤分鐘數，無法計算時為 null（負值代表提前，不視為延誤） */
  delayMinutes: number | null;
  /** 是否達到 4 小時（240 分鐘）以上之理賠門檻 */
  isOverThreshold: boolean;
}

/**
 * 不便險理賠資格判定結果
 * 由 composables/useInsuranceCheck.ts 呼叫 utils/insuranceRule.ts 計算後產生，
 * 供 components/fids/InsuranceBadge.vue 顯示高亮提示使用
 */
export interface InsuranceEligibility {
  /** 是否符合理賠資格（Cancelled 或 DelayOver4Hours 時為 true） */
  isEligible: boolean;
  /** 判定原因分類 */
  reasonType: InsuranceReasonType;
  /** 判定當下所依據的航班狀態（原始 TDX TripStatus 數值） */
  tripStatus: TripStatus;
  /** 對應的延誤時間計算結果（航班取消時可能為 null，因無需計算延誤） */
  delayInfo: DelayCalculationResult | null;
  /** 顯示於 UI 的判定說明文字，如「延誤 5 小時 20 分，符合理賠資格」 */
  displayMessage: string;
}