<!-- src/components/map/FlightMap.vue -->
<script setup lang="ts">
/**
 * 主地圖元件
 *
 * 使用 Leaflet 載入 OpenStreetMap 底圖，整合：
 * - useMapState：管理地圖中心座標 / 縮放層級 / 目前聚焦航班，並於狀態變動時 flyTo
 * - useFlightTracking：依目前聚焦航班查詢 OpenSky 即時位置
 */
import { ref, computed, onMounted, onUnmounted, watch, shallowRef } from 'vue';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMapState } from '@/composables/useMapState';
import { useFlightTracking } from '@/composables/useFlightTracking';
import { generateGreatCircleArc , getUnwrappedDestLng } from '@/utils/geoUtils';
import type { FidsFlight } from '@/types';
import RoutePolyline from './RoutePolyline.vue';
import { getAirportCoordByIATA } from '@/utils/airportCoordLookup';

const props = defineProps<{
  /** 目前欲追蹤的航班，通常來自 FlightCard 點擊 select 事件所傳入的資料 */
  flight: FidsFlight | null;
}>();

/** 地圖容器 DOM 參照 */
const mapContainer = ref<HTMLDivElement | null>(null);
/** Leaflet 地圖實例（shallowRef 避免 Vue 對複雜物件進行深層響應式代理） */
const mapInstance = shallowRef<L.Map | null>(null);
/** 目前顯示中的飛機 Marker 圖層實例 */
const aircraftMarker = shallowRef<L.Marker | null>(null);

/** 顯示起降機場 */
const originMarker = shallowRef<L.Marker | null>(null);
const destMarker = shallowRef<L.Marker | null>(null);

/** 地圖視角狀態管理 */
const { center, zoom, resetMapView, setMapFocus } = useMapState();

/** OpenSky 即時追蹤狀態，傳入 props.flight 的響應式參照 */
const flightRef = computed(() => props.flight);
const { flightState, routeArc, isLoading, error, isInAir, trackFlight } =
  useFlightTracking(flightRef);

/** 出發機場座標 */
const originCoord = computed(() => {
  if (!props.flight) return null;
  return getAirportCoordByIATA(props.flight.departureAirportID);
});

/** 抵達機場座標 */
const destCoord = computed(() => {
  if (!props.flight) return null;
  return getAirportCoordByIATA(props.flight.arrivalAirportID);
});


/**
 * 與大圓航線對齊的「unwrap 後抵達機場座標」
 */
const unwrappedDestCoord = computed(() => {
  if (!originCoord.value || !destCoord.value) return null;
  return {
    lat: destCoord.value.lat,
    lng: getUnwrappedDestLng(originCoord.value.lng, destCoord.value.lng),
  };
});

/**
 * 靜態大圓航線（不受飛行狀態影響，只要起訖機場座標皆有效即繪製）
 */
const staticRouteArc = computed(() => {
  if (!originCoord.value || !destCoord.value) return [];
  return generateGreatCircleArc(
    originCoord.value.lat,
    originCoord.value.lng,
    destCoord.value.lat,
    destCoord.value.lng,
  );
});

/** 實際要渲染的航線：飛行中優先用即時追蹤的 routeArc，否則用靜態航線 */
const displayRouteArc = computed(() => (isInAir.value && routeArc.value.length > 0 ? routeArc.value : staticRouteArc.value));

/** 航線顏色 */
const routeColor = '#2563eb';

