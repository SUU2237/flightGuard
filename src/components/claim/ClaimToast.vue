<!-- src/components/claim/ClaimToast.vue -->
<script setup lang="ts">
/**
 * 理賠工作台「加入結果」提示 Toast（新增成功 / 重複略過皆會顯示）
 * 顯示內容與 2 秒後自動關閉的時機，統一由 stores/claimWorkspace.ts 的 toastMessage 控制，
 * 掛載於 App.vue 頂層，確保任一頁面呼叫 addFlight / batchAddFlights 後皆能顯示提示
 */
import { useClaimWorkspaceStore } from '@/stores/claimWorkspace';

const claimStore = useClaimWorkspaceStore();
</script>

<template>
  <Transition name="fade">
    <div
      v-if="claimStore.toastMessage"
      class="fixed bottom-24 left-1/2 z-1600 -translate-x-1/2 whitespace-nowrap rounded-full bg-gray-900/95 px-5 py-2.5 text-sm font-medium text-white shadow-xl"
    >
      {{ claimStore.toastMessage }}
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
</style>
