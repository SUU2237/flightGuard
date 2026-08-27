// src/stores/claimWorkspace.ts

import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import { FlightDirection, type FidsFlight, type ClaimItem, type ClaimStatus } from '@/types';
import { checkInsuranceEligibility } from '@/utils/insuranceRule';
import { getFlightId } from '@/utils/flightId';

/** localStorage 儲存 Key */
const STORAGE_KEY = 'flightguard-claim-workspace';

/** 每筆符合資格案件的預估理賠金額（新台幣元） */
const CLAIM_AMOUNT_PER_ITEM = 5000;

/** 加入結果提示 Toast 自動關閉時間（毫秒） */
const TOAST_DURATION_MS = 2000;

/**
 * 從 localStorage 讀取先前暫存的案件清單
 * 讀取失敗（格式異常、無資料、非瀏覽器環境）一律回傳空陣列，避免噴錯導致頁面白屏
 */
function loadFromStorage(): ClaimItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ClaimItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[claimWorkspace] 讀取本地暫存失敗:', err);
    return [];
  }
}

/**
 * 依查詢方向挑選對應的表定/實際時間，判斷該航班「目前」是否符合不便險理賠資格
 * 邏輯與 composables/useInsuranceCheck.ts 完全一致，供新增案件時判定初始狀態使用
 */
function resolveEligible(flight: FidsFlight): boolean {
  const scheduleTime =
    flight.direction === FlightDirection.Departure ? flight.scheduleDepartureTime : flight.scheduleArrivalTime;
  const actualTime =
    flight.direction === FlightDirection.Departure ? flight.actualDepartureTime : flight.actualArrivalTime;

  return checkInsuranceEligibility(flight.tripStatus, scheduleTime, actualTime).isEligible;
}

/**
 * 理賠待處理工作台 Store
 *
 * 讓使用者將查詢結果 / 理賠特搜清單中的航班加入此清單，統一追蹤理賠案件的處理進度
 * （追蹤中 / 待審核 / 已核付 / 駁回），並整合 localStorage 持久化，重新整理頁面後案件仍會保留
 */
