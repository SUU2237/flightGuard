<!-- src/components/fids/InsuranceBadge.vue -->
<script setup lang="ts">
/**
 * 不便險理賠資格狀態標籤元件
 *
 * 接收 InsuranceEligibility 判定結果物件，依理賠原因分類呈現不同樣式：
 * - 符合取消理賠：醒目紅底 Badge
 * - 符合延誤理賠：醒目黃底 Badge（附帶延誤時間說明）
 * - 未達門檻/不符合：簡約灰底 Badge
 */
import { computed } from 'vue';
import { InsuranceReasonType, type InsuranceEligibility } from '@/types';

const props = defineProps<{
  /** 不便險理賠資格判定結果，尚未計算完成時可傳入 null */
  eligibility: InsuranceEligibility | null;
}>();

/** Badge 樣式，依理賠原因分類決定顏色主題 */
const badgeClass = computed(() => {
  if (!props.eligibility) return 'bg-gray-100 text-gray-400';

  switch (props.eligibility.reasonType) {
    case InsuranceReasonType.Cancelled:
      return 'bg-red-500 text-white shadow-sm';
    case InsuranceReasonType.DelayOver4Hours:
      return 'bg-amber-400 text-white shadow-sm';
    default:
      return 'bg-gray-100 text-gray-500';
  }
});

/** Badge 主標題文字 */
const badgeTitle = computed(() => {
  if (!props.eligibility) return '判定中...';
  return props.eligibility.isEligible ? '✓ 符合理賠' : '不符合理賠';
});
</script>

<template>
  <div class="inline-flex flex-col items-start gap-1">
    <span class="rounded-md px-2.5 py-1 text-xs font-semibold" :class="badgeClass">
      {{ badgeTitle }}
    </span>
    <p v-if="eligibility?.displayMessage" class="text-xs text-gray-400">
      {{ eligibility.displayMessage }}
    </p>
  </div>
</template>