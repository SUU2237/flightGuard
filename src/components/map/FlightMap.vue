<!-- src/components/map/FlightMap.vue -->
<script setup lang="ts">
/**
 * 主地圖元件
 *
 * 使用 Leaflet 載入 OpenStreetMap 底圖，整合：
 * - useMapState：管理地圖中心座標 / 縮放層級 / 目前聚焦航班，並於狀態變動時 flyTo
 * - flightState/routeArc 等 OpenSky 追蹤狀態改由父層 (FlightDetailView) 統一呼叫 useFlightTracking 後以 props 傳入，
 *   避免同一航班在父層與地圖元件各自發送一次 OpenSky 請求造成重複查詢 (429)
 */
import { ref, computed, onMounted, onUnmounted, watch, shallowRef } from 'vue';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMapState } from '@/composables/useMapState';
import { generateGreatCircleArc , getUnwrappedDestLng } from '@/utils/geoUtils';
import { FlightAirborneStatus, type FidsFlight, type FlightState, type AircraftPosition } from '@/types';
import RoutePolyline from './RoutePolyline.vue';
import { getAirportCoordByIATA } from '@/utils/airportCoordLookup';

 /** 由父層 (FlightDetailView) 統一呼叫 useFlightTracking 取得的追蹤狀態*/
const props = defineProps<{
  /** 目前欲追蹤的航班，通常來自 FlightCard 點擊 select 事件所傳入的資料 */
  flight: FidsFlight | null;
  flightState: FlightState | null;
  routeArc: AircraftPosition[];
  isLoading: boolean;
  error: string | null;
  isInAir: boolean;
  hasLivePosition: boolean;
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
const displayRouteArc = computed(() =>
  props.isInAir && props.routeArc.length > 0 ? props.routeArc : staticRouteArc.value,
);

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
  const rotation = heading !== null ? (heading - 90) : 0;
  return L.divIcon({
    className: 'aircraft-marker-icon',
    html: `<div style="transform: rotate(${rotation}deg); font-size: 48px; line-height: 1; color: #2563eb; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">✈\uFE0E</div>`,
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

    //找出兩座機場的「西南角（最小）」跟「東北角（最大）」，拉矩形框
    const bounds = L.latLngBounds([
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ]);
    mapInstance.value.fitBounds(bounds, { padding: [40, 40] });
  }
}

/**
 * 依目前 flightState 更新（或移除）飛機 Marker
 * 只要有真實座標（飛行中或地面滑行皆算）就顯示 Marker，而非只限飛行中
 */
function updateAircraftMarker(): void {
  if (!mapInstance.value) return;

  // 先移除舊的 Marker，避免重複疊加
  if (aircraftMarker.value) {
    mapInstance.value.removeLayer(aircraftMarker.value);
    aircraftMarker.value = null;
  }

  if (!props.hasLivePosition || !props.flightState) {
    return;
  }

  const { latitude, longitude, heading, speedKmh, altitude } = props.flightState;
  if (latitude === null || longitude === null) return;

  aircraftMarker.value = L.marker([latitude, longitude], {
    icon: createAircraftIcon(heading),
  })
    .addTo(mapInstance.value)
    .bindPopup(
      `<strong>${props.flight?.flightNumber ?? ''}</strong><br/>速度：${
        speedKmh ?? '--'
      } km/h<br/>高度：${altitude ?? '--'} m`,
    );
}

onMounted(() => {
  if (!mapContainer.value) return;

  //建立地圖實例：把地圖綁定到 mapContainer 容器，並設定預設中心點與縮放層級
  mapInstance.value = L.map(mapContainer.value, {
    center: [center.value.lat, center.value.lng],
    zoom: zoom.value,
    zoomControl: true,
  });

  //載入 OpenStreetMap 圖資底圖，並加進剛剛的地圖實例中
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(mapInstance.value);

  updateAirportMarkers();
  //延遲地圖尺寸刷新，等整個畫面的寬高全部確定後再呼叫
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
    updateAirportMarkers();
  },
  { immediate: true },
);

// flightState 由父層 useFlightTracking 統一查詢並傳入，這裡只負責依資料更新地圖標記
watch(
  () => props.flightState,
  () => {
    updateAircraftMarker();
  },
);

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
      <p v-if="props.isLoading" class="text-gray-500">正在查詢即時位置...</p>
      <p v-else-if="props.error" class="text-red-500">{{ props.error }}</p>
      <p v-else-if="props.isInAir" class="font-medium text-blue-600">✈ 飛航中</p>
      <p v-else-if="props.flightState?.airborneStatus === FlightAirborneStatus.OnGround" class="font-medium text-amber-600">
        🛬 地面滑行中
      </p>
      <p v-else class="text-gray-400">
        {{
          props.flightState?.airborneStatus === 'NOT_DEPARTED'
            ? '無即時位置資料，顯示表定航線'
            : props.flightState?.airborneStatus === 'LANDED'
              ? '已抵達，顯示表定航線'
              : '無即時位置資料，顯示表定航線'
        }}
      </p>
    </div>

    <button
      type="button"
      class="absolute right-3 top-3 z-1000 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-md hover:bg-white cursor-pointer"
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