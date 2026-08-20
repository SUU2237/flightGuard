<!-- src/components/common/DropdownList.vue -->
<script setup lang="ts" generic="T">
/**
 * 下拉選單共用骨架元件
 *
 * 只負責渲染固定樣式的容器 <ul>、逐筆 <li> 項目列與空狀態容器，
 * 「項目內容怎麼顯示」「查無結果時顯示什麼」交由呼叫端透過 slot 決定，
 * 讓 FilterDropdown（打字篩選 + 關鍵字高亮）與 RecommendDropdown（常見推薦 + 標題列）
 * 共用同一份容器樣式，不必各自維護一份幾乎相同的 markup
 */
defineProps<{
  /** 要渲染的項目清單 */
  items: T[];
  /** 取得每個項目唯一 key 的函式 */
  getKey: (item: T) => string;
}>();

const emit = defineEmits<{
  /** 使用者點擊某個項目 */
  select: [item: T];
}>();

function handleSelect(item: T): void {
  emit('select', item);
}
</script>

<template>
  <ul
    class="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
  >
    <!-- 選填標頭列，如 RecommendDropdown 的「常見機場」標題 -->
    <slot name="header" />

    <li
      v-for="item in items"
      :key="getKey(item)"
      class="cursor-pointer px-3 py-2 text-sm text-gray-700 transition hover:bg-blue-50"
      @mousedown.prevent="handleSelect(item)"
    >
      <slot name="item" :item="item" />
    </li>

    <!-- 查無項目時的空狀態，內容與樣式交由呼叫端決定 -->
    <slot v-if="items.length === 0" name="empty" />
  </ul>
</template>
