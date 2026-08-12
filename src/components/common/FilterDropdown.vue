<!-- src/components/common/FilterDropdown.vue -->
<script setup lang="ts" generic="T">
/**
 * 關鍵字篩選結果下拉選單元件
 *
 * 於使用者打字時顯示，展示前端 Array.filter 篩選後的結果清單（限前 30 筆）。
 * 支援關鍵字高亮顯示，並於查無結果時顯示 Empty State 提示。
 * 使用泛型 T 讓元件可同時支援 TdxAirport、TdxAirline 等不同項目型別。
 */
const props = withDefaults(
  defineProps<{
    /** 篩選後的項目清單（已限制筆數，本元件不再另行截斷） */
    items: T[];
    /** 目前使用者輸入的關鍵字，用於高亮顯示比對片段 */
    keyword: string;
    /** 取得每個項目主要顯示文字的函式 */
    getLabel: (item: T) => string;
    /** 取得每個項目次要顯示文字的函式（如代碼），可省略 */
    getSubLabel?: (item: T) => string;
    /** 取得每個項目唯一 key 的函式 */
    getKey: (item: T) => string;
    /** 查無結果時顯示的提示文字 */
    emptyText?: string;
  }>(),
  {
    getSubLabel: undefined,
    emptyText: '查無符合的結果',
  },
);

const emit = defineEmits<{
  /** 使用者點擊某個篩選項目 */
  select: [item: T];
}>();

/**
 * 將關鍵字跳脫特殊正則字元，避免使用者輸入含正則保留字元（如 . * ( )）時比對錯誤
 */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 將顯示文字依關鍵字拆分為片段陣列，供 template 標記高亮部分
 * 回傳格式：{ text: string; matched: boolean }[]
 */
function splitByKeyword(label: string): { text: string; matched: boolean }[] {
  const trimmed = props.keyword.trim();
  if (!trimmed) return [{ text: label, matched: false }];

  const pattern = new RegExp(`(${escapeRegExp(trimmed)})`, 'ig');
  const parts = label.split(pattern);

  return parts
    .filter((part) => part !== '')
    .map((part) => ({
      text: part,
      matched: part.toLowerCase() === trimmed.toLowerCase(),
    }));
}

function handleSelect(item: T): void {
  emit('select', item);
}
</script>

<template>
  <ul
    class="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
  >
    <li
      v-for="item in items"
      :key="getKey(item)"
      class="cursor-pointer px-3 py-2 text-sm text-gray-700 transition hover:bg-blue-50"
      @mousedown.prevent="handleSelect(item)"
    >
      <span class="font-medium text-gray-800">
        <template v-for="(part, idx) in splitByKeyword(getLabel(item))" :key="idx">
          <mark v-if="part.matched" class="rounded bg-yellow-200 px-0.5 text-gray-900">{{
            part.text
          }}</mark>
          <template v-else>{{ part.text }}</template>
        </template>
      </span>
      <span v-if="getSubLabel" class="ml-1 text-gray-400">({{ getSubLabel(item) }})</span>
    </li>

    <!-- Empty State：查無篩選結果 -->
    <li v-if="items.length === 0" class="flex flex-col items-center gap-1 px-3 py-6 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-8 w-8 text-gray-300"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M9 3.5a5.5 5.5 0 1 0 3.61 9.65l3.87 3.87a.75.75 0 1 0 1.06-1.06l-3.87-3.87A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
          clip-rule="evenodd"
        />
      </svg>
      <span class="text-sm text-gray-400">{{ emptyText }}</span>
    </li>
  </ul>
</template>