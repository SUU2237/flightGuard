<!-- src/views/MapView.vue -->
<script setup lang="ts">
/**
 * 獨立地圖檢視頁面
 *
 * 提供頂部導覽列（返回搜尋頁按鈕、重設地圖視角按鈕），
 * 下方載入 FlightMap 全螢幕地圖檢視。此頁面不預先帶入特定航班，
 * 純粹作為地圖總覽用途，供使用者自由瀏覽地圖範圍。
 */
import { ref, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';
import FlightMap from '@/components/map/FlightMap.vue';
import type { FidsFlight } from '@/types';

const router = useRouter();

/** 目前傳入地圖的航班（此頁面預設不帶入特定航班） */
const currentFlight = ref<FidsFlight | null>(null);

/** FlightMap 元件實例參照，用於呼叫其 defineExpose 出的 resetMapView 方法 */
const flightMapRef = useTemplateRef<InstanceType<typeof FlightMap>>('flightMapRef');

/**
 * 返回搜尋頁面
 */
function goBackToSearch(): void {
  void router.push({ name: 'search' });
}

/**
 * 重設地圖視角為預設全台檢視
 * 呼叫子元件 FlightMap 透過 defineExpose 暴露出的 resetMapView 方法
 */
function handleResetView(): void {
  flightMapRef.value?.resetMapView();
}
</script>

<template>
  <div class="flex h-screen flex-col bg-gray-50">
    <!-- 頂部導覽列 -->
    <header class="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-sm md:px-6">
      <button
        type="button"
        class="inline-flex items-center gap-1 text-sm font-medium text-blue-500 hover:underline"
        @click="goBackToSearch"
      >
        ← 返回搜尋頁
      </button>

      <h1 class="text-base font-semibold text-gray-700">航班即時地圖</h1>

      <button
        type="button"
        class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        @click="handleResetView"
      >
        重設地圖視角
      </button>
    </header>

    <!-- 地圖主體 -->
    <div class="flex-1 p-4 md:p-6">
      <FlightMap ref="flightMapRef" :flight="currentFlight" />
    </div>
  </div>
</template>