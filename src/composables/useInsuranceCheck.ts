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
 *
 * @param flight 單一航班動態資料，可傳入 ref 以支援響應式自動重新計算
 * @returns 響應式的理賠資格判定結果 eligibility
 */
export function useInsuranceCheck(flight: Ref<FidsFlight | null> | FidsFlight | null) {
  /**
   * 響應式計算屬性：完整的不便險理賠資格判定結果
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

  /** 是否符合理賠資格（便於 UI 直接綁定高亮樣式，尚無資料時為 false） */
  const isEligible = computed<boolean>(() => eligibility.value?.isEligible ?? false);

  /** 理賠原因分類（尚無資料時為 null） */
  const reasonType = computed(() => eligibility.value?.reasonType ?? null);

  /** UI 顯示用的判定說明文字（尚無資料時為空字串） */
  const displayMessage = computed<string>(() => eligibility.value?.displayMessage ?? '');

  return {
    eligibility,
    isEligible,
    reasonType,
    displayMessage,
  };
}