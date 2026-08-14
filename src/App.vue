<!-- 修正：新增全站共用 AppHeader，統一置於所有頁面最上方 -->
<script setup lang="ts">
import AppHeader from '@/components/common/AppHeader.vue';
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader />

    <router-view v-slot="{ Component, route }">
      <keep-alive>
        <component :is="Component" v-if="route.meta.keepAlive" :key="route.name" />
      </keep-alive>
      <component :is="Component" v-if="!route.meta.keepAlive" :key="route.name" />
    </router-view>
  </div>
</template>