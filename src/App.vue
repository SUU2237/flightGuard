<!-- src/App.vue -->
<script setup lang="ts">
/**
 * 應用程式根元件
 * 僅負責提供 <router-view> 掛載點；各頁面版面配置（含導覽列等）
 * 皆由各自的 View 元件自行處理，此處保持最小職責
 */
</script>

<!-- 修正：用 <keep-alive> 包住 <router-view>，並透過 route.meta.keepAlive 決定要快取的頁面元件，
     確保 SearchView 離開後（進入 FlightDetailView）狀態不被銷毀，返回時保留原本搜尋結果 -->
<template>
  <router-view v-slot="{ Component, route }">
    <keep-alive>
      <component :is="Component" v-if="route.meta.keepAlive" :key="route.name" />
    </keep-alive>
    <component :is="Component" v-if="!route.meta.keepAlive" :key="route.name" />
  </router-view>
</template>