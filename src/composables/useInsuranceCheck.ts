// src/composables/useInsuranceCheck.ts

import { computed, type Ref, unref } from 'vue';
import { checkInsuranceEligibility } from '@/utils/insuranceRule';
import { FlightDirection, type FidsFlight, type InsuranceEligibility } from '@/types';

/**
 * 不便險理賠資格判定 composable
 *
 * 接收單一 FidsFlight 航班資料（可為 ref 或原始物件），
 * 依查詢方向（進站/離站）決定應使用「表定/實際出發時間」或「表定/實際抵達時間」進行計算，
 * 呼叫 utils/insuranceRule.ts 純邏輯函式產生完整判定結果
 */
export function useInsuranceCheck(flight: Ref<FidsFlight | null> | FidsFlight | null) {
  /**
   * 響應式計算屬性：只要傳入的 flight 產生變化，computed 就會自動觸發
   * 傳入航班為 null 時，回傳「不符合資格」的預設結果，避免畫面出現例外
   */
  const eligibility = computed<InsuranceEligibility | null>(() => {
    const currentFlight = unref(flight);
    if (!currentFlight) return null;

    // 依查詢方向決定要比對「出發」或「抵達」的表定與實際時間
    const scheduleTime =
      currentFlight.direction === FlightDirection.Departure
        ? currentFlight.scheduleDepartureTime
        : currentFlight.scheduleArrivalTime;

    const actualTime =
      currentFlight.direction === FlightDirection.Departure
        ? currentFlight.actualDepartureTime
        : currentFlight.actualArrivalTime;

    return checkInsuranceEligibility(currentFlight.tripStatus, scheduleTime, actualTime);
  });

  return {
    eligibility,
  };
}