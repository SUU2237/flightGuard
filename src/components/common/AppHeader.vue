<!-- src/components/common/AppHeader.vue -->
<script setup lang="ts">
/**
 * 頂部標頭元件
 * 顯示系統主標題與副標題，作為全站共用 Layout Header，
 * sticky 定位，滾動時固定顯示於頁面頂部
 */
</script>

<template>
  <header
    class="sticky top-0 z-1300 w-full bg-linear-to-r from-blue-700 via-blue-600 to-sky-500 shadow-md"
  >
    <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
      <div class="flex items-baseline gap-2">
        <h1 class="flex items-center gap-2 text-xl   text-white md:text-2xl">
          <img src="/src/assets/airport_icon.png" class="h-6 w-6 brightness-0 invert" alt="Airport Icon" />
          <span>FlightGuard</span>
        </h1>
        <span class="hidden text-xs font-medium text-blue-100 sm:inline">
          航空即時動態與不便險監控
        </span>
      </div>
    </div>
  </header>
</template>