// src/utils/claimStatusMeta.ts

import type { ClaimStatus } from '@/types';

/**
 * ClaimStatus 對應的顯示標籤與樣式集合
 * 統一「案件狀態 → 顯示」的單一事實來源，比照 utils/tripStatusMeta.ts 的作法
 */
export interface ClaimStatusMeta {
  /** 中文顯示標籤，如「待審核」「已核付」 */
  label: string;
  /** 徽章樣式（背景 + 文字色） */
  badgeClass: string;
}

const CLAIM_STATUS_META: Record<ClaimStatus, ClaimStatusMeta> = {
  watching: { label: '追蹤中', badgeClass: 'bg-blue-50 text-blue-600' },
  pending: { label: '待審核', badgeClass: 'bg-amber-100 text-amber-600' },
  approved: { label: '已核付', badgeClass: 'bg-green-100 text-green-600' },
  rejected: { label: '駁回', badgeClass: 'bg-gray-100 text-gray-500' },
};

/**
 * 依 ClaimStatus 取得對應的顯示標籤與樣式
 */
export function getClaimStatusMeta(status: ClaimStatus): ClaimStatusMeta {
  return CLAIM_STATUS_META[status];
}
