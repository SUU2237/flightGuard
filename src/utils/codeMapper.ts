// src/utils/codeMapper.ts

/**
 * 航空公司 IATA <-> ICAO 代碼對照表
 * TDX（ IATA 碼）與 OpenSky（ ICAO 碼）之間互相轉譯
 * 如有新增航空公司需求，於此表補充即可
 */
const AIRLINE_CODE_MAP: Record<string, string> = {
  // IATA -> ICAO
  BR: 'EVA', // 長榮航空 EVA Air
  CI: 'CAL', // 中華航空 China Airlines
  JX: 'SJX', // 星宇航空 STARLUX Airlines
  B7: 'UIA', // 立榮航空 UNI Air
  AE: 'MDA', // 華信航空 Mandarin Airlines
  IT: 'TTW', // 台灣虎航 Tigerair Taiwan
};

/**
 * ICAO -> IATA 反向對照表
 * 由 AIRLINE_CODE_MAP 自動反轉建立，避免手動維護兩份表造成資料不一致
 */
const AIRLINE_CODE_MAP_REVERSE: Record<string, string> = 
  //把物件拆成鍵值對的二維陣列：[ ['BR', 'EVA'], ['CI', 'CAL']... ]
  Object.entries(AIRLINE_CODE_MAP,)
    .reduce((acc, [iata, icao]) => {
    acc[icao] = iata;
    return acc;
  }, {} as Record<string, string>);

/**
 * 將航空公司 IATA 二碼轉換為 ICAO 三碼
 */
export function iataToIcaoAirline(iataCode: string): string | null {
  const key = iataCode.trim().toUpperCase();
  return AIRLINE_CODE_MAP[key] ?? null;
}

/**
 * 將航空公司 ICAO 三碼轉換為 IATA 二碼
 */
export function icaoToIataAirline(icaoCode: string): string | null {
  const key = icaoCode.trim().toUpperCase();
  return AIRLINE_CODE_MAP_REVERSE[key] ?? null;
}

/**
 * 將 TDX 格式航班號（IATA航空代碼 + 數字，如 "BR301"）
 * 轉換為 OpenSky 格式呼號（ICAO航空代碼 + 數字，如 "EVA301"）
 *
 * OpenSky callsign 通常為 8 碼固定寬度並補空白（如 "EVA301  "），
 * 本函式回傳「未補空白」的邏輯呼號，比對時建議雙方皆先 trim + 轉大寫
 *
 * param tdxFlightNumber TDX 航班號，如 "BR301"
 * returns 轉換後的 OpenSky 呼號，如 "EVA301"；無法解析航空代碼時回傳 null
 */
export function tdxFlightNumberToCallsign(tdxFlightNumber: string): string | null {
  const trimmed = tdxFlightNumber.trim().toUpperCase();
  const match = trimmed.match(/^([A-Z]{2})(\d+)$/);
  if (!match) return null;

  const iataAirline = match[1];
  const flightDigits = match[2];
  if (!iataAirline || !flightDigits) return null;

  const icaoAirline = iataToIcaoAirline(iataAirline);
  if (!icaoAirline) return null;

  return `${icaoAirline}${flightDigits}`;
}

export function callsignToTdxFlightNumber(callsign: string): string | null {
  const trimmed = callsign.trim().toUpperCase();
  const match = trimmed.match(/^([A-Z]{3})(\d+)$/);
  if (!match) return null;

  const icaoAirline = match[1];
  const flightDigits = match[2];
  if (!icaoAirline || !flightDigits) return null;

  const iataAirline = icaoToIataAirline(icaoAirline);
  if (!iataAirline) return null;

  return `${iataAirline}${flightDigits}`;
}