// src/stores/__tests__/claimWorkspace.spec.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useClaimWorkspaceStore } from '@/stores/claimWorkspace';
import { FlightDirection, TripStatus, type FidsFlight } from '@/types';

/**
 * 建立測試用航班物件
 * eligible: true 時以 Cancelled 狀態模擬「符合理賠資格」；false 時以準點模擬「不符合資格」
 */
function buildFlight(flightNumber: string, eligible: boolean): FidsFlight {
  const scheduleDepartureTime = '2026-08-28T10:00:00Z';
  return {
    flightNumber,
    airlineID: 'CI',
    departureAirportID: 'TPE',
    arrivalAirportID: 'NRT',
    scheduleDepartureTime,
    scheduleArrivalTime: '2026-08-28T14:00:00Z',
    actualDepartureTime: eligible ? null : scheduleDepartureTime,
    actualArrivalTime: null,
    tripStatus: eligible ? TripStatus.Cancelled : TripStatus.Normal,
    direction: FlightDirection.Departure,
    gate: null,
    terminal: null,
  };
}

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
});

describe('useClaimWorkspaceStore（理賠工作台狀態機）', () => {
  it('加入不符合理賠資格的航班，初始狀態應為 watching（追蹤中）', () => {
    const store = useClaimWorkspaceStore();
    store.addFlight(buildFlight('791', false));

    expect(store.items).toHaveLength(1);
    expect(store.items[0]?.status).toBe('watching');
  });

  it('加入符合理賠資格的航班（Cancelled），初始狀態應為 pending（待審核）', () => {
    const store = useClaimWorkspaceStore();
    store.addFlight(buildFlight('792', true));

    expect(store.items).toHaveLength(1);
    expect(store.items[0]?.status).toBe('pending');
  });

  it('去重機制：重複加入相同航班（同一 flightId）不應產生第二筆案件', () => {
    const store = useClaimWorkspaceStore();
    const flight = buildFlight('793', false);

    store.addFlight(flight);
    store.addFlight(flight);

    expect(store.items).toHaveLength(1);
    expect(store.toastMessage).toContain('已在工作台中');
  });

  it('batchAddFlights 應正確統計新增筆數與重複略過筆數，並依此去重', () => {
    const store = useClaimWorkspaceStore();
    const flightA = buildFlight('794', false);
    const flightB = buildFlight('795', true);

    store.addFlight(flightA);
    store.batchAddFlights([flightA, flightB]);

    // flightA 已存在（重複略過），flightB 為新增
    expect(store.items).toHaveLength(2);
    expect(store.toastMessage).toContain('已加入 1 筆航班');
    expect(store.toastMessage).toContain('1 筆已存在略過');
  });

  it('estimatedTotalAmount 僅計算 pending + approved 案件金額，watching 與 rejected 不計入', () => {
    const store = useClaimWorkspaceStore();

    store.addFlight(buildFlight('796', false)); // watching，不計入
    store.addFlight(buildFlight('797', true)); // pending，計入
    store.addFlight(buildFlight('798', true)); // 稍後轉為 approved，計入
    store.addFlight(buildFlight('799', true)); // 稍後轉為 rejected，不計入

    const toApprove = store.items.find((item) => item.flight.flightNumber === '798');
    const toReject = store.items.find((item) => item.flight.flightNumber === '799');
    expect(toApprove).toBeDefined();
    expect(toReject).toBeDefined();
    store.updateStatus(toApprove!.id, 'approved');
    store.updateStatus(toReject!.id, 'rejected');

    // pending（797）+ approved（798） = 2 筆 * 5000
    expect(store.estimatedTotalAmount).toBe(10000);
    expect(store.pendingCount).toBe(1);
    expect(store.approvedCount).toBe(1);
    expect(store.rejectedCount).toBe(1);
  });

  it('estimatedTotalAmount 在無 pending/approved 案件時應為 0', () => {
    const store = useClaimWorkspaceStore();
    store.addFlight(buildFlight('800', false));

    expect(store.estimatedTotalAmount).toBe(0);
  });
});
