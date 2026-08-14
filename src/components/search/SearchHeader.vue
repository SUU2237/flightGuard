<!-- src/components/search/SearchHeader.vue -->
<script setup lang="ts">
/**
 * 搜尋頭部元件
 * 整合機場 / 航空公司 / 航班號三大輸入欄、進出站切換、查詢範圍切換，
 * 並提供各欄位獨立清空按鈕與「全部重設」功能
 */
import { ref, computed } from 'vue';
import { useFidsData } from '@/composables/useFidsData';
import { SearchMode, FlightDirection } from '@/types';
import { getTodayDateString } from '@/utils/dateTime';
import { useTdxBaseDataStore } from '@/stores/tdxBaseData';
/** 由父層 SearchView.vue 傳入，確保與畫面上的 FlightList 共用同一份查詢狀態 */
const props = defineProps<{
  fids: ReturnType<typeof useFidsData>;
}>();

const tdxStore = useTdxBaseDataStore();
const { airport, airline } = props.fids;

/** 查詢範圍切換：today = 今日全天；realtime = 即時/未來航班（不限日期） */
// ✅ 直接與 props.fids 的狀態進行雙向綁定 (Computed)
const scopeMode = computed({
  get: () => props.fids.scopeMode.value,
  set: (val: 'today' | 'realtime') => {
    props.fids.scopeMode.value = val;
  },
});

function setScopeMode(mode: 'today' | 'realtime'): void {
  scopeMode.value = mode; // 會自動寫入 props.fids.scopeMode
}

/** 進出站切換選項 */
const directionOptions = [
  { label: '離站', value: FlightDirection.Departure },
  { label: '進站', value: FlightDirection.Arrival },
];

/** 機場輸入框顯示用提示文字（依國外機場狀態動態調整） */
const airportDirectionHint = computed(() =>
  airport.getDirectionUiHint(props.fids.direction.value),
);

/** 是否顯示機場推薦/篩選下拉選單 */
const showAirportDropdown = computed(
  () => airport.searchMode.value !== SearchMode.Idle,
);

/** 是否顯示航空公司推薦/篩選下拉選單 */
const showAirlineDropdown = computed(
  () => airline.searchMode.value !== SearchMode.Idle,
);

/** 機場下拉選單目前應顯示的清單（推薦清單 or 篩選清單） */
const airportDisplayList = computed(() =>
  airport.searchMode.value === SearchMode.RecommendOpen
    ? airport.recommendedAirports.value
    : airport.filteredAirports.value,
);

/** 航空公司下拉選單目前應顯示的清單（推薦清單 or 篩選清單） */
const airlineDisplayList = computed(() =>
  airline.searchMode.value === SearchMode.RecommendOpen
    ? airline.recommendedAirlines.value
    : airline.filteredAirlines.value,
);

function handleSearch(): void {
  void props.fids.search();
}

function handleResetAll(): void {
  props.fids.resetAllSearch();
  scopeMode.value = 'today';
}
</script>

