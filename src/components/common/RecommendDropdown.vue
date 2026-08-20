<!-- src/components/common/RecommendDropdown.vue -->
<script setup lang="ts" generic="T">
/**
 * 常見推薦清單下拉選單元件
 *
 * 於使用者 Focus 輸入框但尚未打字時顯示，展示如「常見機場」「常見航空公司」等推薦項目
 */
const props = withDefaults(
  defineProps<{
    /** 推薦項目清單 */
    items: T[];
    /** 小標題文字，如「常見機場」 */
    title?: string;
    /** 取得每個項目主要顯示文字的函式 */
    getLabel: (item: T) => string;
    /** 取得每個項目次要顯示文字的函式（如代碼），可省略 */
    getSubLabel?: (item: T) => string;
    /** 取得每個項目唯一 key 的函式 */
    getKey: (item: T) => string;
  }>(),
  {
    title: '常見推薦',
    getSubLabel: undefined,
  },
);

const emit = defineEmits<{
  /** 使用者點擊某個推薦項目 */
  select: [item: T];
}>();

/**
 * 處理項目點擊
 * 於 template 綁定時使用 @mousedown.prevent，避免點擊瞬間觸發輸入框 blur 導致選單提前收起
 */
function handleSelect(item: T): void {
  emit('select', item);
}
</script>

<template>
  <ul
    class="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
  >
    <li class="px-3 py-1.5 text-xs font-medium text-gray-400">{{ title }}</li>

    <li
      v-for="item in items"
      :key="getKey(item)"
      class="cursor-pointer px-3 py-2 text-sm text-gray-700 transition hover:bg-blue-50"
      @mousedown.prevent="handleSelect(item)"
    >
      <span class="font-medium text-gray-800">{{ getLabel(item) }}</span>
      <span v-if="getSubLabel" class="ml-1 text-gray-400">({{ getSubLabel(item) }})</span>
    </li>

    <li v-if="items.length === 0" class="px-3 py-2 text-sm text-gray-400">尚無推薦項目</li>
  </ul>
</template>