// src/utils/airportCoordLookup.ts

/**
 * 全球機場座標查找工具
 * 資料來源：https://raw.githubusercontent.com/mwgg/Airports/master/airports.json
 */
import rawAirportsData from '@/data/airports.json';

/** 開源機場 JSON 單筆資料結構 */
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