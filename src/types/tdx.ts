// src/types/tdx.ts

/**
 * TDX 機場基本資料結構
 * 對應 TDX Air/Airport API 回傳格式（前端快取後以此型別儲存於 Store）
 */
export interface TdxAirport {
  /** 機場中文名稱，如「台灣桃園國際機場」 */
  airportName: string;
  /** 機場英文名稱，如「Taiwan Taoyuan International Airport」 */
  airportNameEn: string;
  /** 機場 IATA 三碼，如 "TPE" */
  airportIATA: string;
  /** 機場 ICAO 四碼，如 "RCTP"（可能為空，視 TDX 資料完整度而定） */
  airportICAO?: string;
  /** 所在國家（英文或代碼），如 "Taiwan" */
  countryCode: string;
  /** 所在城市名稱，如「桃園」 */
  cityName?: string;
}

/**
 * TDX 航空公司基本資料結構
 * 對應 TDX Air/Airline API 回傳格式（前端快取後以此型別儲存於 Store）
 */
export interface TdxAirline {
  /** 航空公司中文名稱，如「長榮航空」 */
  airlineName: string;
  /** 航空公司英文名稱，如「EVA Airways Corporation」 */
  airlineNameEn: string;
  /** 航空公司 IATA 二碼，如 "BR" */
  airlineIATA: string;
  /** 航空公司 ICAO 三碼，如 "EVA"（供 OpenSky 轉譯使用） */
  airlineICAO?: string;
}

/**
 * TDX OAuth2 Token 取得回應結構
 * 對應 TDX 認證伺服器 (Auth API) 回傳格式
 */
export interface TdxAuthToken {
  /** 存取權杖字串，需附加於後續 API 請求 Header 中 */
  access_token: string;
  /** 權杖有效秒數，如 86400 */
  expires_in: number;
  /** 權杖類型，通常為 "Bearer" */
  token_type: string;
}

/**
 * 航班動態狀態列舉
 * 對應 TDX FIDS 回傳的 TripStatus 數字代碼，用於不便險理賠資格判定
 */
export enum TripStatus {
  /** 0: 正常 */
  Normal = 0,
  /** 1: 更改時間 */
  TimeChanged = 1,
  /** 2: 取消（直接符合理賠資格） */
  Cancelled = 2,
  /** 3: 延誤（需另計算時間差是否 >= 4小時） */
  Delayed = 3,
  /** 4: 登機中 */
  Boarding = 4,
  /** 5: 關閉 */
  Closed = 5,
  /** 6: 出發 */
  Departed = 6,
  /** 7: 抵達 */
  Arrived = 7,
  /** 數字對照以外的未知狀態 */
  Unknown = 99,
}

/**
 * 航班方向列舉
 * 代表查詢的是「進站航班」或「離站航班」
 * 注意：若搭配國外機場使用，UI 語意需相應反轉（詳見 composables/useAirportSearch.ts 說明）
 */
export enum FlightDirection {
  /** 抵達／進站航班 */
  Arrival = 'ARRIVAL',
  /** 出發／離站航班 */
  Departure = 'DEPARTURE',
}

/**
 * FIDS 單筆航班動態原始資料結構
 * 對應 TDX FIDS API（如 FIDSFlightArrival / FIDSFlightDeparture）回傳格式
 */
export interface FidsFlight {
  /** 航班編號，如 "BR301" */
  flightNumber: string;
  /** 執飛航空公司 IATA 代碼，如 "BR" */
  airlineID: string;
  /** 出發機場 IATA 代碼 */
  departureAirportID: string;
  /** 抵達機場 IATA 代碼 */
  arrivalAirportID: string;
  /** 表定出發時間（ISO 字串） */
  scheduleDepartureTime: string;
  /** 表定抵達時間（ISO 字串） */
  scheduleArrivalTime: string;
  /** 實際或預估出發時間（ISO 字串，可能為 null 表示尚未提供） */
  actualDepartureTime: string | null;
  /** 實際或預估抵達時間（ISO 字串，可能為 null 表示尚未提供） */
  actualArrivalTime: string | null;
  /** 航班目前狀態 */
  tripStatus: TripStatus;
  /** 航班查詢方向（進站／離站），由前端查詢當下標記，非 TDX 原始欄位 */
  direction: FlightDirection;
  /** 登機門（可能為 null） */
  gate?: string | null;
  /** 航廈（可能為 null） */
  terminal?: string | null;
}

/**
 * FIDS 查詢參數
 * 用於組裝呼叫 TDX FIDS API 的請求條件
 * 依規範：機場、航班號至少需擇一填入才可發起查詢
 */
export interface FidsQueryParams {
  /** 查詢機場 IATA 代碼（機場、航班號至少擇一） */
  airportCode?: string;
  /** 查詢航班號（機場、航班號至少擇一） */
  flightNumber?: string;
  /** 查詢方向：進站或離站 */
  direction: FlightDirection;
  /** 查詢日期（YYYY-MM-DD），未指定則預設當日 */
  date?: string;
}