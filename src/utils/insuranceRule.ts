// src/utils/insuranceRule.ts

import {
  TripStatus,
  InsuranceReasonType,
  type DelayCalculationResult,
  type InsuranceEligibility,
} from '@/types';

/**
 * 不便險理賠門檻：延誤 4 小時（換算為分鐘）
 */
const DEFAULT_DELAY_THRESHOLD_MINUTES = 1;

/**
 * 計算「表定時間」與「實際/預估時間」的時間差（分鐘）
 * 純數學計算，不依賴任何外部狀態
 *
 * @param scheduleTimeISO 表定時間（ISO 字串）
 * @param actualTimeISO 實際或預估時間（ISO 字串），尚未提供時傳入 null
 * @returns 時間差計算結果，正值代表延誤，負值代表提前
 */
export function calculateDelayMinutes(
  scheduleTimeISO: string | null | undefined,
  actualTimeISO: string | null | undefined,
  thresholdMinutes: number = DEFAULT_DELAY_THRESHOLD_MINUTES,
): DelayCalculationResult {
  if (!scheduleTimeISO || !actualTimeISO) {
    return {
      isCalculable: false,
      delayMinutes: null,
      isOverThreshold: false,
    };
  }

  const scheduleTime = new Date(scheduleTimeISO).getTime();
  const actualTime = new Date(actualTimeISO).getTime();

  if (Number.isNaN(scheduleTime) || Number.isNaN(actualTime)) {
    return {
      isCalculable: false,
      delayMinutes: null,
      isOverThreshold: false,
    };
  }

  const delayMinutes = Math.round((actualTime - scheduleTime) / (1000 * 60));

  return {
    isCalculable: true,
    delayMinutes,
    isOverThreshold: delayMinutes >= thresholdMinutes,
  };
}

/**
 * 將延誤分鐘數格式化為「X 小時 Y 分」的中文顯示字串
 *
 * @param minutes 延誤分鐘數
 * @returns 格式化後的中文時間字串，如 "5 小時 20 分"
 */
function formatDelayDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins} 分`;
  if (mins === 0) return `${hours} 小時`;
  return `${hours} 小時 ${mins} 分`;
}

/**
 * 不便險理賠資格判定核心邏輯
 *
 * 判定規則：
 * - TripStatus 為「取消 (Cancelled)」：直接符合理賠資格
 * - TripStatus 為「延誤」且「實際/預估時間 - 表定時間 >= 240 分鐘（4小時）」：符合理賠資格
 * - 其餘狀況（正常、延誤未達門檻、狀態未知等）：不符合理賠資格
 *
 * @param tripStatus 航班目前狀態
 * @param scheduleTimeISO 表定時間（依查詢方向決定為出發或抵達時間）
 * @param actualTimeISO 實際或預估時間（依查詢方向決定為出發或抵達時間）
 * @returns 完整的不便險理賠資格判定結果
 */
export function checkInsuranceEligibility(
  tripStatus: TripStatus,
  scheduleTimeISO: string | null | undefined,
  actualTimeISO: string | null | undefined,
  thresholdMinutes: number = DEFAULT_DELAY_THRESHOLD_MINUTES,
): InsuranceEligibility {
  // 情況一：航班取消，直接符合理賠資格，無需計算延誤時間
  if (tripStatus === TripStatus.Cancelled) {
    return {
      isEligible: true,
      reasonType: InsuranceReasonType.Cancelled,
      tripStatus,
      delayInfo: null,
      displayMessage: '航班已取消，符合不便險理賠資格',
    };
  }

  // 情況二：計算延誤時間，判斷是否達到 4 小時門檻
  const delayInfo = calculateDelayMinutes(scheduleTimeISO, actualTimeISO, thresholdMinutes);

  // 修正：移除 tripStatus === TripStatus.Delayed 的強制檢查
  // 只要時間差確實達到門檻（isOverThreshold），不論 TDX 回傳的狀態文字為何
  // （可能狀態尚未更新為 Delayed，但實際時間已超標），一律判定符合理賠資格
  if (
    delayInfo.isCalculable &&
    delayInfo.isOverThreshold &&
    delayInfo.delayMinutes !== null
  ) {
    return {
      isEligible: true,
      reasonType: InsuranceReasonType.DelayOver4Hours,
      tripStatus,
      delayInfo,
      displayMessage: `航班延誤 ${formatDelayDuration(delayInfo.delayMinutes)}，符合不便險理賠資格（門檻 ${formatDelayDuration(thresholdMinutes)}）`,
    };
  }

  // 情況三：不符合理賠資格
  let displayMessage = '目前狀態不符合不便險理賠資格';
  if (delayInfo.isCalculable && delayInfo.delayMinutes !== null && delayInfo.delayMinutes > 0) {
    displayMessage = `航班延誤 ${formatDelayDuration(delayInfo.delayMinutes)}，未達 4 小時理賠門檻`;
  }

  return {
    isEligible: false,
    reasonType: InsuranceReasonType.NotEligible,
    tripStatus,
    delayInfo: delayInfo.isCalculable ? delayInfo : null,
    displayMessage,
  };
}