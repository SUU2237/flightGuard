// src/composables/useFidsData.ts

import { ref, computed } from 'vue';
import {
  getFidsFlightArrival,
  getFidsFlightDeparture,
  getFidsFlightByNumber,
} from '@/api/tdx/fids';
import { FlightDirection, type FidsFlight } from '@/types';
import { useAirportSearch } from '@/composables/useAirportSearch';
import { useAirlineSearch } from '@/composables/useAirlineSearch';
import { getTodayDateString } from '@/utils/dateTime';

/**
 * FIDS 航班動態查詢邏輯 composable
 *
 * 整合項目：
 * - useAirportSearch：機場輸入互動狀態與國外機場語意反轉邏輯
 * - useAirlineSearch：航空公司輸入互動狀態
 * - 航班號關鍵字、查詢方向、查詢結果、loading/error 狀態
 *
 * 查詢規則：機場、航班號至少需擇一填入才可發起查詢
 */
export function useFidsData() {
  const airport = useAirportSearch();
  const airline = useAirlineSearch();

  /** 航班號輸入欄關鍵字 */
  const flightNumberKeyword = ref('');
  /** 查詢方向：進站或離站，預設為離站 */
  const direction = ref<FlightDirection>(FlightDirection.Departure);
  /** 查詢日期，預設為今日 */
  const queryDate = ref<string>(getTodayDateString());
  /** 查詢範圍模式，預設為「即時/未來航班」*/
  const scopeMode = ref<'today' | 'realtime'>('realtime');

  /** 查詢結果清單 */
  const flightList = ref<FidsFlight[]>([]);
  /** 查詢中狀態 */
  const isLoading = ref(false);
  /** 查詢錯誤訊息，成功則為 null */
  const error = ref<string | null>(null);

  /**
   * 是否符合可發起查詢的最低條件（機場或航班號至少擇一）
   */
  const canSearch = computed(() => {
    return Boolean(airport.selectedAirport.value) || Boolean(flightNumberKeyword.value.trim());
  });

  /**
   * 清空航班號輸入欄
   */
  function clearFlightNumber(): void {
    flightNumberKeyword.value = '';
  }

  /**
   * 執行 FIDS 航班動態查詢
   *
   * 修正重點：
   * 1. 國外機場二次過濾：TDX 僅能查「與桃園的往返」，故抓回資料後必須額外比對
   *    對方機場（出發或抵達）是否確實等於使用者選擇的國外機場，避免不同國外機場的航班混在一起
   * 2. 航空公司過濾：新增依 airline.selectedAirline 過濾 flight.airlineID
   * 3. 時間過濾欄位修正：依查詢方向決定要比對「出發時間」還是「抵達時間」，
   *    避免進站查詢誤用出發時間做 buffer/日期比對，導致有效航班被濾掉
   */
  async function search(): Promise<void> {
    if (!canSearch.value) {
      error.value = '請至少輸入「機場」或「航班號」其中一項才可查詢';
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      // 1. 取得去空白後的航班號、已選機場、已選航空公司
      const trimmedFlightNumber = flightNumberKeyword.value.trim();
      const selectedAirport = airport.selectedAirport.value;
      const selectedAirline = airline.selectedAirline.value;
      let result: FidsFlight[] = [];

      // 2. 判斷是否為國外機場，若是則記下代碼（如 "NRT"）
      const isForeign = airport.isForeignAirport.value;                                 //記錄查詢當下的原始使用者選擇，避免搜尋期間使用者亂按
      const originalForeignIATA = isForeign ? selectedAirport?.airportIATA : null;      //如果是國外機場，取其IATA碼，否則null

      if (selectedAirport) {
        // 3. 如果選國外機場，透過 Composable 轉為「桃園端點」與「反轉方向」
        const airportCode = airport.getEffectiveQueryAirportCode();
        const effectiveDirection = airport.getEffectiveDirection(direction.value);

        if (!airportCode) {
          throw new Error('機場代碼解析失敗，請重新選擇機場');
        }
        // 4. 整理要傳入的參數
        const params = {
          airportCode,
          flightNumber: trimmedFlightNumber || undefined,
          direction: effectiveDirection,
          date: queryDate.value,
        };
        // 5. 根據反轉後的方向，向 TDX 抓離站或進站看板
        result =
          effectiveDirection === FlightDirection.Departure
            ? await getFidsFlightDeparture(params)
            : await getFidsFlightArrival(params);

        console.log('[useFidsData] API 回傳筆數（過濾前）:', result.length);

        // 6. 國外機場二次過濾：從桃園回傳的大量資料中，只挑出對方機場剛好是該國外機場的班機
        if (isForeign && originalForeignIATA) {
          result = result.filter((f) => {
            const counterpartAirport =
              direction.value === FlightDirection.Departure
                ? f.departureAirportID
                : f.arrivalAirportID;
            return counterpartAirport === originalForeignIATA;
          });
          console.log(
            '[useFidsData] 國外機場二次過濾（比對對方機場 =',
            originalForeignIATA,
            '）後筆數:',
            result.length,
          );
        }
      } 
      // 7. 如果沒選機場只輸入航班號，直接打依航班號查詢的 API
      else {
        result = await getFidsFlightByNumber(trimmedFlightNumber, direction.value);
      }

      // 航空公司過濾
      if (selectedAirline) {
        const beforeCount = result.length;
        result = result.filter((f) => f.airlineID === selectedAirline.airlineIATA);
        console.log(
          '[useFidsData] 航空公司過濾（',
          selectedAirline.airlineIATA,
          '）:',
          beforeCount,
          '→',
          result.length,
        );
      }

      /**
       * 取得飛機「最新/真實的動態時間點」
       * 用在即時/未來模式
       * 依每筆資料「自己實際的 f.direction」判斷要看出發或抵達時間欄位
       */
      function getReferenceTimeISO(f: FidsFlight): string | null {
        const primary =
          f.direction === FlightDirection.Departure
            ? (f.actualDepartureTime ?? f.scheduleDepartureTime)
            : (f.actualArrivalTime ?? f.scheduleArrivalTime);

        if (primary) return primary;

        // Fallback：主要方向時間為空，退回任何一組有值的時間欄位
        return f.actualDepartureTime ?? f.scheduleDepartureTime ?? f.actualArrivalTime ?? f.scheduleArrivalTime ?? null;
      }

      /**
       * 取得航班在時刻表上的原始基準時間
       * 用在今日全天模式
       */
      function getScheduleTimeISO(f: FidsFlight): string {
        const primary = f.direction === FlightDirection.Departure ? f.scheduleDepartureTime : f.scheduleArrivalTime;

        if (primary) return primary;

        return f.scheduleDepartureTime || f.scheduleArrivalTime || '';
      }

      // 8. 依據時間範圍模式（今日全天 vs 即時未來）進行時間過濾
      // 搜尋「今日全天」
      if (scopeMode.value === 'today') {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        
        result = result.filter((f) => {
          const scheduleTimeISO = getScheduleTimeISO(f);
          if (!scheduleTimeISO) return false;
          const scheduleTime = new Date(scheduleTimeISO);
          if (Number.isNaN(scheduleTime.getTime())) return false;
          return scheduleTime.getTime() >= startOfToday.getTime() && scheduleTime.getTime() <= endOfToday.getTime();
        });

        console.log('[useFidsData] 今日全天範圍:', startOfToday.toISOString(), '~', endOfToday.toISOString());
      } 
      //搜尋「即時/未來」
      else {
        const BUFFER_MINUTES = 30;
        const bufferedNow = new Date(Date.now() - BUFFER_MINUTES * 60 * 1000);

        result = result.filter((f) => {
          const referenceTimeISO = getReferenceTimeISO(f);
          if (!referenceTimeISO) return false;
          const referenceTime = new Date(referenceTimeISO);
          if (Number.isNaN(referenceTime.getTime())) return false;
          return referenceTime.getTime() >= bufferedNow.getTime();
        });
      }

      console.log('[useFidsData] scopeMode:', scopeMode.value, '最終顯示筆數:', result.length);
      // 10. 將最終過濾好的乾淨清單更新給響應式變數 flightList，畫面自動重新渲染
      flightList.value = result;
    } catch (err) {
      console.error('[useFidsData] 查詢失敗:', err);
      error.value = err instanceof Error ? err.message : 'FIDS 航班動態查詢失敗';
      flightList.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  function resetAllSearch(): void {
    airport.clearAirport();
    airline.clearAirline();
    clearFlightNumber();
    direction.value = FlightDirection.Departure;
    queryDate.value = getTodayDateString();
    scopeMode.value = 'realtime';
    flightList.value = [];
    error.value = null;
  }

  return {
    airport,
    airline,
    flightNumberKeyword,
    direction,
    queryDate,
    scopeMode,
    flightList,
    isLoading,
    error,
    canSearch,
    clearFlightNumber,
    search,
    resetAllSearch,
  };
}