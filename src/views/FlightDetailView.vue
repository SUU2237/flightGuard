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
import { useInsuranceCheck } from '@/composables/useInsuranceCheck';
import { useFlightTracking } from '@/composables/useFlightTracking';
import { FlightDirection, type FidsFlight } from '@/types';
import { formatToFullDateTime } from '@/utils/dateTime';
import { getTripStatusMeta } from '@/utils/tripStatusMeta';
import InsuranceBadge from '@/components/fids/InsuranceBadge.vue';
import FlightMap from '@/components/map/FlightMap.vue';
import { nextTick, useTemplateRef } from 'vue';

const route = useRoute();
const router = useRouter();
const tdxStore = useTdxBaseDataStore();

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
 *「航空公司代碼」與「航班號數字」分開比對，避免不同公司相同班次號互相渲染錯誤的問題
 */
function parseRouteId(
  id: string,
): { airlineIATA: string; flightDigits: string; dateStr: string } | null {
  // 格式改用 [A-Z0-9]{2} 允許英數混合
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
    // 因為 TDX 的 FlightNumber 欄位僅存純數字（如 "106"），故傳入純數字 parsed.flightDigits 呼叫 API，航空公司代碼留到比對階段再核對
    const [departures, arrivals] = await Promise.all([
      getFidsFlightByNumber(parsed.flightDigits, FlightDirection.Departure),
      getFidsFlightByNumber(parsed.flightDigits, FlightDirection.Arrival),
    ]);
    
    const candidates = [...departures, ...arrivals];

    // 三層精準比對 —— 航空公司代碼 + 航班號數字部分 + 表定出發日期，
    // 徹底排除「不同公司但班次數字剛好相同」互相渲染錯誤的可能性
    const matched = candidates.find((f) => {
      const numericPart = f.flightNumber.replace(/^[A-Z]+/i, '');
      const dateToCompare = f.scheduleDepartureTime || f.scheduleArrivalTime;
      return (
        f.airlineID.toUpperCase() === parsed.airlineIATA &&
        numericPart === parsed.flightDigits &&
        isSameLocalDate(dateToCompare, parsed.dateStr)
      );
    });

    console.log('[FlightDetailView] 路由參數解析:', parsed, '比對結果:', matched);

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

onMounted(() => {
  if (!tdxStore.isInitialized) {
    void tdxStore.initialize();
  }
  void loadFlightDetail();
});

/** 不便險理賠資格判定 */
const { eligibility } = useInsuranceCheck(flight);

/** OpenSky 即時追蹤狀態 */
const { isInAir, flightState, isOutOfRadarCoverage } = useFlightTracking(flight);

// 【診斷】確認 OpenSky 查詢結果是否真的有資料，若 flightState 持續為 null
// 或 airborneStatus 非 IN_AIR，代表該航班目前查無 OpenSky 對應飛機（可能呼號轉換失敗或飛機不在空中）
watch(flightState, (val) => {
  console.debug('[FlightDetailView] flightState 更新:', val);
});

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

/** TripStatus 對應的顯示標籤與樣式 */
const tripStatusMeta = computed(() => (flight.value ? getTripStatusMeta(flight.value.tripStatus) : null));

/**
 * 返回搜尋列表頁面
 * 使用 router.back() 沿用瀏覽器歷史紀錄返回， <keep-alive> 讓先前的搜尋條件與結果將可原樣保留，不會被重新初始化
 */
function goBackToSearch(): void {
  router.back();
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-4 md:p-6">
    <button
      type="button"
      class="mb-4 inline-flex items-center gap-1 text-sm font-medium text-blue-500 hover:underline"
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
            <h1 class="text-2xl font-bold text-gray-800">{{ flight.flightNumber }}</h1>
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

       <div
        v-if="hasDepartureTime || hasArrivalTime"
        class="mt-6 grid grid-cols-1 gap-4"
        :class="hasDepartureTime && hasArrivalTime ? 'sm:grid-cols-2' : 'sm:grid-cols-1'"
      > 
        <!-- 表定/實際時間對照表 -->
      <div
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
      </div>

    <!-- 左：飛行即時數據卡 + 右：不便險理賠資格分析卡 -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <!-- 即時飛行數據卡 -->
      <div class="rounded-2xl bg-white p-6 shadow-md">
        <h2 class="mb-3 text-base font-semibold text-gray-700">即時飛行數據</h2>

        <div v-if="isOutOfRadarCoverage" class="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-600">
          目前航班已飛離陸地接收站範圍，OpenSky 為地面接收站網路，跨洋或偏遠空域可能暫時無法回報即時位置
        </div>
        <div v-else-if="!isInAir" class="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-400">
          僅飛航中的航班顯示即時位置與飛行數據
        </div>

        <!-- 僅飛航中顯示即時數據，其餘一律 "--"-->
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-400">緯度</p>
            <p class="font-medium text-gray-700">
              {{ isInAir && flightState?.latitude !== null ? flightState?.latitude?.toFixed(4) : '--' }}
            </p>
          </div>
          <div class="rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-400">經度</p>
            <p class="font-medium text-gray-700">
              {{ isInAir && flightState?.longitude !== null ? flightState?.longitude?.toFixed(4) : '--' }}
            </p>
          </div>
          <div class="rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-400">速度</p>
            <p class="font-medium text-gray-700">
              {{ isInAir && flightState?.speedKmh !== null ? `${flightState?.speedKmh} km/h` : '--' }}
            </p>
          </div>
          <div class="rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-400">高度</p>
            <p class="font-medium text-gray-700">
              {{ isInAir && flightState?.altitude !== null ? `${flightState?.altitude} m` : '--' }}
            </p>
          </div>
          <div class="col-span-2 rounded-lg bg-gray-50 p-3">
            <p class="text-xs text-gray-400">航向</p>
            <p class="font-medium text-gray-700">
              {{ isInAir && flightState?.heading !== null ? `${flightState?.heading}°` : '--' }}
            </p>
          </div>
        </div>

      </div>

      <!-- 不便險理賠資格分析卡 -->
      <div
        class="flex flex-col rounded-xl border p-4 shadow-sm transition"
        :class="tripStatusMeta?.accentBorderClass"
      >
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-base font-semibold text-gray-800">不便險理賠資格分析</h2>
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
        <div v-if="flight" class="h-125 w-full overflow-hidden rounded-2xl shadow-md">
          <h2 class="sr-only">航線與即時位置</h2>
          <FlightMap ref="flightMapRef" :flight="flight" />
        </div>
    </div>
  </div>
</template>