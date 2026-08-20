<!-- src/views/SearchView.vue -->
<script setup lang="ts">
/**
 * 搜尋與列表主要檢視頁面
 *
 * 版面配置：
 * - 上方：SearchHeader（機場/航空公司/航班號搜尋、進出站切換、查詢範圍切換）
 * - 下方：FlightList（搜尋結果清單）
 *
 * onMounted 時呼叫 useTdxBaseDataStore.initialize() 預先載入機場/航空公司全量快取，
 * 確保後續搜尋互動（Array.filter 前端篩選）有資料可用
 */
import { ref, onMounted, shallowRef, onActivated , computed} from 'vue';
import { useRouter } from 'vue-router';
import { useTdxBaseDataStore } from '@/stores/tdxBaseData';
import { useFidsData } from '@/composables/useFidsData';
import SearchHeader from '@/components/search/SearchHeader.vue';
import FlightList from '@/components/fids/FlightList.vue';
import { FlightDirection, type FidsFlight } from '@/types';
import { getTodayDateString } from '@/utils/dateTime';
import { checkInsuranceEligibility } from '@/utils/insuranceRule';
import FlightCard from '@/components/fids/FlightCard.vue';

const router = useRouter();
const tdxStore = useTdxBaseDataStore();
const fids = useFidsData();

/** 抽屜開關狀態 */
const isInsuranceDrawerOpen = ref(false);

/**
 * 依據班機是進站還是出站，挑選出對應的表定/實際時間，再丟給 checkInsuranceEligibility 函式計算
 * 供 FAB 數字 Badge 與抽屜內容共用同一份計算結果，避免重複邏輯
 */
function getFlightEligibility(flight: FidsFlight) {
  const scheduleTime =
    flight.direction === FlightDirection.Departure
      ? flight.scheduleDepartureTime
      : flight.scheduleArrivalTime;
  const actualTime =
    flight.direction === FlightDirection.Departure
      ? flight.actualDepartureTime
      : flight.actualArrivalTime;

  return checkInsuranceEligibility(flight.tripStatus, scheduleTime, actualTime);
}

/** 響應式計算屬性，只要搜尋清單更新，自動過濾出符合理賠條件的班機 */
const eligibleFlights = computed(() =>
  fids.flightList.value.filter((f) => getFlightEligibility(f).isEligible),
);

/** 符合理賠的航班數量，用於顯示在 FAB 上 */
const eligibleCount = computed(() => eligibleFlights.value.length);

/** 切換右側抽屜開關 */
function toggleInsuranceDrawer(): void {
  isInsuranceDrawerOpen.value = !isInsuranceDrawerOpen.value;
}

/** 抽屜內卡片點擊：關閉抽屜並導航至航班詳情頁 */
function handleDrawerFlightSelect(flight: FidsFlight): void {
  isInsuranceDrawerOpen.value = false;
  handleFlightSelect(flight);
}

/** 目前於地圖上聚焦追蹤的航班（點擊卡片後設定） */
const selectedFlight = shallowRef<FidsFlight | null>(null);

onMounted(() => {
  // 預先載入 TDX 機場/航空公司全量快取，供搜尋輸入框做前端關鍵字篩選使用
  void tdxStore.initialize();
});

/**
 * 產生航班詳細頁路由用的簡潔識別字串
 * 格式：「航班號-YYYYMMDD」（例如 "BR271-20260804"）
 * 依序 fallback 嘗試多個時間欄位，並在轉換前明確驗證日期有效性，確保絕不會產出含 NaN 的路由 id
 *
 * @param flight 航班動態資料
 * @returns 簡潔可讀的路由 id 字串
 */
