// src/composables/useFlightTracking.ts

import { ref, computed, type Ref, unref, watch, onMounted } from 'vue';
import { findStateVectorByCallsign } from '@/api/openSky/stateVector';
import { generateGreatCircleArc } from '@/utils/geoUtils';
import { useTdxBaseDataStore } from '@/stores/tdxBaseData';
import { getAirportCoordByIATA } from '@/utils/airportCoordLookup';
import {
  FlightAirborneStatus,
  TripStatus,
  type FidsFlight,
  type FlightState,
  type AircraftPosition,
} from '@/types';

/**
 * 台灣與常用外籍航空公司 IATA → ICAO 靜態 Fallback 對照表
 * 供 tdxStore 未載入完成或資料缺漏時保底使用，確保呼號轉換 100% 成功
 */
const FALLBACK_AIRLINE_ICAO_MAP: Record<string, string> = {
  // 國籍航空
  BR: 'EVA', // 長榮航空
  CI: 'CAL', // 中華航空
  JX: 'SJX', // 星宇航空
  B7: 'UIA', // 立榮航空
  AE: 'MDA', // 華信航空
  IT: 'TTW', // 台灣虎航
  // 日韓航空
  MM: 'APJ', // 樂桃航空
  KE: 'KAL', // 大韓航空
  OZ: 'AAR', // 韓亞航空
  NH: 'ANA', // 全日空
  JL: 'JAL', // 日本航空
  TW: 'TWB', // 德威航空
  LJ: 'JNA', // 真航空
  '7C': 'JJA', // 濟州航空
  BX: 'ABL', // 釜山航空
  // 東南亞航空
  TR: 'TGW', // 酷航
  AK: 'AXM', // 亞洲航空
  '3K': 'JSA', // 捷星亞洲
  FD: 'AIQ', // 泰國亞洲航空
  VJ: 'VJC', // 越捷航空
  TG: 'THA', // 泰國航空
  SQ: 'SIA', // 新加坡航空
  MH: 'MAS', // 馬來西亞航空
  PR: 'PAL', // 菲律賓航空
  CX: 'CPA', // 國泰航空
  HX: 'CRK', // 香港航空
  UO: 'HKE', // 香港快運
  // 中國籍航空
  CA: 'CCA', // 中國國際航空
  MU: 'CES', // 中國東方航空
  CZ: 'CSN', // 中國南方航空
  // 北美籍航空
  UA: 'UAL', // 聯合航空
  DL: 'DAL', // 達美航空
  AA: 'AAL', // 美國航空
};

/**
 * 單一航班 OpenSky 即時追蹤邏輯 composable
 */
