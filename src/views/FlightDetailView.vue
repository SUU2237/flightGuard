<!-- src/views/FlightDetailView.vue -->
<script setup lang="ts">
/**
 * 航班詳情頁面
 *
 * 接收路由參數 id（格式如 "BR271-20260804"），拆解出航班號與日期，
 * 重新呼叫 FIDS API 查詢對應航班（同時查進站與離站端點，依表定出發日期比對篩選出正確班次）。
 *
 * 頁面展示：航空公司資訊、航班號、起降機場、航廈、表定/實際時間對照表、狀態，
 * 並整合 InsuranceBadge 呈現理賠資格與原因分析；若航班正在飛行中則嵌入 FlightMap 顯示即時軌跡。
 */
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getFidsFlightByNumber } from '@/api/tdx/fids';
import { useTdxBaseDataStore } from '@/stores/tdxBaseData';
import { useFlightCacheStore } from '@/stores/flightCache';
import { useClaimWorkspaceStore } from '@/stores/claimWorkspace';
import { useInsuranceCheck } from '@/composables/useInsuranceCheck';
import { useFlightTracking } from '@/composables/useFlightTracking';
import { FlightDirection, InsuranceReasonType, type FidsFlight } from '@/types';
import { formatToFullDateTime } from '@/utils/dateTime';
import { getTripStatusMeta } from '@/utils/tripStatusMeta';
import { getFlightId } from '@/utils/flightId';
import InsuranceBadge from '@/components/fids/InsuranceBadge.vue';
import FlightMap from '@/components/map/FlightMap.vue';
import { nextTick, useTemplateRef } from 'vue';

const route = useRoute();
const router = useRouter();
const tdxStore = useTdxBaseDataStore();
const flightCacheStore = useFlightCacheStore();
const claimStore = useClaimWorkspaceStore();

/** 查詢中狀態 */
const isLoading = ref(true);
/** 查詢錯誤訊息 */
const error = ref<string | null>(null);
/** 比對成功後的航班資料，查無資料時為 null */
const flight = ref<FidsFlight | null>(null); 
/** FlightMap 元件實例參照，透過其 defineExpose 呼叫內部 Leaflet 地圖的 invalidateSize() */
const flightMapRef = useTemplateRef<InstanceType<typeof FlightMap>>('flightMapRef');
/** 判斷是否有有效的出發時間資料，供時間對照表區塊動態顯示使用 */
const hasDepartureTime = computed(() => Boolean(flight.value?.scheduleDepartureTime));
/** 判斷是否有有效的抵達時間資料，供時間對照表區塊動態顯示使用 */
const hasArrivalTime = computed(() => Boolean(flight.value?.scheduleArrivalTime));

/**
 * 拆解路由參數 id（格式："航班號-YYYYMMDD"）為航班號與日期字串
 * 拆開原因：詳情頁發現記憶體沒快取時，必須親自打 API 向交通部 TDX 重新查資料。
 *「航空公司代碼」與「航班號數字」分開比對，避免不同公司相同班次號互相渲染錯誤的問題
 */
function parseRouteId(
  id: string,
): { airlineIATA: string; flightDigits: string; dateStr: string } | null {
  /**
   * 符合格式回傳id陣列[CI271-20260804, CI, 271, 2026, 08, 04]給match
   * 
   * 格式：
   * 航空公司 IATA 代碼固定為 2 碼， [A-Z0-9]{2} 允許英數混合
   * 航班號數字部分則為 1~4 碼， \d+ 允許 1~4 碼數字
   * 日期部分為 YYYYMMDD，\d{4}\d{2}\d{2}，分別對應年、月、日
  */
  const match = id.match(/^([A-Z0-9]{2})(\d+)-(\d{4})(\d{2})(\d{2})$/i);
  if (!match) return null;

  const airlineIATA = match[1];
  const flightDigits = match[2];
  const year = match[3];
  const month = match[4];
  const day = match[5];

  if (!airlineIATA || !flightDigits || !year || !month || !day) return null;

  return {
    airlineIATA: airlineIATA.toUpperCase(),
    flightDigits,
    dateStr: `${year}-${month}-${day}`,
  };
}

