// src/types/openSky.ts

/**
 * OpenSky State Vector 原始資料格式
 * 對應 OpenSky Network REST API (/states/all) 回傳的單一飛機陣列格式
 * 注意：原始 API 回傳為「陣列」而非物件，此處依官方文件索引順序定義各欄位語意，
 * 實際轉換時需於 api/openSky/stateVector.ts 中將陣列 map 為此結構
 */
export interface OpenSkyStateVector {
  /** 飛機 ICAO24 位址（唯一識別碼，24-bit hex），如 "8990ed" */
  icao24: string;
  /** 呼號 (Callsign)，通常對應航班號，可能含前後空白 */
  callsign: string | null;
  /** 飛機註冊母國 */
  originCountry: string;
  /** 最後接收位置資訊的 Unix 時間戳（秒），可能為 null */
  timePosition: number | null;
  /** 最後接收任何資訊的 Unix 時間戳（秒） */
  lastContact: number;
  /** 經度（WGS-84），無資料時為 null */
  longitude: number | null;
  /** 緯度（WGS-84），無資料時為 null */
  latitude: number | null;
  /** 氣壓高度，單位公尺，無資料時為 null */
  baroAltitude: number | null;
  /** 是否在地面 */
  onGround: boolean;
  /** 地速，單位 m/s，無資料時為 null */
  velocity: number | null;
  /** 航向角（true track），單位度數（0 為正北，順時針），無資料時為 null */
  trueTrack: number | null;
  /** 垂直速率，單位 m/s（正值為爬升），無資料時為 null */
  verticalRate: number | null;
  /** GPS 高度，單位公尺，無資料時為 null */
  geoAltitude: number | null;
  /** 應答機代碼 (squawk code)，無資料時為 null */
  squawk: string | null;
}

/**
 * 飛機顯示狀態列舉
 * 依規範：僅「真實飛在空中」的班機顯示即時位置與飛行數據，其餘一律以 "--" 顯示
 */
export enum FlightAirborneStatus {
  /** 目前確實在空中飛行中，顯示即時位置與飛行數據 */
  InAir = 'IN_AIR',
  /** 尚未出發，顯示 "--" */
  NotDeparted = 'NOT_DEPARTED',
  /** 已抵達（含已落地），顯示 "--" */
  Landed = 'LANDED',
  /** OpenSky 查無對應資料或無法判定，顯示 "--" */
  Unknown = 'UNKNOWN',
}

/**
 * 轉換後易用的飛行狀態物件
 * 由 OpenSkyStateVector 經 composables/useFlightTracking.ts 整理而成，
 * 供地圖繪製與 UI 顯示直接使用
 */
export interface FlightState {
  /** 對應飛機 ICAO24 位址 */
  icao24: string;
  /** 飛機目前顯示狀態，決定是否顯示即時數據或 "--" */
  airborneStatus: FlightAirborneStatus;
  /** 目前經度，非在空中狀態時為 null */
  longitude: number | null;
  /** 目前緯度，非在空中狀態時為 null */
  latitude: number | null;
  /** 目前航向角（度），非在空中狀態時為 null */
  heading: number | null;
  /** 目前地速（km/h，已由 m/s 轉換），非在空中狀態時為 null */
  speedKmh: number | null;
  /** 目前高度（公尺），非在空中狀態時為 null */
  altitude: number | null;
  /** 資料更新的時間戳（毫秒），供前端判斷資料新鮮度 */
  updatedAt: number;
}

/**
 * 地圖繪製用的座標點結構
 * 用於 RoutePolyline.vue 繪製航線與飛機當前位置標記
 */
export interface AircraftPosition {
  /** 緯度 */
  lat: number;
  /** 經度 */
  lng: number;
  /** 航向角（度），用於飛機圖示旋轉朝向 */
  heading?: number;
  /** 該座標點對應的時間戳（毫秒） */
  timestamp: number;
}

/**
 * IATA / ICAO 代碼對應表項目
 * 用於 utils/codeMapper.ts 建立航空公司代碼轉換查找表
 * （TDX 多為 IATA 碼，OpenSky callsign 需比對 ICAO 碼開頭）
 */
export interface AirlineCodeMapping {
  /** 航空公司 IATA 二碼，如 "BR" */
  iata: string;
  /** 航空公司 ICAO 三碼，如 "EVA" */
  icao: string;
}