// src/utils/geoUtils.ts

import type { AircraftPosition } from '@/types';

/**
 * 地球平均半徑（公里），用於 Haversine 公式計算
 */
const EARTH_RADIUS_KM = 6371;

/**
 * 角度轉換為弧度(JS三角函數只接受弧度)
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * 弧度轉換為角度
 * Leaflet 地圖吃角度
 */
function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * 使用 Haversine 公式計算地球表面兩點經緯度之間的大圓距離
 *
 * param lat1 起點緯度、lng1 起點經度
 * param lat2 終點緯度、lng2 終點經度
 * returns 兩點間大圓距離，單位：公里
 */
export function calculateHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * 計算跨越 180° 換日線時的「最短經度差」（供橫越太平洋的航綫使用）
 *
 * param lng1 起點經度、lng2 終點經度（-180 ~ 180）
 * returns 修正後的最短經度差（terminal - origin 方向，範圍 -180 ~ 180）
 */
export function calculateShortestLngDelta(lng1: number, lng2: number): number {
  let delta = lng2 - lng1;

  // 經度差超過 180 度，代表繞遠路，需修正為走反方向（跨換日線）的最短路徑
  if (delta > 180) {
    delta -= 360;
  } else if (delta < -180) {
    delta += 360;
  }

  return delta;
}

/**
 * 新增：計算「與起點連續」的終點經度（unwrap 後的座標）
 *
 * 用途：機場 Marker、fitBounds 等所有需要與大圓航線對齊的視覺元素，
 * 都必須使用與 generateGreatCircleArc() 內部相同的連續經度系統，
 * 否則會出現「航線畫到地圖右側，但終點 Marker 卻停在地圖左側」的視覺脫節
 *
 * @param originLng 起點經度（-180 ~ 180）
 * @param destLng 終點經度（-180 ~ 180）
 * @returns 以 originLng 為基準、連續無斷裂的終點經度（可能超出 -180~180 範圍，這是正常且必要的）
 */
export function getUnwrappedDestLng(originLng: number, destLng: number): number {
  const shortestDelta = calculateShortestLngDelta(originLng, destLng);
  return originLng + shortestDelta;
}

/**
 * 國際標準的 Haversine 公式（半正矢公式），計算地球球體上任意兩個經緯度之間的實際球面距離
 * 生成大圓航線的中間曲率點陣列，供地圖繪製連續平滑的航線使用
 *
 * 計算方式：
 * 1. 依據起訖點經度計算「最短經度差」（跨換日線修正），取得實際繪製方向
 * 2. 依總大圓距離動態決定中間點數量（距離越遠，曲率弧度越明顯，取點數應越多）
 * 3. 以球面線性插值 (Slerp) 概念，沿大圓路徑內插各點的經緯度，
 *    確保高緯度長距離航線呈現正確的弧形曲線，而非直線
 *
 * returns 依序排列的座標點陣列（含起點與終點），可直接供 Polyline 繪製使用
 */
export function generateGreatCircleArc(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  pointCount = 50,
): AircraftPosition[] {
  const lat1 = toRadians(originLat);
  const lng1 = toRadians(originLng);
  const lat2 = toRadians(destLat);

  // 依「最短經度差」重新推算終點經度（弧度），確保走太平洋最短路徑而非繞經歐非大陸
  const shortestLngDelta = calculateShortestLngDelta(originLng, destLng);
  const adjustedDestLng = originLng + shortestLngDelta;
  const lng2 = toRadians(adjustedDestLng);

  // 計算起訖點之間的角距離（弧度），用於球面內插分母
  const angularDistance =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2,
      ),
    );

  const now = Date.now();

  // 起訖點角距離趨近於 0（同一點），直接回傳起訖兩點，避免除以 0
  if (angularDistance === 0) {
    return [
      { lat: originLat, lng: originLng, timestamp: now },
      { lat: destLat, lng: destLng, timestamp: now },
    ];
  }

  const points: AircraftPosition[] = [];

  // 以「前一個點」為基準，將本次計算出的經度做 360° 週期性平移，
  // 確保每個點與前一點的經度差距永遠落在 -180°~180° 之間（維持連續性，不跳躍）
  let previousLng: number | null = null;

  for (let i = 0; i <= pointCount; i++) {
    const fraction = i / pointCount;

    const a = Math.sin((1 - fraction) * angularDistance) / Math.sin(angularDistance);
    const b = Math.sin(fraction * angularDistance) / Math.sin(angularDistance);

    const x = a * Math.cos(lat1) * Math.cos(lng1) + b * Math.cos(lat2) * Math.cos(lng2);
    const y = a * Math.cos(lat1) * Math.sin(lng1) + b * Math.cos(lat2) * Math.sin(lng2);
    const z = a * Math.sin(lat1) + b * Math.sin(lat2);

    const interpLat = toDegrees(Math.atan2(z, Math.sqrt(x * x + y * y)));
    let interpLng = toDegrees(Math.atan2(y, x));

    // 與前一個點比較，若經度差距超過 180°，代表 atan2 產生了不連續跳躍，
    // 透過加減 360° 週期性平移，將本次經度拉回與前一點連續的區間
    if (previousLng !== null) {
      while (interpLng - previousLng > 180) interpLng -= 360;
      while (interpLng - previousLng < -180) interpLng += 360;
    }
    previousLng = interpLng;

    points.push({
      lat: interpLat,
      lng: interpLng,
      timestamp: now,
    });
  }

  return points;
}