/**
 * 判斷航班的表定出發時間是否落在指定日期（本地時區）
 */
function isSameLocalDate(isoString: string, dateStr: string): boolean {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}` === dateStr;
}

/**
 * 當沒有快取時（例如使用者手動重整網頁或貼網址進來）：
 * 依路由參數重新查詢並比對出正確的單一航班資料
 * 同時查詢離站與進站端點，因無法預先得知該航班原始查詢方向
 */
async function loadFlightDetail(): Promise<void> {
  const idParam = route.params.id as string;
  const parsed = parseRouteId(idParam);

  if (!parsed) {
    error.value = '無效的航班識別碼';
    isLoading.value = false;
    return;
  }

  isLoading.value = true;
  error.value = null;

  try {
    // 航班號（數字）符合的
    const [departures, arrivals] = await Promise.all([
      getFidsFlightByNumber(parsed.flightDigits, FlightDirection.Departure),
      getFidsFlightByNumber(parsed.flightDigits, FlightDirection.Arrival),
    ]);
    
    const candidates = [...departures, ...arrivals];

    // 三層精準比對 —— 航空公司代碼 + 航班號數字部分 + 表定出發日期，
    // 徹底排除「不同公司但班次數字剛好相同」互相渲染錯誤的可能性
    const matched = candidates.find((f) => {
      const airlineRegex = new RegExp(`^${f.airlineID}`, 'i');
      const numericPart = f.flightNumber.replace(airlineRegex, '');
      const dateToCompare = f.scheduleDepartureTime || f.scheduleArrivalTime;
      return (
        f.airlineID.toUpperCase() === parsed.airlineIATA &&
        numericPart === parsed.flightDigits &&
        isSameLocalDate(dateToCompare, parsed.dateStr)
      );
    });

    if (!matched) {
      error.value = '查無此航班資料，可能已過期或航班號有誤';
      flight.value = null;
      return;
    }

    flight.value = matched;

    await nextTick();
    flightMapRef.value?.invalidateMapSize();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '航班資料查詢失敗';
    flight.value = null;
  } finally {
    isLoading.value = false;
  }
}

/**
 * 嘗試從 SearchView 導頁時暫存的資料直接取得航班，命中則跳過 TDX API 呼叫
 * 僅在直接輸入網址或重新整理（暫存不存在）時，才退回呼叫 loadFlightDetail()
 */
async function loadFromCacheOrFetch(): Promise<void> {
  //從當前的網址中，抓出航班專屬的 ID 參數
  const idParam = route.params.id as string;
  const cached = flightCacheStore.consumeFlight(idParam);

  if (cached) {
    flight.value = cached;
    isLoading.value = false;
    error.value = null;

    await nextTick();
    flightMapRef.value?.invalidateMapSize();
    return;
  }

  await loadFlightDetail();
}

onMounted(() => {
  if (!tdxStore.isInitialized) {
    void tdxStore.initialize();
  }
  void loadFromCacheOrFetch();
});

/** 不便險理賠資格判定 */
const { eligibility } = useInsuranceCheck(flight);      //宣告一個名為 eligibility 的常數，並自動把回傳物件裡同名屬性的值塞進去

/** OpenSky 即時追蹤狀態，於此統一呼叫、往下傳給 FlightMap，避免重複發送 OpenSky 請求 */
const { isInAir, hasLivePosition, flightState, routeArc, isLoading: isTrackingLoading, error: trackingError, isOutOfRadarCoverage } =
  useFlightTracking(flight);

/** 航空公司顯示名稱 */
const airlineName = computed(() => {
  if (!flight.value) return '';
  const airline = tdxStore.getAirlineByIATA(flight.value.airlineID);
  return airline ? `${airline.airlineName}（${airline.airlineNameEn}）` : flight.value.airlineID;
});

/** 出發機場顯示名稱 */
const departureAirportName = computed(() => {
  if (!flight.value) return '';
  const airport = tdxStore.getAirportByIATA(flight.value.departureAirportID);
  return airport?.airportName ?? flight.value.departureAirportID;
});

/** 抵達機場顯示名稱 */
const arrivalAirportName = computed(() => {
  if (!flight.value) return '';
  const airport = tdxStore.getAirportByIATA(flight.value.arrivalAirportID);
  return airport?.airportName ?? flight.value.arrivalAirportID;
});

/** 載入 TripStatus 對應的顯示標籤與樣式 */
const tripStatusMeta = computed(() => (flight.value ? getTripStatusMeta(flight.value.tripStatus) : null));

/**
 * 返回搜尋列表頁面
 * 使用 router.back() 沿用瀏覽器歷史紀錄返回， <keep-alive> 讓先前的搜尋條件與結果將可原樣保留，不會被重新初始化
 */
function goBackToSearch(): void {
  router.back();
}

/** 判斷目前檢視的航班是否已存在於理賠工作台中，供按鈕切換為「已加入」樣式 */
const isInWorkspace = computed(() => {
  if (!flight.value) return false;
  const id = getFlightId(flight.value);
  return claimStore.items.some((item) => item.id === id);
});

/** 判斷目前檢視的航班是否已封存結案，已結案航班鎖定「加入理賠工作台」按鈕，不可再次加入 */
const isArchived = computed(() => {
  if (!flight.value) return false;
  return claimStore.isArchived(getFlightId(flight.value));
});

/** 將目前航班加入理賠工作台；已封存結案則不執行，重複加入時 store 內部會自動略過並顯示對應 Toast */
function handleAddToWorkspace(): void {
  if (!flight.value || isArchived.value) return;
  claimStore.addFlight(flight.value);
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-4 md:p-6">
    <button
      type="button"
      class="mb-4 inline-flex items-center gap-1 text-sm font-medium text-blue-500 hover:underline cursor-pointer"
      @click="goBackToSearch"
    >
      ← 返回搜尋列表
    </button>

    <!-- Loading -->
    <div v-if="isLoading" class="animate-pulse rounded-2xl bg-white p-6 shadow-md">
      <div class="h-6 w-40 rounded bg-gray-200" />
      <div class="mt-4 h-4 w-64 rounded bg-gray-200" />
      <div class="mt-8 h-40 w-full rounded bg-gray-100" />
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="flex flex-col items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-6 py-16 text-center"
    >
      <p class="font-medium text-red-600">{{ error }}</p>
      <button
        type="button"
        class="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
        @click="goBackToSearch"
      >
        返回
      </button>
    </div>

    <!-- 航班詳情內容 -->
    <div v-else-if="flight" class="space-y-4">
      <!-- 基本資訊卡 -->
      <div class="rounded-2xl bg-white p-6 shadow-md">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-sm text-gray-400">{{ airlineName }}</p>
            <h1 class="text-2xl font-bold text-gray-800">{{ flight.airlineID }}{{ flight.flightNumber }}</h1>
          </div>
          <span class="rounded-full px-4 py-1.5 text-sm font-medium" :class="tripStatusMeta?.badgeClass">
            {{ tripStatusMeta?.label }}
          </span>
        </div>

        <!-- 起降機場 -->
        <div class="mt-6 flex items-start justify-between rounded-xl bg-gray-50 p-4">
          <div class="flex-1">
            <p class="text-xs text-gray-400">出發</p>
            <p class="text-lg font-semibold text-gray-800">{{ departureAirportName }}</p>
            <p class="mt-0.5 min-h-4 text-xs text-gray-400">
              <template v-if="flight.direction === FlightDirection.Departure && flight.terminal">
                航廈 {{ flight.terminal }}
              </template>
            </p>
          </div>
          <div class="shrink-0 self-center px-4 text-2xl text-gray-300">→</div>
          <div class="flex-1 text-right">
            <p class="text-xs text-gray-400">抵達</p>
            <p class="text-lg font-semibold text-gray-800">{{ arrivalAirportName }}</p>
            <p class="mt-0.5 min-h-4 text-xs text-gray-400">
              <template v-if="flight.direction === FlightDirection.Arrival && flight.terminal">
                航廈 {{ flight.terminal }}
              </template>
            </p>
          </div>
        </div>

        <!-- 表定/實際時間對照表 -->
      <div
        v-if="hasDepartureTime || hasArrivalTime"
        class="mt-6 grid grid-cols-1 gap-4"
        :class="hasDepartureTime && hasArrivalTime ? 'sm:grid-cols-2' : 'sm:grid-cols-1'"
      >
        <!-- 出發時間區塊：僅 scheduleDepartureTime 有值時顯示 -->
        <div v-if="hasDepartureTime" class="grid grid-cols-2 gap-4">
          <div class="rounded-xl border border-gray-100 p-4">
            <p class="text-xs font-medium text-gray-400">表定出發</p>
            <p class="mt-1 text-base font-semibold text-gray-700">
              {{ formatToFullDateTime(flight.scheduleDepartureTime) }}
            </p>
          </div>
          <div class="rounded-xl border border-gray-100 p-4">
            <p class="text-xs font-medium text-gray-400">實際/預計出發</p>
            <p class="mt-1 text-base font-semibold text-gray-700">
              {{ formatToFullDateTime(flight.actualDepartureTime) }}
            </p>
          </div>
        </div>

        <!-- 抵達時間區塊：僅 scheduleArrivalTime 有值時顯示 -->
        <div v-if="hasArrivalTime" class="grid grid-cols-2 gap-4">
          <div class="rounded-xl border border-gray-100 p-4">
            <p class="text-xs font-medium text-gray-400">表定抵達</p>
            <p class="mt-1 text-base font-semibold text-gray-700">
              {{ formatToFullDateTime(flight.scheduleArrivalTime) }}
            </p>
          </div>
          <div class="rounded-xl border border-gray-100 p-4">
            <p class="text-xs font-medium text-gray-400">實際/預計抵達</p>
            <p class="mt-1 text-base font-semibold text-gray-700">
              {{ formatToFullDateTime(flight.actualArrivalTime) }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 左：飛行即時數據卡 + 右：不便險理賠資格分析卡 -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <!-- 即時飛行數據卡 -->
      <div class="rounded-2xl bg-white p-6 shadow-md">
        <h2 class="mb-3 text-base font-semibold text-gray-700">即時飛行數據</h2>

        <div v-if="isOutOfRadarCoverage" class="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-600">
          目前航班已飛離陸地接收站範圍，OpenSky 為地面接收站網路，跨洋或偏遠空域可能暫時無法回報即時位置
        </div>
        <div v-else-if="!hasLivePosition" class="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-400">
          僅飛航中或地面滑行的航班顯示即時位置與飛行數據
        </div>
        <div v-else-if="!isInAir" class="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-600">
          飛機目前於地面滑行，以下為即時位置數據
        </div>

        <!-- 有真實座標（飛行中或地面滑行）才顯示即時數據，其餘一律 "--"-->
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-400">緯度</p>
            <p class="font-medium text-gray-700">
              {{ hasLivePosition && flightState?.latitude !== null ? flightState?.latitude?.toFixed(4) : '--' }}
            </p>
          </div>
          <div class="rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-400">經度</p>
            <p class="font-medium text-gray-700">
              {{ hasLivePosition && flightState?.longitude !== null ? flightState?.longitude?.toFixed(4) : '--' }}
            </p>
          </div>
          <div class="rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-400">速度</p>
            <p class="font-medium text-gray-700">
              {{ hasLivePosition && flightState?.speedKmh !== null ? `${flightState?.speedKmh} km/h` : '--' }}
            </p>
          </div>
          <div class="rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-400">高度</p>
            <p class="font-medium text-gray-700">
              {{ hasLivePosition && flightState?.altitude !== null ? `${flightState?.altitude} m` : '--' }}
            </p>
          </div>
          <div class="col-span-2 rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-400">航向</p>
            <p class="font-medium text-gray-700">
              {{ hasLivePosition && flightState?.heading !== null ? `${flightState?.heading}°` : '--' }}
            </p>
          </div>
        </div>

      </div>

      <!-- 不便險理賠資格分析卡 -->
      <div
        class="flex flex-col rounded-xl border p-4 shadow-sm transition"
        :class="
          eligibility?.reasonType === InsuranceReasonType.Cancelled
            ? 'border-2 border-red-400 bg-red-50/60'
            : eligibility?.reasonType === InsuranceReasonType.DelayOver4Hours
              ? 'border-2 border-amber-400 bg-amber-50/60'
              : 'border-gray-200 bg-white'
        "
      >
        <div class="mb-3 flex items-center justify-between gap-2">
          <h2 class="text-base font-semibold text-gray-800">不便險理賠資格分析</h2>
          <button
            type="button"
            class="shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition"
            :class="
              isInWorkspace || isArchived
                ? 'cursor-not-allowed bg-gray-100 text-gray-400 border border-gray-200'
                : 'cursor-pointer bg-amber-500 text-white hover:bg-amber-600'
            "
            :disabled="isInWorkspace || isArchived"
            @click="handleAddToWorkspace"
          >
            {{ isArchived ? '已結案' : isInWorkspace ? '✓ 已在理賠工作台' : '加入理賠工作台' }}
          </button>
        </div>

        <InsuranceBadge :eligibility="eligibility" />
        <div class="mt-4 flex flex-col gap-2.5 text-sm">
          <div class="flex items-center justify-between rounded-lg border border-gray-200/80 bg-white px-3.5 py-2.5 shadow-xs">
            <span class="text-xs font-medium text-gray-500">判定狀態</span>
            <span class="font-semibold" :class="tripStatusMeta?.accentTextClass">
              {{ tripStatusMeta?.label }}
            </span>
          </div>

          <div class="flex items-center justify-between rounded-lg border border-gray-200/80 bg-white px-3.5 py-2.5 shadow-xs">
            <span class="text-xs font-medium text-gray-500">延誤時間</span>
            <span class="font-medium text-gray-800">
              {{
                eligibility?.delayInfo?.delayMinutes !== null &&
                eligibility?.delayInfo?.delayMinutes !== undefined
                  ? `${eligibility.delayInfo.delayMinutes} 分鐘`
                  : '--'
              }}
            </span>
          </div>

          <div class="flex items-center justify-between rounded-lg border border-gray-200/80 bg-white px-3.5 py-2.5 shadow-xs">
            <span class="shrink-0 text-xs font-medium text-gray-500">理賠門檻</span>
            <span class="text-right text-xs font-medium text-gray-600 sm:text-sm">
              延誤 ≥ 240 分鐘（4 小時）或取消
            </span>
          </div>
        </div>
      </div>
    </div>
      <!-- 即時飛行軌跡地圖 -->
        <div v-if="flight" class="h-125 w-full overflow-hidden rounded-2xl ">
          <h2 class="mb-3 text-base font-semibold text-gray-700">航線與即時位置</h2>
          <FlightMap
            ref="flightMapRef"
            :flight="flight"
            :flight-state="flightState"
            :route-arc="routeArc"
            :is-loading="isTrackingLoading"
            :error="trackingError"
            :is-in-air="isInAir"
            :has-live-position="hasLivePosition"
          />
        </div>
    </div>
  </div>
</template>