<template>
  <div class="w-full rounded-2xl bg-white p-4 shadow-md md:p-6">
    <div v-if="tdxStore.isLoading" class="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-600">
      正在載入機場 / 航空公司基礎資料...
    </div>
    <div v-else-if="tdxStore.error" class="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
      基礎資料載入失敗：{{ tdxStore.error }}
      <button type="button" class="ml-2 underline" @click="tdxStore.initialize(true)">重試</button>
    </div>
    <h1 class="mb-6 font-bold text-gray-800 text-2xl text-center">航班與不便險搜尋</h1>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <!-- 機場輸入欄 -->
      <div class="relative">
        <label class="mb-1 block text-sm font-medium text-gray-600">機場</label>
        <div class="relative">
          <input
            type="text"
            :value="airport.keyword.value"
            placeholder="請輸入..."
            class="w-full rounded-lg border border-gray-300 px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            @focus="airport.onFocus"
            @blur="airport.onBlur"
            @input="airport.onInput(($event.target as HTMLInputElement).value)"
          />
          <button
            v-if="airport.keyword.value"
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            @mousedown.prevent="airport.clearAirport"
          >
            ✕
          </button>
        </div>

        <p v-if="airport.isForeignAirport.value" class="mt-1 text-xs text-amber-600">
          {{ airportDirectionHint }}
        </p>

        <!-- 機場下拉選單 -->
        <ul
          v-if="showAirportDropdown"
          class="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          <li
            v-if="airport.searchMode.value === SearchMode.RecommendOpen"
            class="px-3 py-1.5 text-xs font-medium text-gray-400"
          >
            常見機場
          </li>
          <li
            v-for="item in airportDisplayList"
            :key="item.airportIATA"
            class="cursor-pointer px-3 py-2 text-sm hover:bg-blue-50"
            @mousedown.prevent="airport.selectAirport(item)"
          >
            <span class="font-medium text-gray-800">{{ item.airportName }}</span>
            <span class="ml-1 text-gray-400">({{ item.airportIATA }})</span>
          </li>
          <li
            v-if="airport.searchMode.value === SearchMode.FilterTyping && airportDisplayList.length === 0"
            class="px-3 py-2 text-sm text-gray-400"
          >
            查無符合的機場
          </li>
        </ul>
      </div>

      <!-- 航空公司輸入欄 -->
      <div class="relative">
        <label class="mb-1 block text-sm font-medium text-gray-600">航空公司</label>
        <div class="relative">
          <input
            type="text"
            :value="airline.keyword.value"
            placeholder="請輸入..."
            class="w-full rounded-lg border border-gray-300 px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            @focus="airline.onFocus"
            @blur="airline.onBlur"
            @input="airline.onInput(($event.target as HTMLInputElement).value)"
          />
          <button
            v-if="airline.keyword.value"
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            @mousedown.prevent="airline.clearAirline"
          >
            ✕
          </button>
        </div>

        <!-- 航空公司下拉選單 -->
        <ul
          v-if="showAirlineDropdown"
          class="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          <li
            v-if="airline.searchMode.value === SearchMode.RecommendOpen"
            class="px-3 py-1.5 text-xs font-medium text-gray-400"
          >
            常見航空公司
          </li>
          <li
            v-for="item in airlineDisplayList"
            :key="item.airlineIATA"
            class="cursor-pointer px-3 py-2 text-sm hover:bg-blue-50"
            @mousedown.prevent="airline.selectAirline(item)"
          >
            <span class="font-medium text-gray-800">{{ item.airlineName }}</span>
            <span class="ml-1 text-gray-400">({{ item.airlineIATA }})</span>
          </li>
          <li
            v-if="airline.searchMode.value === SearchMode.FilterTyping && airlineDisplayList.length === 0"
            class="px-3 py-2 text-sm text-gray-400"
          >
            查無符合的航空公司
          </li>
        </ul>
      </div>

      <!-- 航班號輸入欄 -->
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-600">航班號</label>
        <div class="relative">
          <input
            type="text"
            v-model="fids.flightNumberKeyword.value"
            placeholder="請輸入..."
            class="w-full rounded-lg border border-gray-300 px-3 py-2 pr-8 text-sm uppercase focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            v-if="fids.flightNumberKeyword.value"
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            @click="fids.clearFlightNumber"
          >
            ✕
          </button>
        </div>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-4">
        <!-- 進出站切換 -->
        <div class="flex rounded-lg bg-gray-100 p-1 text-sm">
          <button
            v-for="opt in directionOptions"
            :key="opt.value"
            type="button"
            class="rounded-md px-3 py-1.5 font-medium transition"
            :class="
              fids.direction.value === opt.value
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            "
            @click="fids.direction.value = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>

        <!-- 查詢範圍切換 -->
        <div class="flex rounded-lg bg-gray-100 p-1 text-sm">
          <button
            type="button"
            class="rounded-md px-3 py-1.5 font-medium transition"
            :class="scopeMode === 'realtime' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
            @click="setScopeMode('realtime')"
          >
            即時/未來航班
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1.5 font-medium transition"
            :class="scopeMode === 'today' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
            @click="setScopeMode('today')"
          >
            今日全天
          </button>
        </div>
      </div>

      <!-- 按鈕群組：手機版水平置中 (justify-center)，電腦版靠右對齊 (lg:justify-end) -->
      <!-- 按鈕群組：置中、等寬 (w-28)、增加頂部間距 (mt-3) -->
      <div class="mt-6 flex w-full items-center justify-center gap-3 lg:mt-0 lg:w-auto lg:justify-end">
        <button
          type="button"
          class="w-20 rounded-lg border border-gray-300 py-2 text-center text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          @click="handleResetAll"
        >
          重設
        </button>
        <button
          type="button"
          class="w-20 rounded-lg bg-blue-600 py-2 text-center text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!fids.canSearch.value || fids.isLoading.value"
          @click="handleSearch"
        >
          {{ fids.isLoading.value ? '查詢中...' : '查詢' }}
        </button>
      </div>
    </div>

    <p v-if="fids.error.value" class="mt-2 text-sm text-red-500">
      {{ fids.error.value }}
    </p>
  </div>
</template>