export const useClaimWorkspaceStore = defineStore('claimWorkspace', () => {
  /** 案件清單 */
  const items = ref<ClaimItem[]>(loadFromStorage());
  /** 工作台面板開關狀態，供 AppHeader 按鈕與 ClaimModal 共用（不持久化，重新整理後預設關閉） */
  const isOpen = ref(false);
  /** 加入結果提示文字，null 代表目前無 Toast 顯示中；由 showToast() 統一控制 2 秒後自動清空 */
  const toastMessage = ref<string | null>(null);

  /** Toast 自動關閉計時器，避免連續加入時多個計時器互相搶著清空文字 */
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  /** 顯示指定文字的 Toast 提示，並於 2 秒後自動關閉 */
  function showToast(message: string): void {
    toastMessage.value = message;

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastMessage.value = null;
      toastTimer = null;
    }, TOAST_DURATION_MS);
  }

  /**
   * 依「新增筆數」與「重複略過筆數」組出對應的 Toast 文案並顯示
   * 兩者皆為 0（如呼叫 batchAddFlights([])）時不顯示提示
   */
  function notifyAddResult(addedCount: number, duplicateCount: number): void {
    if (addedCount > 0 && duplicateCount === 0) {
      showToast(`已成功加入 ${addedCount} 筆航班`);
    } else if (addedCount === 0 && duplicateCount > 0) {
      showToast('所選航班已在工作台中（已略過重複）');
    } else if (addedCount > 0 && duplicateCount > 0) {
      showToast(`已加入 ${addedCount} 筆航班（${duplicateCount} 筆已存在略過）`);
    }
  }

  // 只要案件清單有變動，就同步寫回 localStorage
  watch(
    items,
    (value) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch (err) {
        console.error('[claimWorkspace] 寫入本地暫存失敗:', err);
      }
    },
    { deep: true },
  );

  /** 待審核案件筆數 */
  const pendingCount = computed(() => items.value.filter((item) => item.status === 'pending').length);
  /** 已核付案件筆數 */
  const approvedCount = computed(() => items.value.filter((item) => item.status === 'approved').length);
  /** 駁回案件筆數 */
  const rejectedCount = computed(() => items.value.filter((item) => item.status === 'rejected').length);
  /** 案件總筆數 */
  const totalCount = computed(() => items.value.length);
  /** 尚未結案筆數（追蹤中 + 待審核），供 AppHeader Badge 顯示 */
  const unresolvedCount = computed(() => totalCount.value - approvedCount.value - rejectedCount.value);
  /**
   * 預估總理賠金額：待審核（已符合資格，等待審核撥款）與已核付案件，各以 5000 元計算
   * 追蹤中（尚未達門檻）與駁回（已不符資格）案件不計入
   */
  const estimatedTotalAmount = computed(() => (pendingCount.value + approvedCount.value) * CLAIM_AMOUNT_PER_ITEM);

  /**
   * 新增單一航班至工作台的內部實作，回傳是否為實際新增（非重複航班）
   * 依航班目前是否符合不便險理賠資格，自動判定初始狀態為「待審核」或「追蹤中」
   * 若該航班（相同 id）已存在於清單中，則不重複加入
   */
  function addFlightInternal(flight: FidsFlight): boolean {
    const id = getFlightId(flight);
    if (items.value.some((item) => item.id === id)) return false;

    items.value.push({
      id,
      flight,
      status: resolveEligible(flight) ? 'pending' : 'watching',
      addedAt: Date.now(),
    });
    return true;
  }

  /**
   * 新增單一航班至工作台，並依實際新增/重複結果顯示對應 Toast 文案
   */
  function addFlight(flight: FidsFlight): void {
    const added = addFlightInternal(flight);
    notifyAddResult(added ? 1 : 0, added ? 0 : 1);
  }

  /**
   * 批次新增多筆航班，內部逐筆呼叫 addFlightInternal，已存在的航班會自動略過達成去重效果
   * 統計本次「實際新增筆數」與「重複略過筆數」，依結果顯示對應 Toast 文案
   */
  function batchAddFlights(flights: FidsFlight[]): void {
    let addedCount = 0;
    let duplicateCount = 0;

    flights.forEach((flight) => {
      if (addFlightInternal(flight)) {
        addedCount++;
      } else {
        duplicateCount++;
      }
    });

    notifyAddResult(addedCount, duplicateCount);
  }

  /**
   * 移除單一案件
   */
  function removeFlight(flightId: string): void {
    items.value = items.value.filter((item) => item.id !== flightId);
  }

  /**
   * 更新指定案件的處理狀態
   */
  function updateStatus(flightId: string, status: ClaimStatus): void {
    const target = items.value.find((item) => item.id === flightId);
    if (target) {
      target.status = status;
    }
  }

  /**
   * 清空所有案件，附防呆二次確認，避免誤觸清空鍵導致資料全部遺失
   */
  function clearAll(): void {
    if (items.value.length === 0) return;
    const confirmed = window.confirm('確定要清空理賠工作台的所有案件嗎？此動作無法復原');
    if (!confirmed) return;
    items.value = [];
  }

  /** 開啟工作台面板 */
  function openWorkspace(): void {
    isOpen.value = true;
  }

  /** 關閉工作台面板 */
  function closeWorkspace(): void {
    isOpen.value = false;
  }

  /** 切換工作台面板開關 */
  function toggleWorkspace(): void {
    isOpen.value = !isOpen.value;
  }

  return {
    // state
    items,
    isOpen,
    toastMessage,
    // getters
    pendingCount,
    approvedCount,
    rejectedCount,
    totalCount,
    unresolvedCount,
    estimatedTotalAmount,
    // actions
    addFlight,
    batchAddFlights,
    removeFlight,
    updateStatus,
    clearAll,
    openWorkspace,
    closeWorkspace,
    toggleWorkspace,
  };
});
