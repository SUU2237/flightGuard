// src/api/tdx/__tests__/fids.spec.ts

import { describe, it, expect } from 'vitest';
import { resolveTripStatus, type FidsFlightRaw } from '@/api/tdx/fids';
import { TripStatus } from '@/types';

/** 建立測試用的 FidsFlightRaw 物件，僅覆寫呼叫端關心的欄位 */
function buildRaw(overrides: Partial<FidsFlightRaw> = {}): FidsFlightRaw {
  return {
    FlightNumber: '791',
    AirlineID: 'CI',
    DepartureAirportID: 'TPE',
    ArrivalAirportID: 'NRT',
    ScheduleDepartureTime: null,
    ScheduleArrivalTime: null,
    ActualDepartureTime: null,
    ActualArrivalTime: null,
    TripStatus: TripStatus.Normal,
    DepartureRemark: null,
    ArrivalRemark: null,
    ...overrides,
  };
}

describe('resolveTripStatus（航班狀態解析引擎）', () => {
  it('優先順序 1：DepartureRemark 含英文 CANCELLED 關鍵字，強制覆寫為 Cancelled', () => {
    const raw = buildRaw({ DepartureRemark: 'FLIGHT CANCELLED', TripStatus: TripStatus.Normal });

    expect(resolveTripStatus(raw, null, null)).toBe(TripStatus.Cancelled);
  });

  it('優先順序 1：ArrivalRemark 含中文「取消」關鍵字，強制覆寫為 Cancelled', () => {
    const raw = buildRaw({ ArrivalRemark: '本班機已取消', TripStatus: TripStatus.Boarding });

    expect(resolveTripStatus(raw, null, null)).toBe(TripStatus.Cancelled);
  });

  it('優先順序 1 高於優先順序 2：即使時間差已達 Delayed 門檻，取消 Remark 仍優先勝出', () => {
    const raw = buildRaw({ DepartureRemark: 'CANCELLED', TripStatus: TripStatus.Normal });

    const result = resolveTripStatus(raw, '2026-08-28T10:00:00Z', '2026-08-28T11:00:00Z');

    expect(result).toBe(TripStatus.Cancelled);
  });

  it('優先順序 2：表定與實際時間差 >= 1 分鐘，強制轉為 Delayed（不依賴原始 TripStatus）', () => {
    const raw = buildRaw({ TripStatus: TripStatus.Normal, DepartureRemark: '準時' });

    const result = resolveTripStatus(raw, '2026-08-28T10:00:00Z', '2026-08-28T10:05:00Z');

    expect(result).toBe(TripStatus.Delayed);
  });

  it('優先順序 2 邊界：時間差剛好 1 分鐘即判定為 Delayed', () => {
    const raw = buildRaw();

    const result = resolveTripStatus(raw, '2026-08-28T10:00:00Z', '2026-08-28T10:01:00Z');

    expect(result).toBe(TripStatus.Delayed);
  });

  it('時間差為 0 分鐘（準點）不觸發 Delayed，落入優先順序 3 Remark 比對', () => {
    const raw = buildRaw({ DepartureRemark: 'ON TIME' });

    const result = resolveTripStatus(raw, '2026-08-28T10:00:00Z', '2026-08-28T10:00:00Z');

    expect(result).toBe(TripStatus.Normal);
  });

  it('優先順序 3：Remark 含 DEPARTED / 出發 關鍵字，判定為 Departed', () => {
    const raw = buildRaw({ DepartureRemark: 'DEPARTED', TripStatus: TripStatus.Normal });

    expect(resolveTripStatus(raw, null, null)).toBe(TripStatus.Departed);
  });

  it('優先順序 3：Remark 含中文「抵達」關鍵字，判定為 Departed', () => {
    const raw = buildRaw({ ArrivalRemark: '班機已抵達', TripStatus: TripStatus.Normal });

    expect(resolveTripStatus(raw, null, null)).toBe(TripStatus.Departed);
  });

  it('優先順序 3：Remark 含「準時」關鍵字，判定為 Normal', () => {
    const raw = buildRaw({ ArrivalRemark: '準時' });

    expect(resolveTripStatus(raw, null, null)).toBe(TripStatus.Normal);
  });

  it('優先順序 4：無 Remark、時間無法計算時，降級沿用 TDX 原始 TripStatus', () => {
    const raw = buildRaw({ TripStatus: TripStatus.Boarding });

    const result = resolveTripStatus(raw, null, null);

    expect(result).toBe(TripStatus.Boarding);
  });

  it('優先順序 4：時間資料不完整（僅有表定、無實際時間）時，仍降級沿用原始狀態', () => {
    const raw = buildRaw({ TripStatus: TripStatus.Closed });

    const result = resolveTripStatus(raw, '2026-08-28T10:00:00Z', null);

    expect(result).toBe(TripStatus.Closed);
  });
});
