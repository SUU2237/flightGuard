<!-- src/components/fids/FlightList.vue -->
<script setup lang="ts">
/**
 * 航班列表容器元件
 *
 * 負責迴圈渲染 FlightCard
 * 使用者點擊卡片時，向父層 emit "select" 事件並附帶被點擊的航班資料
 */
import type { FidsFlight } from '@/types';
import FlightCard from './FlightCard.vue';

withDefaults(
  //接受父層傳來的 props
  defineProps<{
    /** 航班清單資料 */
    flights: FidsFlight[];
    /** 查詢中狀態 */
    isLoading?: boolean;
    /** 查詢錯誤訊息，無錯誤時為 null */
    error?: string | null;
  }>(),
  {
    isLoading: false,
    error: null,
  },
);

const emit = defineEmits<{
  /** 使用者點擊清單中某張航班卡片 */
  select: [flight: FidsFlight];
}>();

function handleSelect(flight: FidsFlight): void {
  emit('select', flight);
}
</script>

<template>
  <div class="w-full">
    <!-- Loading 骨架屏 -->
    <div v-if="isLoading" class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="n in 6"
        :key="n"
        class="animate-pulse rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div class="flex items-start justify-between">
          <div class="space-y-2">
            <div class="h-3 w-20 rounded bg-gray-200" />
            <div class="h-5 w-24 rounded bg-gray-200" />
          </div>
          <div class="h-6 w-12 rounded-full bg-gray-200" />
        </div>
        <div class="mt-4 flex justify-between">
          <div class="h-8 w-24 rounded bg-gray-200" />
          <div class="h-8 w-24 rounded bg-gray-200" />
        </div>
        <div class="mt-4 h-8 w-full rounded bg-gray-100" />
      </div>
    </div>

    <!-- Error 錯誤提示 -->
    <div
      v-else-if="error"
      class="flex flex-col items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-6 py-10 text-center"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-red-400" viewBox="0 0 20 20" fill="currentColor">
        <path
          fill-rule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
          clip-rule="evenodd"
        />
      </svg>
      <p class="font-medium text-red-600">查詢發生錯誤</p>
      <p class="text-sm text-red-400">{{ error }}</p>
    </div>

    <!-- Empty State：查無結果 -->
    <div
      v-else-if="flights.length === 0"
      class="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-6 py-16 text-center"
    >
      <p class="font-medium text-gray-500">尚無符合條件的航班</p>
      <p class="text-sm text-gray-400">請調整搜尋條件後重新查詢</p>
    </div>

    <!-- 正常情況下：航班卡片清單 -->
    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <FlightCard
        v-for="flight in flights"
        :key="`${flight.flightNumber}-${flight.scheduleDepartureTime}`"
        :flight="flight"
        @select="handleSelect"
      />
    </div>
  </div>
</template>