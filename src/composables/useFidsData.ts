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
  /** 新增：查詢範圍模式，預設為「即時/未來航班」*/
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
   * 依查詢方向取出應比對的表定時間欄位，供前端日期篩選使用
   */
  function isSameLocalDate(isoString: string, dateStr: string): boolean {
    if (!isoString || !dateStr) return true; // 未指定日期（即時/未來航班模式）時不篩選
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return false;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}` === dateStr;
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
      const trimmedFlightNumber = flightNumberKeyword.value.trim();
      const selectedAirport = airport.selectedAirport.value;
      const selectedAirline = airline.selectedAirline.value;
      let result: FidsFlight[] = [];

      // 記錄查詢當下的原始使用者選擇，供後續二次過濾比對使用
      const isForeign = airport.isForeignAirport.value;
      const originalForeignIATA = isForeign ? selectedAirport?.airportIATA : null;

      if (selectedAirport) {
        const airportCode = airport.getEffectiveQueryAirportCode();
        const effectiveDirection = airport.getEffectiveDirection(direction.value);

        if (!airportCode) {
          throw new Error('機場代碼解析失敗，請重新選擇機場');
        }

        const params = {
          airportCode,
          flightNumber: trimmedFlightNumber || undefined,
          direction: effectiveDirection,
          date: queryDate.value,
        };

        result =
          effectiveDirection === FlightDirection.Departure
            ? await getFidsFlightDeparture(params)
            : await getFidsFlightArrival(params);

        console.log('[useFidsData] API 回傳筆數（過濾前）:', result.length);

        // 修正一：國外機場二次過濾
        // UI 選「離站」= 從國外機場飛回桃園 → 對方機場應等於 departureAirportID
        // UI 選「進站」= 從桃園飛往國外機場 → 對方機場應等於 arrivalAirportID
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
      } else {
        result = await getFidsFlightByNumber(trimmedFlightNumber, direction.value);
      }

      // 修正二：航空公司過濾（原本完全沒有套用）
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
       * 修正：改依每筆資料「自己實際的 f.direction」判斷要看出發或抵達時間欄位，
       * 不再統一套用 direction.value（畫面上 UI 選的方向）。
       * 原因：國外機場離站/進站語意反轉後，f.direction 是實際呼叫 TDX API 端點所對應的方向
       * （如「東京離站」實際上是查桃園 Arrival 端點，f.direction 為 Arrival），
       * 若統一用 direction.value 判斷，會抓錯這批資料通常缺漏的欄位，導致全數被誤判為無參考時間
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

      function getScheduleTimeISO(f: FidsFlight): string {
        const primary = f.direction === FlightDirection.Departure ? f.scheduleDepartureTime : f.scheduleArrivalTime;

        if (primary) return primary;

        return f.scheduleDepartureTime || f.scheduleArrivalTime || '';
      }

      // 修正：「今日全天」改用明確的 00:00:00 ~ 23:59:59 時間範圍過濾，
      // 取代原本僅比對「日期字串是否相同」的寫法，語意更精確且避免時區邊界誤判
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
      } else {
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
    // 修正：重設時同步將 scopeMode 恢復為預設值「即時/未來航班」
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