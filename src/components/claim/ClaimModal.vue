<!-- src/components/claim/ClaimModal.vue -->
<script setup lang="ts">
/**
 * 理賠待處理工作台面板（以右側抽屜形式呈現，與理賠特搜抽屜視覺風格一致）
 *
 * 顯示已加入工作台的案件清單，支援依「加入時間」或「表定時間」排序，
 * 以及依狀態篩選（全部／追蹤中／待審核／已結案），並可逐筆核付、駁回、移除
 *
 * 開關狀態由 stores/claimWorkspace.ts 的 isOpen 集中管理（供 AppHeader 按鈕與此元件共用），
 * 本元件掛載於 App.vue 頂層，因此不受路由切換影響，全站皆可開啟
 */
import { ref, computed } from 'vue';
import { useClaimWorkspaceStore } from '@/stores/claimWorkspace';
import { useTdxBaseDataStore } from '@/stores/tdxBaseData';
import { getClaimStatusMeta } from '@/utils/claimStatusMeta';
import { formatToFullDateTime, getTodayDateString } from '@/utils/dateTime';
import { downloadCsv } from '@/utils/csvExport';
import { FlightDirection, type ClaimItem, type ClaimStatus } from '@/types';

const claimStore = useClaimWorkspaceStore();
const tdxStore = useTdxBaseDataStore();

/** 清單排序方式：依加入時間（新到舊），或依航班表定時間發生順序（早到晚） */
type SortMode = 'addedAt' | 'scheduleTime';
const sortMode = ref<SortMode>('addedAt');

/** 狀態篩選：全部 / 追蹤中 / 待審核 / 已結案（已核付 + 駁回皆歸類為已結案） */
type StatusFilter = 'all' | 'watching' | 'pending' | 'closed';
const statusFilter = ref<StatusFilter>('all');

/** 狀態篩選按鈕選項清單 */
const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'watching', label: '追蹤中' },
  { value: 'pending', label: '待審核' },
  { value: 'closed', label: '已結案' },
];

/** 依查詢方向挑選案件的表定時間（出發或抵達），供排序使用 */
function getScheduleTimeISO(item: ClaimItem): string {
  return item.flight.direction === FlightDirection.Departure
    ? item.flight.scheduleDepartureTime
    : item.flight.scheduleArrivalTime;
}

/** 各狀態篩選 Tab 對應的案件筆數，動態顯示於 Tab 標籤旁 */
const filterCounts = computed<Record<StatusFilter, number>>(() => ({
  all: claimStore.totalCount,
  watching: claimStore.items.filter((item) => item.status === 'watching').length,
  pending: claimStore.pendingCount,
  closed: claimStore.approvedCount + claimStore.rejectedCount,
}));

/** 依目前篩選與排序條件計算出最終顯示的案件清單 */
const displayItems = computed(() => {
  const filtered = claimStore.items.filter((item) => {
    if (statusFilter.value === 'all') return true;
    if (statusFilter.value === 'closed') return item.status === 'approved' || item.status === 'rejected';
    return item.status === statusFilter.value;
  });

  const sorted = [...filtered];
  if (sortMode.value === 'addedAt') {
    //依加入時間：新到舊排序（時間戳記大的在前面）
    sorted.sort((a, b) => b.addedAt - a.addedAt);
  } else {
    //依表定時間：早到晚排序（時間戳記小的在前面）
    sorted.sort((a, b) => new Date(getScheduleTimeISO(a)).getTime() - new Date(getScheduleTimeISO(b)).getTime());
  }
  return sorted;
});

/** 更新指定案件狀態的按鈕統一入口 */
function setStatus(item: ClaimItem, status: ClaimStatus): void {
  claimStore.updateStatus(item.id, status);
}

/**
 * 將目前畫面顯示的案件清單（套用篩選/排序後）匯出為 CSV 檔案
 * 機場/航空公司名稱優先取用 tdxBaseData 快取的中文名稱，查無則退回原始 IATA 代碼
 */
function exportCsv(): void {
  const headers = ['航班號', '航空公司', '出發機場', '抵達機場', '表定時間', '狀態', '加入時間'];

  const rows = displayItems.value.map((item) => {
    const airline = tdxStore.getAirlineByIATA(item.flight.airlineID);
    const departureAirport = tdxStore.getAirportByIATA(item.flight.departureAirportID);
    const arrivalAirport = tdxStore.getAirportByIATA(item.flight.arrivalAirportID);

    return [
      `${item.flight.airlineID}${item.flight.flightNumber}`,
      airline?.airlineName ?? item.flight.airlineID,
      departureAirport?.airportName ?? item.flight.departureAirportID,
      arrivalAirport?.airportName ?? item.flight.arrivalAirportID,
      formatToFullDateTime(getScheduleTimeISO(item)),
      getClaimStatusMeta(item.status).label,
      formatToFullDateTime(new Date(item.addedAt).toISOString()),
    ];
  });

  downloadCsv(`理賠工作台_${getTodayDateString().replace(/-/g, '')}.csv`, headers, rows);
}