function buildFlightRouteId(flight: FidsFlight): string {
  // 依序 fallback：表定出發 → 表定抵達 → 實際出發 → 實際抵達
  const targetTimeISO =
    flight.scheduleDepartureTime ||
    flight.scheduleArrivalTime ||
    flight.actualDepartureTime ||
    flight.actualArrivalTime;

  const numericPart = flight.flightNumber.replace(/^[A-Z]+/i, '');
  const fullFlightCode = `${flight.airlineID}${numericPart}`;

  let dateStr: string;

  if (targetTimeISO) {
    const scheduleDate = new Date(targetTimeISO);

    if (!Number.isNaN(scheduleDate.getTime())) {
      const year = scheduleDate.getFullYear();
      const month = String(scheduleDate.getMonth() + 1).padStart(2, '0');
      const day = String(scheduleDate.getDate()).padStart(2, '0');
      dateStr = `${year}${month}${day}`;
    } else {
      // 時間字串存在但解析失敗（格式異常），退回今日日期，避免產出 NaN
      console.warn('[SearchView] 時間欄位解析失敗，退回今日日期:', flight.flightNumber, targetTimeISO);
      dateStr = getTodayDateString().replace(/-/g, '');
    }
  } else {
    // 所有時間欄位皆為空，退回今日日期作為最後防線
    console.warn('[SearchView] 查無任何可用時間欄位，退回今日日期:', flight.flightNumber);
    dateStr = getTodayDateString().replace(/-/g, '');
  }

  return `${fullFlightCode}-${dateStr}`;
}

/**
 * 處理航班卡片點擊事件
 * 同時更新地圖聚焦對象，並導頁至該航班的詳細資訊頁面
 *
 * @param flight 被點擊的航班資料
 */
function handleFlightSelect(flight: FidsFlight): void {
  selectedFlight.value = flight;

  void router.push({
    name: 'flight-detail',
    params: { id: buildFlightRouteId(flight) },
  });
}
</script>

<template>
  <div class="flex min-h-screen flex-col gap-4 bg-gray-50 p-4 md:p-6">
    <SearchHeader :fids="fids" />

    <div class="flex-1">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-base font-semibold text-gray-700">
          查詢結果
          <span v-if="fids.flightList.value.length > 0" class="ml-1 text-sm font-normal text-gray-400">
            （共 {{ fids.flightList.value.length }} 筆）
          </span>
        </h2>
      </div>

      <FlightList
        :flights="fids.flightList.value"
        :is-loading="fids.isLoading.value"
        :error="fids.error.value"
        @select="handleFlightSelect"
      />
    </div>

<!-- 理賠一覽 FAB -->
<button
  type="button"
  class="fixed bottom-6 right-6 z-1350 flex items-center gap-2 rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-amber-600 cursor-pointer"
  @click="toggleInsuranceDrawer"
>
  <span>理賠特搜</span>
  <span
    v-if="eligibleCount > 0"
    class="flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-amber-600"
  >
    {{ eligibleCount }}
  </span>
</button>

<!-- 遮罩層（點擊遮罩可關閉抽屜） -->
<Transition name="fade">
  <div
    v-if="isInsuranceDrawerOpen"
    class="fixed inset-0 z-1450 bg-black/40"
    @click="isInsuranceDrawerOpen = false"
  />
</Transition>

<!-- 右側抽屜 -->
<Transition name="slide">
  <div
    v-if="isInsuranceDrawerOpen"
    class="fixed right-0 top-0 z-1500 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-gray-200 px-5 py-4">
      <h2 class="text-base font-semibold text-gray-800">
        理賠特搜
        <span class="ml-1 text-sm font-normal text-gray-400">（共 {{ eligibleCount }} 筆，點擊查看航班）</span>
      </h2>
      <button
        type="button"
        class="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
        @click="isInsuranceDrawerOpen = false"
      >
        ✕
      </button>
    </div>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto p-4">
      <div v-if="eligibleFlights.length === 0" class="flex flex-col items-center gap-3 px-4 py-16 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M10 1a6 6 0 0 0-6 6v2.586l-.707.707A1 1 0 0 0 4 12h12a1 1 0 0 0 .707-1.707L16 9.586V7a6 6 0 0 0-6-6Zm0 16a2.5 2.5 0 0 1-2.45-2h4.9A2.5 2.5 0 0 1 10 17Z"
            clip-rule="evenodd"
          />
        </svg>
        <p class="font-medium text-gray-500">目前查詢結果中無符合理賠資格的航班</p>
        <p class="text-sm text-gray-400">請先於上方進行搜尋，或調整篩選條件</p>
      </div>

      <div v-else class="space-y-3">
        <FlightCard
          v-for="flight in eligibleFlights"
          :key="`${flight.flightNumber}-${flight.scheduleDepartureTime}`"
          :flight="flight"
          @select="handleDrawerFlightSelect"
        />
      </div>
    </div>
  </div>
</Transition>
  </div>
</template>

<style scoped>
/* 新增：遮罩淡入淡出動畫 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 新增：抽屜由右側滑入滑出動畫 */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>