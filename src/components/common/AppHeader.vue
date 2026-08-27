<!-- src/components/common/AppHeader.vue -->
<script setup lang="ts">
/**
 * 頂部標頭元件
 * 顯示系統主標題與副標題，作為全站共用 Layout Header，
 * sticky 定位，滾動時固定顯示於頁面頂部
 *
 * 右上角另提供「理賠工作台」入口按鈕，標註尚未結案（追蹤中 + 待審核）的案件筆數，
 * 點擊即可開關 stores/claimWorkspace.ts 控管的全站工作台面板
 * 加入成功的視覺回饋交由 components/claim/ClaimToast.vue 顯示，此處不再另外處理動態效果
 */
import { useClaimWorkspaceStore } from '@/stores/claimWorkspace';

const claimStore = useClaimWorkspaceStore();
</script>

<template>
  <header
    class="sticky top-0 z-1300 w-full bg-linear-to-r from-blue-700 via-blue-600 to-sky-500 shadow-md"
  >
    <div class=" flex  items-center justify-between px-4 py-3 md:px-6">
      <div class="flex items-baseline gap-2">
        <h1 class="flex items-center gap-2 text-xl   text-white md:text-2xl">
          <img src="/airport_icon.png" class="h-6 w-6 brightness-0 invert" alt="Airport Icon" />
          <span>FlightGuard</span>
        </h1>
        <span class="hidden text-xs font-medium text-blue-100 sm:inline">
          航空即時動態與不便險監控
        </span>
      </div>

      <!-- 理賠工作台入口按鈕 -->
      <button
        type="button"
        class="relative flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/25"
        @click="claimStore.toggleWorkspace"
      >
        <span>理賠工作台</span>
        <span
          v-if="claimStore.unresolvedCount > 0"
          class="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-blue-700"
        >
          {{ claimStore.unresolvedCount }}
        </span>
      </button>
    </div>
  </header>
</template>
