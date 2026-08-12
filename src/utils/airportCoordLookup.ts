// src/utils/airportCoordLookup.ts

/**
 * 全球機場座標查找工具
 * 資料來源：https://raw.githubusercontent.com/mwgg/Airports/master/airports.json
 * 完全取代 TDX AirportPosition 座標（TDX 資料不穩定/缺漏過多），
 * 改以此開源全球機場資料庫作為地圖繪製唯一座標來源
 */
import rawAirportsData from '@/data/airports.json';

/** 開源機場 JSON 單筆資料結構（僅列出本專案需要使用的欄位） */
interface RawAirportEntry {
  icao: string;
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
}

/** 型別斷言：import 進來的 JSON 物件，key 為機場代碼字串，value 為機場資料 */
const airportsData = rawAirportsData as Record<string, RawAirportEntry>;

/**
 * 依 IATA 三碼查找機場經緯度座標
 *
 * 注意：JSON 的 key 並非保證為 IATA 碼（部分為 ICAO 或內部代碼），
 * 故不直接用 key 查找，改為遍歷 value 陣列比對 iata 欄位，確保查找結果正確
 *
 * @param iataCode 機場 IATA 三碼，如 "TPE"
 * @returns 找到則回傳 { lat, lng }，查無資料則回傳 null
 */
export function getAirportCoordByIATA(iataCode: string): { lat: number; lng: number } | null {
  const target = iataCode.trim().toUpperCase();

  const found = Object.values(airportsData).find(
    (airport) => airport.iata?.toUpperCase() === target,
  );

  if (!found || typeof found.lat !== 'number' || typeof found.lon !== 'number') {
    return null;
  }

  return { lat: found.lat, lng: found.lon };
}