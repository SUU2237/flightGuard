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
 */
function mapAirport(raw: TdxAirportRaw): TdxAirport {
  return {
    airportName: raw.AirportName?.Zh_tw ?? '',
    airportNameEn: raw.AirportName?.En ?? '',
    airportIATA: raw.AirportID,
    airportICAO: raw.IcaoID,
    countryCode: raw.CountryCode ?? raw.Country ?? '',
    cityName: raw.City,
  };
}

/**
 * 呼叫 TDX API 一次取得全量機場資料
 */
export async function getAllAirports(): Promise<TdxAirport[]> {
  const response = await httpClient.get<TdxAirportRaw[]>('/v2/Air/Airport', {
    params: { $format: 'JSON' },
  });

  return response.data.map(mapAirport);
}