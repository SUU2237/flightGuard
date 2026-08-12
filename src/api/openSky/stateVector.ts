// src/api/openSky/stateVector.ts

import axios from 'axios';
import type { OpenSkyStateVector } from '@/types';

/**
 * OpenSky Network REST API 基礎網址
 */
const OPEN_SKY_BASE_URL = 'https://opensky-network.org/api';

/**
 * OpenSky /states/all 回傳格式
 * states 為陣列的陣列，每個內層陣列依固定索引順序代表不同飛行狀態欄位
 * 詳見官方文件：https://openskynetwork.github.io/opensky-api/rest.html
 */
interface OpenSkyStatesResponse {
  /** 伺服器產生此資料的 Unix 時間戳（秒） */
  time: number;
  /** 狀態向量原始陣列清單，單一飛機可能無資料而為 null */
  states: OpenSkyRawStateArray[] | null;
}

/**
 * OpenSky 單一飛機狀態向量原始陣列型別
 * 索引對應：
 * 0: icao24, 1: callsign, 2: origin_country, 3: time_position, 4: last_contact,
 * 5: longitude, 6: latitude, 7: baro_altitude, 8: on_ground, 9: velocity,
 * 10: true_track, 11: vertical_rate, 12: sensors, 13: geo_altitude,
 * 14: squawk, 15: spi, 16: position_source
 */
type OpenSkyRawStateArray = [
  string, // 0 icao24
  string | null, // 1 callsign
  string, // 2 origin_country
  number | null, // 3 time_position
  number, // 4 last_contact
  number | null, // 5 longitude
  number | null, // 6 latitude
  number | null, // 7 baro_altitude
  boolean, // 8 on_ground
  number | null, // 9 velocity
  number | null, // 10 true_track
  number | null, // 11 vertical_rate
  number[] | null, // 12 sensors
  number | null, // 13 geo_altitude
  string | null, // 14 squawk
  boolean, // 15 spi
  number, // 16 position_source
];

/**
 * 將 OpenSky 原始狀態陣列轉換為專案內部使用的 OpenSkyStateVector 物件結構
 *
 * @param raw OpenSky 單一飛機原始狀態陣列
 * @returns 轉換後的 OpenSkyStateVector 物件
 */
function mapStateVector(raw: OpenSkyRawStateArray): OpenSkyStateVector {
  return {
    icao24: raw[0],
    callsign: raw[1] ? raw[1].trim() : null,
    originCountry: raw[2],
    timePosition: raw[3],
    lastContact: raw[4],
    longitude: raw[5],
    latitude: raw[6],
    baroAltitude: raw[7],
    onGround: raw[8],
    velocity: raw[9],
    trueTrack: raw[10],
    verticalRate: raw[11],
    geoAltitude: raw[13],
    squawk: raw[14],
  };
}

/**
 * 呼叫 OpenSky Network API 取得目前全球（或指定範圍）飛機狀態向量
 *
 * 注意：OpenSky 使用 ICAO24 位址識別飛機，callsign 對應航班呼號，
 * 與 TDX 慣用的 IATA 航班號需經 utils/codeMapper.ts 轉換比對後才能對應同一航班
 *
 * @param icao24List 選填，指定要查詢的飛機 ICAO24 位址清單，不帶則查詢全部
 * @returns 轉換後的狀態向量清單
 */
export async function getAllStateVectors(
  icao24List?: string[],
): Promise<OpenSkyStateVector[]> {
  try {
    const response = await axios.get<OpenSkyStatesResponse>(
      `${OPEN_SKY_BASE_URL}/states/all`,
      {
        params: icao24List?.length ? { icao24: icao24List } : undefined,
        paramsSerializer: {
          indexes: null,
        },
        timeout: 15000,
      },
    );

    // 修正：印出 OpenSky 原始回應，確認 states 陣列筆數與資料格式是否符合預期
    console.log('[OpenSky] 原始回應時間戳:', response.data.time, '飛機總筆數:', response.data.states?.length ?? 0);

    if (!response.data.states) {
      console.warn('[OpenSky] states 為 null，可能該時段全球無資料或查詢範圍內無飛機');
      return [];
    }

    return response.data.states.map(mapStateVector);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 429) {
        console.error('[OpenSky] 請求過於頻繁被限流 (429 Rate Limit)，請降低查詢頻率或改用登入帳號提高額度');
      } else if (err.code === 'ECONNABORTED' || !err.response) {
        // 修正：逾時 (ECONNABORTED) 或完全無 response（純網路異常，如斷線、CORS 阻擋）皆歸類於此
        console.error('[useFlightTracking] OpenSky 請求逾時或網路異常:', err.message);
      } else {
        console.error('[OpenSky] API 請求失敗，狀態碼:', err.response?.status, '訊息:', err.message);
      }
    } else {
      console.error('[OpenSky] 發生非預期錯誤:', err);
    }
    return [];
  }
}

/**
 * 依 callsign（航班呼號）於全量狀態向量中查找對應飛機
 * 供 composables/useFlightTracking.ts 比對特定航班是否正在空中飛行使用
 *
 * @param callsign 欲查找的呼號（通常對應 ICAO 航空公司代碼 + 航班數字），比對時忽略大小寫與前後空白
 * @returns 找到則回傳該飛機狀態向量，否則回傳 undefined
 */
/**
 * 依 callsign（航班呼號）於全量狀態向量中查找對應飛機
 *
 * @param callsign 欲查找的呼號（ICAO 航空代碼 + 航班數字，如 "EVA271"）
 */
export async function findStateVectorByCallsign(
  callsign: string,
): Promise<OpenSkyStateVector | undefined> {
  console.log('[OpenSky] 查詢呼號:', callsign);

  const allStates = await getAllStateVectors();
  const target = callsign.trim().toUpperCase();

  const found = allStates.find((state) => state.callsign?.toUpperCase() === target);

  console.log('[OpenSky] 查詢結果:', found ?? '（查無此呼號對應的飛機，可能不在空中或暫無資料）');

  return found;
}