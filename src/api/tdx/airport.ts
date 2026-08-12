// src/api/tdx/airport.ts

import { httpClient } from '@/api/http';
import type { TdxAirport } from '@/types';

/**
 * TDX 機場座標原始格式
 * 對應 TDX Air/Airport API 回傳的 AirportPosition 巢狀物件
 */
interface TdxAirportPositionRaw {
  PositionLon: number;
  PositionLat: number;
}

/**
 * TDX 機場 API 原始回傳格式（僅擷取本專案需要使用的欄位）
 * 對應 GET /v2/Air/Airport
 */
interface TdxAirportRaw {
  AirportID: string;
  AirportName: { Zh_tw: string; En: string };
  IcaoID?: string;
  City?: string;
  Country?: string;
  CountryCode?: string;
  AirportPosition?: TdxAirportPositionRaw;
}

/**
 * 將 TDX 機場原始回傳格式轉換為專案內部使用的 TdxAirport 型別
 *
 * @param raw TDX 機場 API 單筆原始資料
 * @returns 轉換後的 TdxAirport 物件
 */
function mapAirport(raw: TdxAirportRaw): TdxAirport {
  return {
    airportName: raw.AirportName?.Zh_tw ?? '',
    airportNameEn: raw.AirportName?.En ?? '',
    airportIATA: raw.AirportID,
    airportICAO: raw.IcaoID,
    countryCode: raw.CountryCode ?? raw.Country ?? '',
    cityName: raw.City,
    // 供地圖繪製與大圓航線計算使用；TDX 若未提供座標則保持 undefined
    latitude: raw.AirportPosition?.PositionLat,
    longitude: raw.AirportPosition?.PositionLon,
  };
}

/**
 * 呼叫 TDX API 取得全量機場資料
 *
 * 【重要】依據防坑架構規範，TDX 不支援 OData contains 函數，
 * 此函式僅負責「一次性取得全部機場資料」，不接受任何關鍵字篩選參數，
 * 關鍵字搜尋一律交由 stores/tdxBaseData.ts 以 Array.filter 於前端處理
 *
 * @returns 轉換後的全量機場清單（含經緯度座標）
 */
export async function getAllAirports(): Promise<TdxAirport[]> {
  const response = await httpClient.get<TdxAirportRaw[]>('/v2/Air/Airport', {
    params: { $format: 'JSON' },
  });

  return response.data.map(mapAirport);
}