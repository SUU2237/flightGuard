// src/utils/csvExport.ts

/**
 * 逐欄位跳脫 CSV 特殊字元
 * 欄位內容含逗號、雙引號或換行時，以雙引號包裹並將內部雙引號替換為兩個雙引號（標準 CSV 跳脫規則）
 */
function escapeCsvField(field: string): string {
  if (/[",\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/** UTF-8 BOM（Byte Order Mark），加在檔案開頭確保 Excel 開啟時能正確辨識編碼，中文不會顯示為亂碼 */
const UTF8_BOM = '﻿';

/**
 * 將表頭與資料列組合為 CSV 字串並觸發瀏覽器下載
 */
export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(','));
  const csvContent = UTF8_BOM + lines.join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
