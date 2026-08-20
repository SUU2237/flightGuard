// src/utils/insuranceRule.ts

import {
  TripStatus,
  InsuranceReasonType,
  type DelayCalculationResult,
  type InsuranceEligibility,
} from '@/types';

/**
 * 不便險理賠門檻：測試使用1小時
 */
const DEFAULT_DELAY_THRESHOLD_MINUTES = 60;

/**
 * 計算「表定時間」與「實際/預估時間」的時間差（分鐘）
 * 純數學計算，不依賴任何外部狀態
 * returns 時間差計算結果，正值代表延誤，負值代表提前
 */
export function calculateDelayMinutes(
  scheduleTimeISO: string | null | undefined,
  actualTimeISO: string | null | undefined,
  thresholdMinutes: number = DEFAULT_DELAY_THRESHOLD_MINUTES,
): DelayCalculationResult {
  //例如：飛機還沒出發，所以沒有實際時間
  if (!scheduleTimeISO || !actualTimeISO) {
    return {
      isCalculable: false,
      delayMinutes: null,
      isOverThreshold: false,
    };
  }

  const scheduleTime = new Date(scheduleTimeISO).getTime();     //轉純數字的毫秒
  const actualTime = new Date(actualTimeISO).getTime();

  if (Number.isNaN(scheduleTime) || Number.isNaN(actualTime)) {
    return {
      isCalculable: false,
      delayMinutes: null,
      isOverThreshold: false,
    };
  }
  //延誤時間 = 實際 - 表定
  const delayMinutes = Math.round((actualTime - scheduleTime) / (1000 * 60));

  return {
    isCalculable: true,
    delayMinutes,
    isOverThreshold: delayMinutes >= thresholdMinutes,
  };
}

/**
 * 將延誤分鐘數格式化為「X 小時 Y 分」的中文顯示字串
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
 * 取消 or 延誤 or 有延誤但不理賠
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

  // 情況二：計算延誤時間，判斷是否達到門檻
  const delayInfo = calculateDelayMinutes(scheduleTimeISO, actualTimeISO, thresholdMinutes);

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

  // 情況三：有延誤，但不符合理賠資格
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