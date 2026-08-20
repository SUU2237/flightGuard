// src/utils/dateTime.ts

/**
 * 將數字補零至兩位數字串，如 5 -> "05"
 */
function padZero(num: number): string {
  return num.toString().padStart(2, '0');
}

/**
 * 取得今日日期字串，格式為 YYYY-MM-DD
 * 備註：JS 中 Date 物件的月份是從 0 開始計算的，所以要 +1
 */
export function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${padZero(now.getMonth() + 1)}-${padZero(now.getDate())}`;
}

/**
 * 將 ISO 時間字串轉換為 UI 顯示用的時分格式 (2026-07-31T14:35:00+08:00" -> "14:35"）
 */
export function formatToHourMinute(
  isoString: string | null | undefined,
  fallback = '--',
): string {
  if (!isoString) return fallback;

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return fallback;

  return `${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
}

/**
 * 將 ISO 時間字串轉換為 UI 顯示用的完整日期時間格式 (YYYY/MM/DD HH:mm)
 */
export function formatToFullDateTime(
  isoString: string | null | undefined,
  fallback = '--',
): string {
  if (!isoString) return fallback;

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return fallback;

  const dateStr = `${date.getFullYear()}/${padZero(date.getMonth() + 1)}/${padZero(date.getDate())}`;
  const timeStr = `${padZero(date.getHours())}:${padZero(date.getMinutes())}`;

  return `${dateStr} ${timeStr}`;
}

/**
 * 判斷指定 ISO 時間字串是否為「今天」（避免 1 年前的今天也被誤判為今天）
 */
export function isToday(isoString: string | null | undefined): boolean {
  if (!isoString) return false;

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

/**
 * 計算兩個 ISO 時間字串之間的時間差（分鐘）
 * 通用時間差計算工具，與不便險門檻邏輯無關（不便險專用計算請見 utils/insuranceRule.ts）
 */
export function diffInMinutes(
  fromISO: string | null | undefined,
  toISO: string | null | undefined,
): number | null {
  if (!fromISO || !toISO) return null;

  const fromTime = new Date(fromISO).getTime();
  const toTime = new Date(toISO).getTime();

  if (Number.isNaN(fromTime) || Number.isNaN(toTime)) return null;

  return Math.round((toTime - fromTime) / (1000 * 60));
}