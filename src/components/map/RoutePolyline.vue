<!-- src/components/map/RoutePolyline.vue -->
<script setup lang="ts">
/**
 * 航線軌跡繪製元件
 *
 * 純粹負責在既有的 Leaflet 地圖實例上繪製一條大圓航線折線 (Polyline)，
 * 不自行建立地圖，需由父層（FlightMap.vue）傳入已初始化的 L.Map 實例。
 * 傳入的座標點陣列變動時會自動重繪；元件卸載時會自動清除圖層，避免記憶體洩漏。
 */
import { watch, onUnmounted, shallowRef } from 'vue';
import * as L from 'leaflet';
import type { AircraftPosition } from '@/types';

const props = withDefaults(
  defineProps<{
    /** 已初始化的 Leaflet 地圖實例，由父元件提供 */
    map: L.Map | null;
    /** 航線座標點陣列（含起訖點與中間曲率點），依規範僅 InAir 狀態才會有值 */
    points: AircraftPosition[];
    /** 航線顏色 */
    color?: string;
    /** 航線線寬 */
    weight?: number;
    /** 航線透明度 (0~1) */
    opacity?: number;
    /** 航線虛線陣列 */
    dashArray?: string;
  }>(),
  {
    color: '#2563eb',
    weight: 3,
    opacity: 0.8,
    dashArray: '8,8',
  },
);

/** 目前繪製於地圖上的 Polyline 圖層實例 */
const polylineLayer = shallowRef<L.Polyline | null>(null);

/**
 * 移除目前的航線圖層（若存在）
 */
function removeLayer(): void {
  if (polylineLayer.value && props.map) {
    props.map.removeLayer(polylineLayer.value);
  }
  polylineLayer.value = null;
}

/**
 * 依目前的 points 與 map 重新繪製航線
 * 座標點不足 2 點時視為無有效航線，僅清除舊圖層
 */
function drawRoute(): void {
  removeLayer();

  if (!props.map || props.points.length < 2) {
    return;
  }

  const latLngs: L.LatLngExpression[] = props.points.map((p) => [p.lat, p.lng]);

  polylineLayer.value = L.polyline(latLngs, {
    color: props.color,
    weight: props.weight,
    opacity: props.opacity,
    dashArray: props.dashArray,
    smoothFactor: 1,
  }).addTo(props.map);
}

// 地圖實例或座標點陣列變動時，重新繪製航線
watch(
  () => [props.map, props.points] as const,
  () => {
    drawRoute();
  },
  { immediate: true, deep: true },
);

onUnmounted(() => {
  removeLayer();
});
</script>

<template>
  <!-- 此元件不渲染任何 DOM，僅操作 Leaflet 地圖圖層 -->
  <div style="display: none" />
</template>