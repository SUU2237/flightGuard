// src/utils/tripStatusMeta.ts

import { TripStatus } from '@/types';

/**
 * TripStatus 對應的顯示標籤與樣式集合
 * 統一「狀態 → 顯示」的單一事實來源，避免各元件各自用 switch 或字串比對重複判斷一次
 */
export interface TripStatusMeta {
  /** 中文顯示標籤，如「取消」「延誤」 */
  label: string;
  /** 徽章樣式（背景 + 文字色），供列表卡片等處的狀態標籤使用 */
  badgeClass: string;
  /** 強調文字色，僅取消/延誤時使用醒目色，其餘為預設灰色 */
  accentTextClass: string;
  /** 強調外框樣式（外框 + 底色），僅取消/延誤時使用醒目色，供需要高亮整個區塊的場景使用 */
  accentBorderClass: string;
}

const DEFAULT_ACCENT_TEXT_CLASS = 'text-gray-700';
const DEFAULT_ACCENT_BORDER_CLASS = 'border-gray-200 bg-slate-50/50';

const TRIP_STATUS_META: Record<TripStatus, TripStatusMeta> = {
  [TripStatus.Normal]: {
    label: '正常',
    badgeClass: 'bg-green-50 text-green-600',
    accentTextClass: DEFAULT_ACCENT_TEXT_CLASS,
    accentBorderClass: DEFAULT_ACCENT_BORDER_CLASS,
  },
  [TripStatus.TimeChanged]: {
    label: '時間更改',
    badgeClass: 'bg-amber-50 text-amber-600',
    accentTextClass: DEFAULT_ACCENT_TEXT_CLASS,
    accentBorderClass: DEFAULT_ACCENT_BORDER_CLASS,
  },
  [TripStatus.Cancelled]: {
    label: '取消',
    badgeClass: 'bg-red-50 text-red-600',
    accentTextClass: 'text-red-600',
    accentBorderClass: 'border-2 border-red-400 bg-red-50/70',
  },
  [TripStatus.Delayed]: {
    label: '延誤',
    badgeClass: 'bg-amber-50 text-amber-600',
    accentTextClass: 'text-amber-600',
    accentBorderClass: 'border-2 border-amber-400 bg-amber-50/70',
  },
  [TripStatus.Boarding]: {
    label: '登機中',
    badgeClass: 'bg-blue-50 text-blue-600',
    accentTextClass: DEFAULT_ACCENT_TEXT_CLASS,
    accentBorderClass: DEFAULT_ACCENT_BORDER_CLASS,
  },
  [TripStatus.Closed]: {
    label: '艙門關閉',
    badgeClass: 'bg-gray-100 text-gray-500',
    accentTextClass: DEFAULT_ACCENT_TEXT_CLASS,
    accentBorderClass: DEFAULT_ACCENT_BORDER_CLASS,
  },
  [TripStatus.Departed]: {
    label: '已出發',
    badgeClass: 'bg-blue-50 text-blue-600',
    accentTextClass: DEFAULT_ACCENT_TEXT_CLASS,
    accentBorderClass: DEFAULT_ACCENT_BORDER_CLASS,
  },
  [TripStatus.Arrived]: {
    label: '已抵達',
    badgeClass: 'bg-gray-100 text-gray-500',
    accentTextClass: DEFAULT_ACCENT_TEXT_CLASS,
    accentBorderClass: DEFAULT_ACCENT_BORDER_CLASS,
  },
  [TripStatus.Unknown]: {
    label: '狀態未知',
    badgeClass: 'bg-gray-100 text-gray-400',
    accentTextClass: DEFAULT_ACCENT_TEXT_CLASS,
    accentBorderClass: DEFAULT_ACCENT_BORDER_CLASS,
  },
};

/**
 * 依 TripStatus 取得對應的顯示標籤與樣式，未知數值一律退回「狀態未知」
 */
export function getTripStatusMeta(status: TripStatus): TripStatusMeta {
  return TRIP_STATUS_META[status] ?? TRIP_STATUS_META[TripStatus.Unknown];
}
