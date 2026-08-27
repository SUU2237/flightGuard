// src/utils/flightId.ts

import type { FidsFlight } from '@/types';

/**
 * 產生航班在前端使用的唯一識別字串（航班號 + 表定/實際時間）
 * 供 v-for key、批次選取清單、理賠工作台去重等場景共用同一套識別規則，
 * 避免各處各自組字串造成同一航班在不同功能間 id 兜不起來
 */
export function getFlightId(flight: FidsFlight): string {
  const timeKey =
    flight.scheduleDepartureTime ||
    flight.scheduleArrivalTime ||
    flight.actualDepartureTime ||
    flight.actualArrivalTime ||
    '';
  return `${flight.flightNumber}-${timeKey}`;
}