function close(): void {
  claimStore.closeWorkspace();
}
</script>

<template>
  <!-- 遮罩層（點擊遮罩可關閉面板） -->
  <Transition name="fade">
    <div v-if="claimStore.isOpen" class="fixed inset-0 z-1450 bg-black/40" @click="close" />
  </Transition>

  <!-- 右側抽屜 -->
  <Transition name="slide">
    <div
      v-if="claimStore.isOpen"
      class="fixed right-0 top-0 z-1500 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
    >
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h2 class="text-base font-semibold text-gray-800">理賠工作台</h2>
        <button
          type="button"
          class="cursor-pointer rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          @click="close"
        >
          ✕
        </button>
      </div>

      <!-- 統計摘要：待處理筆數 / 已核付筆數 / 預估總理賠金額 -->
      <div class="grid grid-cols-3 gap-2 border-b border-gray-200 px-5 py-3 text-center">
        <div>
          <p class="text-xs text-gray-400">待審核</p>
          <p class="text-lg font-semibold text-amber-600">{{ claimStore.pendingCount }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-400">已核付</p>
          <p class="text-lg font-semibold text-green-600">{{ claimStore.approvedCount }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-400">預估總理賠金額</p>
          <p class="text-lg font-semibold text-blue-600">
            NT$ {{ claimStore.estimatedTotalAmount.toLocaleString() }}
          </p>
        </div>
      </div>

      <!-- 排序 / 篩選工具列 -->
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-5 py-3">
        <div class="flex flex-wrap items-center gap-1 text-xs">
          <button
            v-for="option in STATUS_FILTER_OPTIONS"
            :key="option.value"
            type="button"
            class="cursor-pointer rounded-full px-2.5 py-1 font-medium transition"
            :class="
              statusFilter === option.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            "
            @click="statusFilter = option.value"
          >
            {{
              statusFilter === option.value ? `${option.label}（${filterCounts[option.value]}筆）` : option.label
            }}
          </button>
        </div>

        <select v-model="sortMode" class="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600">
          <option value="addedAt">依加入時間排序</option>
          <option value="scheduleTime">依表定時間排序</option>
        </select>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto p-4">
        <div v-if="displayItems.length === 0" class="flex flex-col items-center gap-3 px-4 py-16 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-12 w-12 text-gray-300"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M10 1a6 6 0 0 0-6 6v2.586l-.707.707A1 1 0 0 0 4 12h12a1 1 0 0 0 .707-1.707L16 9.586V7a6 6 0 0 0-6-6Zm0 16a2.5 2.5 0 0 1-2.45-2h4.9A2.5 2.5 0 0 1 10 17Z"
              clip-rule="evenodd"
            />
          </svg>
          <p class="font-medium text-gray-500">工作台目前沒有案件</p>
          <p class="text-sm text-gray-400">於查詢結果批次選取，或由理賠特搜清單一鍵匯入</p>
        </div>

        <div v-else class="space-y-3">
          <div v-for="item in displayItems" :key="item.id" class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-gray-800">
                  {{ item.flight.airlineID }}{{ item.flight.flightNumber }}
                </p>
                <p class="truncate text-xs text-gray-400">
                  {{ item.flight.departureAirportID }} → {{ item.flight.arrivalAirportID }}
                </p>
                <p class="text-xs text-gray-400">表定 {{ formatToFullDateTime(getScheduleTimeISO(item)) }}</p>
              </div>
              <span
                class="shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium"
                :class="getClaimStatusMeta(item.status).badgeClass"
              >
                {{ getClaimStatusMeta(item.status).label }}
              </span>
            </div>

            <div class="mt-3 flex items-center justify-end gap-2 border-t border-gray-100 pt-2">
              <button
                type="button"
                class="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium text-green-600 transition hover:bg-green-50"
                @click="setStatus(item, 'approved')"
              >
                核付
              </button>
              <button
                type="button"
                class="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium text-gray-500 transition hover:bg-gray-100"
                @click="setStatus(item, 'rejected')"
              >
                駁回
              </button>
              <button
                type="button"
                class="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50"
                @click="claimStore.removeFlight(item.id)"
              >
                移除
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer：匯出 CSV / 儲存並整理（將已核付/駁回案件封存並移出清單，防呆二次確認於 store.archiveProcessedClaims 內處理） -->
      <div v-if="claimStore.totalCount > 0" class="flex gap-2 border-t border-gray-200 px-5 py-3">
        <button
          type="button"
          class="flex-1 cursor-pointer rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
          @click="exportCsv"
        >
          匯出 CSV
        </button>
        <button
          type="button"
          class="flex-1 cursor-pointer rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-500 transition hover:bg-red-50"
          @click="claimStore.archiveProcessedClaims"
        >
          儲存並整理
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
