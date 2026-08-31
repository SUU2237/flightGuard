// src/stores/__tests__/claimArchive.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useClaimWorkspaceStore } from '@/stores/claimWorkspace';
import { getFlightId } from '@/utils/flightId';
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

describe('useClaimWorkspaceStore（理賠案件封存與鎖定邏輯）', () => {
  it('archiveProcessedClaims 應僅將 approved/rejected 案件移入 archivedClaims，watching/pending 留在 items', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const store = useClaimWorkspaceStore();

    store.addFlight(buildFlight('101', false)); // watching
    store.addFlight(buildFlight('102', true)); // pending
    store.addFlight(buildFlight('103', true)); // 稍後轉 approved
    store.addFlight(buildFlight('104', true)); // 稍後轉 rejected

    const toApprove = store.items.find((item) => item.flight.flightNumber === '103');
    const toReject = store.items.find((item) => item.flight.flightNumber === '104');
    store.updateStatus(toApprove!.id, 'approved');
    store.updateStatus(toReject!.id, 'rejected');

    store.archiveProcessedClaims();

    expect(confirmSpy).toHaveBeenCalled();
    // 僅剩 watching + pending 兩筆留在 items
    expect(store.items).toHaveLength(2);
    expect(store.items.map((item) => item.flight.flightNumber).sort()).toEqual(['101', '102']);
    // approved + rejected 兩筆移入 archivedClaims
    expect(store.archivedClaims).toHaveLength(2);
    expect(store.archivedClaims.map((item) => item.flight.flightNumber).sort()).toEqual(['103', '104']);
    expect(store.archivedCount).toBe(2);

    confirmSpy.mockRestore();
  });

  it('archiveProcessedClaims 在使用者取消確認對話框時，不應變更任何清單', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const store = useClaimWorkspaceStore();

    store.addFlight(buildFlight('201', true));
    store.updateStatus(store.items[0]!.id, 'approved');

    store.archiveProcessedClaims();

    expect(store.items).toHaveLength(1);
    expect(store.archivedClaims).toHaveLength(0);

    confirmSpy.mockRestore();
  });

  it('archiveProcessedClaims 在沒有已結案案件時應為 no-op，不彈出確認對話框', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const store = useClaimWorkspaceStore();

    store.addFlight(buildFlight('301', false)); // watching，非已結案
    store.archiveProcessedClaims();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(store.items).toHaveLength(1);
    expect(store.archivedClaims).toHaveLength(0);
    expect(store.toastMessage).toContain('沒有已結案案件');

    confirmSpy.mockRestore();
  });

  it('封存後再次 addFlight 同一航班應被拒絕，不會覆蓋或重新產生案件', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const store = useClaimWorkspaceStore();
    const flight = buildFlight('401', true);

    store.addFlight(flight);
    store.updateStatus(store.items[0]!.id, 'approved');
    store.archiveProcessedClaims();

    // 結案並封存後，工作台應已無此航班
    expect(store.items).toHaveLength(0);
    expect(store.isArchived(getFlightId(flight))).toBe(true);

    // 再次加入應被防呆擋下：不會回到 items，也不會產生第二筆封存紀錄
    store.addFlight(flight);
    expect(store.items).toHaveLength(0);
    expect(store.archivedClaims).toHaveLength(1);

    confirmSpy.mockRestore();
  });

  it('batchAddFlights 遇到已封存航班應自動略過，其餘未封存航班仍正常加入', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const store = useClaimWorkspaceStore();
    const archivedFlight = buildFlight('501', true);
    const freshFlight = buildFlight('502', false);

    store.addFlight(archivedFlight);
    store.updateStatus(store.items[0]!.id, 'approved');
    store.archiveProcessedClaims();

    store.batchAddFlights([archivedFlight, freshFlight]);

    expect(store.items).toHaveLength(1);
    expect(store.items[0]?.flight.flightNumber).toBe('502');
    expect(store.toastMessage).toContain('已匯入 1 筆');
    expect(store.toastMessage).toContain('1 筆已結案略過');

    confirmSpy.mockRestore();
  });

  it('batchAddFlights 選取內容皆為已封存航班時，Toast 應提示「所選航班皆已結案」', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const store = useClaimWorkspaceStore();
    const archivedFlight = buildFlight('510', true);

    store.addFlight(archivedFlight);
    store.updateStatus(store.items[0]!.id, 'approved');
    store.archiveProcessedClaims();

    store.batchAddFlights([archivedFlight]);

    expect(store.items).toHaveLength(0);
    expect(store.toastMessage).toContain('所選航班皆已結案');

    confirmSpy.mockRestore();
  });

  it('isArchived 對未封存的航班應回傳 false', () => {
    const store = useClaimWorkspaceStore();
    const flight = buildFlight('601', false);
    store.addFlight(flight);

    expect(store.isArchived(getFlightId(flight))).toBe(false);
  });

  it('archivedClaims 應獨立持久化於 localStorage，重建 store 後仍保留封存紀錄', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const store = useClaimWorkspaceStore();
    const flight = buildFlight('701', true);

    store.addFlight(flight);
    store.updateStatus(store.items[0]!.id, 'approved');
    store.archiveProcessedClaims();

    // watch(..., { deep: true }) 預設為非同步（post-flush），需等待下一個 tick 才會真正寫入 localStorage
    await nextTick();

    // 模擬重新整理頁面：重建乾淨的 Pinia 實例，讓 store 重新從 localStorage 讀取
    setActivePinia(createPinia());
    const rehydratedStore = useClaimWorkspaceStore();

    expect(rehydratedStore.items).toHaveLength(0);
    expect(rehydratedStore.archivedClaims).toHaveLength(1);
    expect(rehydratedStore.isArchived(getFlightId(flight))).toBe(true);

    confirmSpy.mockRestore();
  });
});
