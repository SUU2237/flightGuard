// src/api/tdx/airline.ts

import { httpClient } from '@/api/http';
import type { TdxAirline } from '@/types';

/**
 * TDX 航空公司 API 原始回傳格式（僅擷取本專案需要使用的欄位）
 * 對應 GET /v2/Air/Airline
 */
interface TdxAirlineRaw {
  AirlineID: string;
  AirlineName: { Zh_tw: string; En: string };
  AirlineICAO?: string;
}

/**
 * 將 TDX 航空公司原始回傳格式轉換為專案內部使用的 TdxAirline 型別
 *
 * param raw TDX 航空公司 API 單筆原始資料
 * returns 轉換後的 TdxAirline 物件
 */
function mapAirline(raw: TdxAirlineRaw): TdxAirline {
  return {
    airlineName: raw.AirlineName?.Zh_tw ?? '',
    airlineNameEn: raw.AirlineName?.En ?? '',
    airlineIATA: raw.AirlineID,
    airlineICAO: raw.AirlineICAO,
  };
}

/**
 * 呼叫 TDX API 取得全量航空公司資料
 */
export async function getAllAirlines(): Promise<TdxAirline[]> {
  const response = await httpClient.get<TdxAirlineRaw[]>('/v2/Air/Airline', {
    params: { $format: 'JSON' },
  });

  return response.data.map(mapAirline);
}