/** 建立起降機場標示 */
function createAirportIcon(kind: 'origin' | 'dest'): L.DivIcon {
  const color = kind === 'origin' ? '#16a34a' : '#dc2626';
  return L.divIcon({
    className: 'airport-marker-icon',
    html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 2px rgba(0,0,0,0.4);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

/**
 * 建立飛機圖示
 */
function createAircraftIcon(heading: number | null): L.DivIcon {
  const rotation = heading ?? 0;
  return L.divIcon({
    className: 'aircraft-marker-icon',
    html: `<div style="transform: rotate(${rotation}deg); font-size: 24px; line-height: 1;">✈️</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

/** 更新出發／抵達機場 Marker 縮放視角*/
function updateAirportMarkers(): void {
  console.log('[FlightMap] updateAirportMarkers 執行，mapInstance 是否就緒:', Boolean(mapInstance.value));
  if (!mapInstance.value) return;

  if (originMarker.value) {
    mapInstance.value.removeLayer(originMarker.value);
    originMarker.value = null;
  }
  if (destMarker.value) {
    mapInstance.value.removeLayer(destMarker.value);
    destMarker.value = null;
  }

  if (originCoord.value) {
    originMarker.value = L.marker([originCoord.value.lat, originCoord.value.lng], {
      icon: createAirportIcon('origin'),
    })
      .addTo(mapInstance.value)
      .bindPopup(`出發：${props.flight?.departureAirportID ?? ''}`);
  }

  if (unwrappedDestCoord.value) {
    destMarker.value = L.marker([unwrappedDestCoord.value.lat, unwrappedDestCoord.value.lng], {
      icon: createAirportIcon('dest'),
    })
      .addTo(mapInstance.value)
      .bindPopup(`抵達：${props.flight?.arrivalAirportID ?? ''}`);
  }

  if (originCoord.value && unwrappedDestCoord.value) {
    const lats = [originCoord.value.lat, unwrappedDestCoord.value.lat];
    const lngs = [originCoord.value.lng, unwrappedDestCoord.value.lng];

    const bounds = L.latLngBounds([
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ]);
    mapInstance.value.fitBounds(bounds, { padding: [40, 40] });
  }
}

/**
 * 依目前 flightState 更新（或移除）飛機 Marker
 * 僅 isInAir 為 true 且經緯度皆有效時才顯示 Marker
 */
function updateAircraftMarker(): void {
  if (!mapInstance.value) return;

  // 先移除舊的 Marker，避免重複疊加
  if (aircraftMarker.value) {
    mapInstance.value.removeLayer(aircraftMarker.value);
    aircraftMarker.value = null;
  }

  if (
    !isInAir.value ||
    !flightState.value ||
    flightState.value.latitude === null ||
    flightState.value.longitude === null
  ) {
    return;
  }

  const { latitude, longitude, heading } = flightState.value;

  aircraftMarker.value = L.marker([latitude, longitude], {
    icon: createAircraftIcon(heading),
  })
    .addTo(mapInstance.value)
    .bindPopup(
      `<strong>${props.flight?.flightNumber ?? ''}</strong><br/>速度：${
        flightState.value.speedKmh ?? '--'
      } km/h<br/>高度：${flightState.value.altitude ?? '--'} m`,
    );
}

onMounted(() => {
  if (!mapContainer.value) return;

  mapInstance.value = L.map(mapContainer.value, {
    center: [center.value.lat, center.value.lng],
    zoom: zoom.value,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(mapInstance.value);

  updateAirportMarkers();
  setTimeout(() => {
    mapInstance.value?.invalidateSize();
  }, 0);
});

onUnmounted(() => {
  if (aircraftMarker.value && mapInstance.value) mapInstance.value.removeLayer(aircraftMarker.value);
  if (originMarker.value && mapInstance.value) mapInstance.value.removeLayer(originMarker.value);
  if (destMarker.value && mapInstance.value) mapInstance.value.removeLayer(destMarker.value);
  mapInstance.value?.remove();
  mapInstance.value = null;
});

// 地圖視角狀態 (center / zoom) 變動時，呼叫 Leaflet flyTo 做平滑移動
watch([center, zoom], ([newCenter, newZoom]) => {
  mapInstance.value?.flyTo([newCenter.lat, newCenter.lng], newZoom, { animate: true, duration: 1.2 });
});

// 監聽 originCoord / destCoord：座標補齊時強制重繪地標與航線
watch(
  [originCoord, destCoord],
  ([origin, dest]) => {
    console.log('[FlightMap] 出發/抵達座標:', origin, dest);
    updateAirportMarkers();
  },
  { immediate: true },
);

watch(
  () => props.flight,
  () => {
    void trackFlight();
    updateAirportMarkers();
  },
  { immediate: true },
);

watch(flightState, () => {
  updateAircraftMarker();
});

/**
 * 強制刷新 Leaflet 地圖容器尺寸
 */
function invalidateMapSize(): void {
  mapInstance.value?.invalidateSize();
}

defineExpose({
  resetMapView,
  setMapFocus,
  invalidateMapSize,
});

</script>

<template>
  <div class="relative h-full w-full overflow-hidden rounded-xl">
    <div ref="mapContainer" class="h-full w-full" />

    <div
      v-if="props.flight"
      class="absolute left-3 top-3 z-1000 rounded-lg bg-white/95 px-3 py-2 text-xs shadow-md"
    >
      <p v-if="isLoading" class="text-gray-500">正在查詢即時位置...</p>
      <p v-else-if="error" class="text-red-500">{{ error }}</p>
      <p v-else-if="isInAir" class="font-medium text-blue-600">✈ 飛航中</p>
      <p v-else class="text-gray-400">
        {{
          flightState?.airborneStatus === 'NOT_DEPARTED'
            ? '無即時位置資料，顯示表定航線'
            : flightState?.airborneStatus === 'LANDED'
              ? '已抵達，顯示表定航線'
              : '無即時位置資料，顯示表定航線'
        }}
      </p>
    </div>

    <button
      type="button"
      class="absolute right-3 top-3 z-1000 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-md hover:bg-white"
      @click="resetMapView"
    >
      重設視角
    </button>

    <RoutePolyline :map="mapInstance" :points="displayRouteArc" :color="routeColor" />
  </div>
</template>

<style scoped>
:deep(.aircraft-marker-icon),
:deep(.airport-marker-icon) {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>