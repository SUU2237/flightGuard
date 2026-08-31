// src/stores/claimWorkspace.ts

import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import { FlightDirection, type FidsFlight, type ClaimItem, type ClaimStatus } from '@/types';
import { checkInsuranceEligibility } from '@/utils/insuranceRule';
import { getFlightId } from '@/utils/flightId';

/** localStorage 儲存 Key（工作台進行中案件） */
const STORAGE_KEY = 'flightguard-claim-workspace';
/** localStorage 儲存 Key（已封存案件，與進行中案件分開儲存，避免混雜） */
const ARCHIVE_STORAGE_KEY = 'flightguard-claim-archive';

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
 * 從 localStorage 讀取先前封存的已結案案件清單
 * 讀取失敗（格式異常、無資料、非瀏覽器環境）一律回傳空陣列，避免噴錯導致頁面白屏
 */
function loadArchiveFromStorage(): ClaimItem[] {
  try {
    const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ClaimItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[claimWorkspace] 讀取本地封存紀錄失敗:', err);
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
  /** 案件清單（追蹤中／待審核／已核付／駁回，皆在此，直到被封存為止） */
  const items = ref<ClaimItem[]>(loadFromStorage());
  /** 已封存案件清單（結案後由 archiveProcessedClaims() 移入，與 items 分開持久化） */
  const archivedClaims = ref<ClaimItem[]>(loadArchiveFromStorage());
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
   * 依「新增筆數」「重複略過筆數」「已結案封存略過筆數」組出對應的 Toast 文案並顯示
   * 三者皆為 0（如呼叫 batchAddFlights([])）時不顯示提示
   * 不含已結案略過時沿用既有文案；只要出現已結案略過，改用組合式文案明確標示原因
   */
  function notifyAddResult(addedCount: number, duplicateCount: number, archivedSkippedCount = 0): void {
    if (addedCount === 0 && duplicateCount === 0 && archivedSkippedCount === 0) return;

    if (archivedSkippedCount === 0) {
      if (addedCount > 0 && duplicateCount === 0) {
        showToast(`已成功加入 ${addedCount} 筆航班`);
      } else if (addedCount === 0 && duplicateCount > 0) {
        showToast('所選航班已在工作台中（已略過重複）');
      } else if (addedCount > 0 && duplicateCount > 0) {
        showToast(`已加入 ${addedCount} 筆航班（${duplicateCount} 筆已存在略過）`);
      }
      return;
    }

    if (addedCount === 0 && duplicateCount === 0) {
      showToast('所選航班皆已結案，無法加入工作台');
      return;
    }

    const parts: string[] = [];
    if (addedCount > 0) parts.push(`已匯入 ${addedCount} 筆`);
    parts.push(`${archivedSkippedCount} 筆已結案略過`);
    if (duplicateCount > 0) parts.push(`${duplicateCount} 筆已存在略過`);
    showToast(parts.join('，'));
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

  // 只要封存清單有變動，就同步寫回 localStorage（與進行中案件分開儲存）
  watch(
    archivedClaims,
    (value) => {
      try {
        localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(value));
      } catch (err) {
        console.error('[claimWorkspace] 寫入本地封存紀錄失敗:', err);
      }
    },
    { deep: true },
  );

  /** 已封存案件的 id 集合，供 O(1) 判斷某航班是否已結案封存 */
  const archivedFlightIds = computed(() => new Set(archivedClaims.value.map((item) => item.id)));

  /** 判斷指定航班 id 是否已封存結案；UI 依此鎖定「加入工作台」相關按鈕 */
  function isArchived(flightId: string): boolean {
    return archivedFlightIds.value.has(flightId);
  }

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

  /** addFlightInternal 的結果：added 實際新增／duplicate 已存在清單中／archived 已封存結案不可再加入 */
  type AddOutcome = 'added' | 'duplicate' | 'archived';

  /**
   * 新增單一航班至工作台的內部實作，回傳新增結果分類供呼叫端統計
   * 依航班目前是否符合不便險理賠資格，自動判定初始狀態為「待審核」或「追蹤中」
   * 若該航班（相同 id）已存在於清單中，則不重複加入；若已封存結案（archivedClaims），一律拒絕再次加入
   */
  function addFlightInternal(flight: FidsFlight): AddOutcome {
    const id = getFlightId(flight);
    if (archivedFlightIds.value.has(id)) return 'archived';
    if (items.value.some((item) => item.id === id)) return 'duplicate';

    items.value.push({
      id,
      flight,
      status: resolveEligible(flight) ? 'pending' : 'watching',
      addedAt: Date.now(),
    });
    return 'added';
  }

  /**
   * 新增單一航班至工作台，並依實際新增/重複/已結案略過結果顯示對應 Toast 文案
   */
  function addFlight(flight: FidsFlight): void {
    const outcome = addFlightInternal(flight);
    notifyAddResult(
      outcome === 'added' ? 1 : 0,
      outcome === 'duplicate' ? 1 : 0,
      outcome === 'archived' ? 1 : 0,
    );
  }

  /**
   * 批次新增多筆航班，內部逐筆呼叫 addFlightInternal，已存在或已封存結案的航班會自動略過達成去重效果
   * 統計本次「實際新增筆數」「重複略過筆數」「已結案略過筆數」，依結果顯示對應 Toast 文案
   */
  function batchAddFlights(flights: FidsFlight[]): void {
    let addedCount = 0;
    let duplicateCount = 0;
    let archivedSkippedCount = 0;

    flights.forEach((flight) => {
      const outcome = addFlightInternal(flight);
      if (outcome === 'added') addedCount++;
      else if (outcome === 'duplicate') duplicateCount++;
      else archivedSkippedCount++;
    });

    notifyAddResult(addedCount, duplicateCount, archivedSkippedCount);
  }

  /**
   * 移除單一案件
   */
  function removeFlight(flightId: string): void {
    items.value = items.value.filter((item) => item.id !== flightId);
  }

  /**
   * 更新指定案件的處理狀態
   * 找到 ID 一樣的理賠單，重新指定他的狀態
   */
  function updateStatus(flightId: string, status: ClaimStatus): void {
    const target = items.value.find((item) => item.id === flightId);
    if (target) {
      target.status = status;
    }
  }

  /**
   * 儲存並整理：將已核付／駁回（已結案）案件移入 archivedClaims 封存並從 items 移除，
   * 追蹤中／待審核案件維持保留在 items，不會被清空或遺失
   * 封存後的航班會被 addFlightInternal 的防呆邏輯擋下，無法再次加入工作台
   */
  function archiveProcessedClaims(): void {
    const processed = items.value.filter((item) => item.status === 'approved' || item.status === 'rejected');
    if (processed.length === 0) {
      showToast('目前沒有已結案案件可整理');
      return;
    }

    const confirmed = window.confirm(
      `確定要封存 ${processed.length} 筆已結案案件嗎？封存後會從工作台清單移除，且無法再次加入`,
    );
    if (!confirmed) return;

    archivedClaims.value = [...archivedClaims.value, ...processed];
    items.value = items.value.filter((item) => item.status !== 'approved' && item.status !== 'rejected');
    showToast(`已封存 ${processed.length} 筆案件`);
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

  /** 已封存案件筆數 */
  const archivedCount = computed(() => archivedClaims.value.length);

  return {
    // state
    items,
    archivedClaims,
    isOpen,
    toastMessage,
    // getters
    pendingCount,
    approvedCount,
    rejectedCount,
    totalCount,
    unresolvedCount,
    estimatedTotalAmount,
    archivedCount,
    // actions
    addFlight,
    batchAddFlights,
    removeFlight,
    updateStatus,
    isArchived,
    archiveProcessedClaims,
    openWorkspace,
    closeWorkspace,
    toggleWorkspace,
  };
});
