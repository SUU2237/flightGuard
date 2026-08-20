// src/api/tdx/fids.ts

import { httpClient } from '@/api/http';
import {
  FlightDirection,
  TripStatus,
  type FidsFlight,
  type FidsQueryParams,
} from '@/types';

/**
 * TDX FIDS 航班動態原始回傳格式（僅擷取本專案需要使用的欄位）
 * 對應 GET /v2/Air/FIDS/Airport/{Arrival|Departure}
 */
interface FidsFlightRaw {
  FlightNumber: string;
  AirlineID: string;
  DepartureAirportID: string;
  ArrivalAirportID: string;
  ScheduleDepartureTime: string | null;
  ScheduleArrivalTime: string | null;
  ActualDepartureTime: string | null;
  ActualArrivalTime: string | null;
  TripStatus: TripStatus;
  Gate?: string | null;
  Terminal?: string | null;
  DepartureRemark?: string | null;
  ArrivalRemark?: string | null;
}


/**
 * 以「時間差為主、Remark 為輔」判定實際應顯示的航班狀態
 * 判定優先順序：
 * 1. Remark 含 CANCELLED / 取消 → Cancelled（最高優先，即使時間差算不出來也要顯示取消）
 * 2. 表定與實際時間差 >= 1 分鐘 → 強制判定 Delayed（不依賴 TDX 原始 TripStatus 是否已更新）
 * 3. Remark 關鍵字比對（中英混合）→ Departed / Normal
 * 4. 都無法判定 → 沿用 TDX 原始 TripStatus 作為最後 fallback
 */
function resolveTripStatus(
  raw: FidsFlightRaw,
  scheduleTime: string | null,
  actualTime: string | null,
): TripStatus {
  const remark = `${raw.DepartureRemark ?? ''} ${raw.ArrivalRemark ?? ''}`.toUpperCase();

  // 優先順序 1：Remark 明確標示取消
  if (remark.includes('CANCELLED') || remark.includes('取消')) {
    return TripStatus.Cancelled;
  }

  // 優先順序 2：時間差判定（時間差為主要依據，>= 1 分鐘即視為延誤，測試門檻，正式環境可調高）
  if (scheduleTime && actualTime) {
    const diffMinutes = (new Date(actualTime).getTime() - new Date(scheduleTime).getTime()) / 60000;
    if (diffMinutes >= 1) {
      return TripStatus.Delayed;
    }
  }

  // 優先順序 3：Remark 關鍵字比對（中英混合，用 includes 寬鬆比對）
  if (remark.includes('DEPARTED') || remark.includes('出發') || remark.includes('ARRIVED') || remark.includes('抵達')) {
    return TripStatus.Departed;
  }
  if (remark.includes('ON TIME') || remark.includes('準時')) {
    return TripStatus.Normal;
  }

  // 優先順序 4：都無法判定，沿用 TDX 原始狀態
  return raw.TripStatus ?? TripStatus.Normal;
}

function mapFidsFlight(raw: FidsFlightRaw, direction: FlightDirection): FidsFlight {
  const scheduleTime =
    direction === FlightDirection.Departure ? raw.ScheduleDepartureTime : raw.ScheduleArrivalTime;
  const actualTime =
    direction === FlightDirection.Departure ? raw.ActualDepartureTime : raw.ActualArrivalTime;

  return {
    flightNumber: raw.FlightNumber,
    airlineID: raw.AirlineID,
    departureAirportID: raw.DepartureAirportID,
    arrivalAirportID: raw.ArrivalAirportID,
    scheduleDepartureTime: raw.ScheduleDepartureTime ?? '',
    scheduleArrivalTime: raw.ScheduleArrivalTime ?? '',
    actualDepartureTime: raw.ActualDepartureTime,
    actualArrivalTime: raw.ActualArrivalTime,
    tripStatus: resolveTripStatus(raw, scheduleTime, actualTime),
    direction,
    gate: raw.Gate ?? null,
    terminal: raw.Terminal ?? null,
  };
}

/**
 * 依 FidsQueryParams 組合 TDX OData $filter 查詢字串
 *
 * 如果有指定航班號，組裝標準 OData 查詢語法 FlightNumber eq '106' 傳給 TDX 伺服器進行過濾
 */
function buildODataFilter(params: FidsQueryParams): string | undefined {
  if (!params.flightNumber) return undefined;
  return `FlightNumber eq '${params.flightNumber.trim().toUpperCase()}'`;
}

/**
 * 查詢指定機場的離站航班動態 (FIDSFlightDeparture)
 * 
 * param params FIDS 查詢參數，須包含 airportCode（機場代碼）
 * returns 離站航班動態清單
 */
export async function getFidsFlightDeparture(
  params: FidsQueryParams,
): Promise<FidsFlight[]> {
  if (!params.airportCode) {
    throw new Error('查詢離站航班動態時，airportCode 為必填參數');
  }
  const filter = buildODataFilter(params);
  console.debug('[FIDS] 查詢離站', params.airportCode, 'filter=', filter);

  const response = await httpClient.get<FidsFlightRaw[]>(
    `/v2/Air/FIDS/Airport/Departure/${params.airportCode}`,
    {
      params: {
        $filter: filter,
        $format: 'JSON',
      },
    },
  );
  console.debug('[FIDS] 離站回傳筆數:', response.data.length);
  return response.data.map((raw) => mapFidsFlight(raw, FlightDirection.Departure));
}

/**
 * 查詢指定機場的進站航班動態 (FIDSFlightArrival)
 */
export async function getFidsFlightArrival(
  params: FidsQueryParams,
): Promise<FidsFlight[]> {
  if (!params.airportCode) {
    throw new Error('查詢進站航班動態時，airportCode 為必填參數');
  }

  const filter = buildODataFilter(params);
  console.debug('[FIDS] 查詢進站', params.airportCode, 'filter=', filter);

  const response = await httpClient.get<FidsFlightRaw[]>(
    `/v2/Air/FIDS/Airport/Arrival/${params.airportCode}`,
    {
      params: {
        $filter: filter,
        $format: 'JSON',
      },
    },
  );
  console.debug('[FIDS] 進站回傳筆數:', response.data.length);
  return response.data.map((raw) => mapFidsFlight(raw, FlightDirection.Arrival));
}

/**
 * 依航班號直接查詢航班動態（不限機場），適用於僅輸入「航班號」的搜尋情境
 * 同時查詢進站與離站端點並合併結果，交由呼叫端（composable）依需求篩選
 *
 * param flightNumber 航班號，如 "BR301"
 * param direction 查詢方向，決定呼叫進站或離站端點
 * returns 對應方向的航班動態清單
 */
export async function getFidsFlightByNumber(
  flightNumber: string,
  direction: FlightDirection,
): Promise<FidsFlight[]> {
  const filter = `FlightNumber eq '${flightNumber.trim().toUpperCase()}'`;

  const endpoint =
    direction === FlightDirection.Departure
      ? '/v2/Air/FIDS/Airport/Departure'
      : '/v2/Air/FIDS/Airport/Arrival';

  const response = await httpClient.get<FidsFlightRaw[]>(endpoint, {
    params: {
      $filter: filter,
      $format: 'JSON',
    },
  });

  console.debug('[FIDS] 依航班號回傳筆數:', response.data.length);
  return response.data.map((raw) => mapFidsFlight(raw, direction));
}