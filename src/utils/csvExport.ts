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
 * 
 * 因為前端不能直接強制把檔案寫入使用者的硬碟，只能在背景偷偷建一個隱藏的超連結 <a>，
 * 設定好 download 屬性，用程式碼呼叫 link.click() 觸發瀏覽器的檔案下載視窗，
 * 最後再把連結拔掉、釋放記憶體。
 */
export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(','));
  const csvContent = UTF8_BOM + lines.join('\r\n');
  //轉成二進位檔案物件（Blob）與虛擬暫存下載連結
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