export function useFlightTracking(flight: Ref<FidsFlight | null> | FidsFlight | null) {
  const tdxStore = useTdxBaseDataStore();

  /** 目前的飛行數據與狀態 */
  const flightState = ref<FlightState | null>(null);
  /** 起訖機場間的大圓航線弧線點陣列，僅 InAir 時有值 */
  const routeArc = ref<AircraftPosition[]>([]);
  /** 載入中狀態 */
  const isLoading = ref(false);
  /** 錯誤訊息 */
  const error = ref<string | null>(null);
  /** 網路連線異常或逾時旗標 */
  const isNetworkFailure = ref(false);

  /**
   * 綜合 TDX 狀態與 OpenSky 結果判定飛機航行狀態
   */
  function resolveAirborneStatus(
    currentFlight: FidsFlight,
    isAirborneOnOpenSky: boolean,
  ): FlightAirborneStatus {
    if (isAirborneOnOpenSky) {
      return FlightAirborneStatus.InAir;
    }
    if (currentFlight.tripStatus === TripStatus.Arrived) {
      return FlightAirborneStatus.Landed;
    }
    if (!currentFlight.actualDepartureTime) {
      return FlightAirborneStatus.NotDeparted;
    }
    return FlightAirborneStatus.Unknown;
  }

  /**
   * 動態組合 OpenSky ICAO 呼號 (如 "SJX822")
   */
  function resolveCallsign(airlineIATA: string, flightNumberDigits: string): string | null {
    const iata = airlineIATA.trim().toUpperCase();
    const digits = flightNumberDigits.replace(/[^0-9]/g, '');

    if (!digits) return null;

    // 1. 優先抓取 tdxStore 的 ICAO
    const airline = tdxStore.getAirlineByIATA(iata);
    let icaoCode = airline?.airlineICAO;

    // 2. 查無資料時退回靜態 Fallback 表
    if (!icaoCode) {
      icaoCode = FALLBACK_AIRLINE_ICAO_MAP[iata];
    }

    if (!icaoCode) {
      console.warn('[useFlightTracking] 查無航空公司 ICAO 代碼:', iata);
      return null;
    }

    return `${icaoCode}${digits}`;
  }

  /**
   * 執行追蹤查詢主邏輯
   */
  async function trackFlight(): Promise<void> {
    const currentFlight = unref(flight);

    if (!currentFlight) {
      flightState.value = null;
      routeArc.value = [];
      return;
    }

    isLoading.value = true;
    error.value = null;
    isNetworkFailure.value = false;

    try {
      const callsign = resolveCallsign(currentFlight.airlineID, currentFlight.flightNumber);
      console.log('[useFlightTracking] Callsign 轉換:', currentFlight.flightNumber, '->', callsign);
      //呼號查詢成功且飛機未著地時，判定為 InAir
      const stateVector = callsign ? await findStateVectorByCallsign(callsign) : undefined;
      const isAirborne = Boolean(stateVector && !stateVector.onGround);
      const airborneStatus = resolveAirborneStatus(currentFlight, isAirborne);

      if (airborneStatus === FlightAirborneStatus.InAir && stateVector) {
        // 飛航中：記錄真實數據與計算大圓航線
        flightState.value = {
          icao24: stateVector.icao24,
          airborneStatus,
          longitude: stateVector.longitude,
          latitude: stateVector.latitude,
          heading: stateVector.trueTrack,
          speedKmh: stateVector.velocity !== null ? Math.round(stateVector.velocity * 3.6) : null,    //OpenSky 回傳的速度是 m/s，換算成航空常用的 $km/h$
          altitude: stateVector.geoAltitude ?? stateVector.baroAltitude,
          updatedAt: Date.now(),
        };

        const originCoord = getAirportCoordByIATA(currentFlight.departureAirportID);
        const destCoord = getAirportCoordByIATA(currentFlight.arrivalAirportID);
        
        //生成大圓弧線點陣列
        routeArc.value =
          originCoord && destCoord
            ? generateGreatCircleArc(originCoord.lat, originCoord.lng, destCoord.lat, destCoord.lng)
            : [];
      } else {
        // 非飛航中：數據強制重設為 null
        flightState.value = {
          icao24: stateVector?.icao24 ?? '',
          airborneStatus,
          longitude: null,
          latitude: null,
          heading: null,
          speedKmh: null,
          altitude: null,
          updatedAt: Date.now(),
        };
        routeArc.value = [];
      }
    } catch (err) {
      // 捕獲逾時與網路連線異常 (相容性最佳寫法，不依賴 axios 額外 import)
      const errMessage = err instanceof Error ? err.message : String(err);
      const isTimeoutOrNetwork =
        errMessage.includes('timeout') || errMessage.includes('Network Error') || !navigator.onLine;

      if (isTimeoutOrNetwork) {
        console.error('[useFlightTracking] OpenSky 請求逾時或網路異常');
        isNetworkFailure.value = true;
      }

      error.value = errMessage;
      flightState.value = null;
      routeArc.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  /** 是否為真實飛在空中的班機 */
  const isInAir = computed(() => flightState.value?.airborneStatus === FlightAirborneStatus.InAir);

  /**
   * 是否已飛出雷達涵蓋範圍 (已起飛、未到表定抵達時間但無 OpenSky 數據)
   */
  const isOutOfRadarCoverage = computed(() => {
    if (isNetworkFailure.value) return true;

    const currentFlight = unref(flight);
    if (!currentFlight || !flightState.value) return false;

    const hasDeparted = Boolean(currentFlight.actualDepartureTime);
    const scheduledArrival = new Date(
      currentFlight.actualArrivalTime ?? currentFlight.scheduleArrivalTime,
    ).getTime();
    const notYetArrived = !Number.isNaN(scheduledArrival) && Date.now() < scheduledArrival + 30 * 60 * 1000;

    return (
      hasDeparted &&
      notYetArrived &&
      flightState.value.airborneStatus !== FlightAirborneStatus.InAir
    );
  });

  // 自動追蹤生命週期與響應式監聽
  onMounted(() => {
    void trackFlight();
  });

  if (flight && typeof flight === 'object' && 'value' in flight) {
    watch(
      () => (flight as Ref<FidsFlight | null>).value,
      () => {
        void trackFlight();
      },
    );
  }

  return {
    flightState,
    routeArc,
    isLoading,
    error,
    isInAir,
    isOutOfRadarCoverage,
    isNetworkFailure,
    trackFlight,
  };
}