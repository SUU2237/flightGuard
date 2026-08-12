// src/types/index.ts

/**
 * 型別統一匯出入口
 * 專案內其餘模組（api / composables / stores / components）
 * 一律從此檔案匯入所需型別，不直接指定至個別檔案路徑，
 * 以利未來型別檔案拆分或重新命名時降低影響範圍
 */

export * from './common';
export * from './tdx';
export * from './openSky';
export * from './insurance';