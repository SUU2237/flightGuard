<!-- src/views/SearchView.vue -->
<script setup lang="ts">
/**
 * 搜尋與列表主要檢視頁面
 *
 * 版面配置：
 * - 上方：SearchHeader（機場/航空公司/航班號搜尋、進出站切換、查詢範圍切換）
 * - 下方：左側 FlightList（搜尋結果清單）、右側 FlightMap（點擊卡片時聚焦顯示即時位置）
 *
 * onMounted 時呼叫 useTdxBaseDataStore.initialize() 預先載入機場/航空公司全量快取，
 * 確保後續搜尋互動（Array.filter 前端篩選）有資料可用
 */
import { ref, onMounted, shallowRef, onActivated } from 'vue';
import { useRouter } from 'vue-router';
import { useTdxBaseDataStore } from '@/stores/tdxBaseData';
import { useFidsData } from '@/composables/useFidsData';
import SearchHeader from '@/components/search/SearchHeader.vue';
import FlightList from '@/components/fids/FlightList.vue';
import FlightMap from '@/components/map/FlightMap.vue';
import type { FidsFlight } from '@/types';
import { getTodayDateString } from '@/utils/dateTime';

const router = useRouter();
const tdxStore = useTdxBaseDataStore();
const fids = useFidsData();

/** 目前於地圖上聚焦追蹤的航班（點擊卡片後設定） */
const selectedFlight = shallowRef<FidsFlight | null>(null);

/** 是否顯示右側地圖區塊（小螢幕時預設收合，避免版面擁擠） */
const showMapPanel = ref(true);

onMounted(() => {
  // 預先載入 TDX 機場/航空公司全量快取，供搜尋輸入框做前端關鍵字篩選使用
  void tdxStore.initialize();
});

/**
 * 產生航班詳細頁路由用的簡潔識別字串
 * 格式：「航班號-YYYYMMDD」（例如 "BR271-20260804"）
 * 依表定出發時間（本地時區）取得日期，避免使用 ISO 字串直接編碼造成網址出現
 * %3A（冒號）、%2B（加號時區）等特殊符號轉義亂碼
 *
 * @param flight 航班動態資料
 * @returns 簡潔可讀的路由 id 字串
 */
/**
 * 修正：scheduleDepartureTime 對「進站/抵達航班」而言可能為 null/undefined
 * （如蘇萬那普飛桃園的 CI838，其資料以抵達端為主，出發時間欄位可能缺漏），
 * 直接 new Date(undefined) 會產生 Invalid Date，getFullYear() 等方法回傳 NaN，
 * 進而產生形如 "CI838-NaNNaNNaN" 的無效網址。
 *
 * 修正方式：依序 fallback 嘗試多個時間欄位，並在轉換前明確驗證日期有效性，
 * 確保絕不會產出含 NaN 的路由 id。
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
  </div>
</template>