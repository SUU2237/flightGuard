<!-- src/components/common/RecommendDropdown.vue -->
<script setup lang="ts" generic="T">
/**
 * 常見推薦清單下拉選單元件
 *
 * 於使用者 Focus 輸入框但尚未打字時顯示，展示如「常見機場」「常見航空公司」等推薦項目
 * 容器與項目列骨架由 DropdownList.vue 共用，本元件只負責標題列與空狀態的顯示內容
 */
import DropdownList from '@/components/common/DropdownList.vue';

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
  <DropdownList :items="items" :get-key="getKey" @select="handleSelect">
    <template #header>
      <li class="px-3 py-1.5 text-xs font-medium text-gray-400">{{ title }}</li>
    </template>

    <template #item="{ item }">
      <span class="font-medium text-gray-800">{{ getLabel(item) }}</span>
      <span v-if="getSubLabel" class="ml-1 text-gray-400">({{ getSubLabel(item) }})</span>
    </template>

    <template #empty>
      <li class="px-3 py-2 text-sm text-gray-400">尚無推薦項目</li>
    </template>
  </DropdownList>
</template>
