<script setup lang="ts">
import AppHeader from '@/components/common/AppHeader.vue';
import ClaimModal from '@/components/claim/ClaimModal.vue';
import ClaimToast from '@/components/claim/ClaimToast.vue';
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

    <!-- 理賠工作台面板：掛載於全站 Layout 頂層，不受路由切換影響 -->
    <ClaimModal />
    <ClaimToast />
  </div>
</template>