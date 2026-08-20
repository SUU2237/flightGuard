<!-- src/components/fids/FlightCard.vue -->
<script setup lang="ts">
/**
 * 單一航班動態卡片元件
 * 展示航空公司、航班號、起降機場、Terminal、TripStatus 狀態、表定/實際時間，
 * 並整合 useInsuranceCheck 顯示不便險理賠資格 Badge
 */
import { computed } from 'vue';
import { useInsuranceCheck } from '@/composables/useInsuranceCheck';
import { useTdxBaseDataStore } from '@/stores/tdxBaseData';
import { TripStatus, InsuranceReasonType, FlightDirection, type FidsFlight } from '@/types';
import { formatToHourMinute } from '@/utils/dateTime';
import InsuranceBadge from '@/components/fids/InsuranceBadge.vue';

const props = defineProps<{
  flight: FidsFlight;
}>();

const emit = defineEmits<{
  select: [flight: FidsFlight];
}>();

const tdxStore = useTdxBaseDataStore();

/** 不便險理賠資格判定（傳入單一航班，非 ref 亦可，內部會自動 unref） */
const { eligibility, isEligible, reasonType, displayMessage } = useInsuranceCheck(props.flight);

/** 航空公司顯示名稱（優先中文名，查無則退回原始 IATA 代碼） */
const airlineName = computed(() => {
  const airline = tdxStore.getAirlineByIATA(props.flight.airlineID);
  return airline?.airlineName || props.flight.airlineID;
});

/** 出發機場顯示名稱 */
const departureAirportName = computed(() => {
  const airport = tdxStore.getAirportByIATA(props.flight.departureAirportID);
  return airport?.airportName ?? props.flight.departureAirportID;
});

/** 抵達機場顯示名稱 */
const arrivalAirportName = computed(() => {
  const airport = tdxStore.getAirportByIATA(props.flight.arrivalAirportID);
  return airport?.airportName ?? props.flight.arrivalAirportID;
});

/** TripStatus 對應的顯示標籤文字與樣式 */
const tripStatusMeta = computed(() => {
  switch (props.flight.tripStatus) {
    case TripStatus.Normal:
      return { label: '正常', class: 'bg-green-50 text-green-600' };
    case TripStatus.TimeChanged:
      return { label: '時間更改', class: 'bg-amber-50 text-amber-600' };
    case TripStatus.Cancelled:
      return { label: '取消', class: 'bg-red-50 text-red-600' };
    case TripStatus.Delayed:
      return { label: '延誤', class: 'bg-amber-50 text-amber-600' };
    case TripStatus.Boarding:
      return { label: '登機中', class: 'bg-blue-50 text-blue-600' };
    case TripStatus.Closed:
      return { label: '艙門關閉', class: 'bg-gray-100 text-gray-500' };
    case TripStatus.Departed:
      return { label: '已出發', class: 'bg-blue-50 text-blue-600' };
    case TripStatus.Arrived:
      return { label: '已抵達', class: 'bg-gray-100 text-gray-500' };
    default:
      return { label: '狀態未知', class: 'bg-gray-100 text-gray-400' };
  }
});

/** 依查詢方向決定卡片主要顯示的表定/實際時間欄位 */
const scheduleTimeLabel = computed(() =>
  props.flight.direction === FlightDirection.Departure ? '表定起飛' : '表定抵達',
);
const scheduleTimeValue = computed(() =>
  props.flight.direction === FlightDirection.Departure
    ? props.flight.scheduleDepartureTime
    : props.flight.scheduleArrivalTime,
);
const actualTimeLabel = computed(() =>
  props.flight.direction === FlightDirection.Departure ? '實際/預計起飛' : '實際/預計抵達',
);
const actualTimeValue = computed(() =>
  props.flight.direction === FlightDirection.Departure
    ? props.flight.actualDepartureTime
    : props.flight.actualArrivalTime,
);

function handleClick(): void {
  emit('select', props.flight);
}
</script>

<template>
  <!-- 取消理賠用紅色系、延誤理賠用黃色系 -->
  <div
    class="flex cursor-pointer flex-col rounded-xl border p-4 shadow-sm transition hover:shadow-md"
    :class="
      reasonType === InsuranceReasonType.Cancelled
        ? 'border-2 border-red-400 bg-red-50/60 hover:border-red-500'
        : reasonType === 'DELAY_OVER_4_HOURS'
          ? 'border-2 border-amber-400 bg-amber-50/60 hover:border-amber-500'
          : 'border-gray-200 bg-white hover:border-blue-300'
    "
    @click="handleClick"
  >
    <!-- 卡片頭部：航空公司 / 航班號 / TripStatus -->
    <div class="flex min-h-52px items-start justify-between gap-2">
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm text-gray-400" :title="airlineName">{{ airlineName }}</p>
        <p class="text-lg font-semibold text-gray-800">{{ flight.flightNumber }}</p>
      </div>
      <span
        class="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium"
        :class="tripStatusMeta.class"
      >
        {{ tripStatusMeta.label }}
      </span>
    </div>

    <!-- 起降機場 -->
    <div class="mt-3 flex items-start text-sm text-gray-600">
      <div class="min-w-0 flex-1">
        <p class="text-xs text-gray-400">出發</p>
        <p class="truncate font-medium text-gray-800" :title="departureAirportName">
          {{ departureAirportName }}
        </p>
        <p v-if="flight.terminal && flight.direction === FlightDirection.Departure" class="text-xs text-gray-400">
          航廈 {{ flight.terminal }}
        </p>
      </div>
      <div class="shrink-0 self-center px-2 text-gray-300">→</div>
      <div class="min-w-0 flex-1 text-right">
        <p class="text-xs text-gray-400">抵達</p>
        <p class="truncate font-medium text-gray-800" :title="arrivalAirportName">
          {{ arrivalAirportName }}
        </p>
        <p v-if="flight.terminal && flight.direction === FlightDirection.Arrival" class="text-xs text-gray-400">
          航廈 {{ flight.terminal }}
        </p>
      </div>
    </div>

    <!-- 時間資訊 -->
    <div class="mt-3 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 text-sm">
      <div>
        <p class="text-xs text-gray-400">{{ scheduleTimeLabel }}</p>
        <p class="font-medium text-gray-700">{{ formatToHourMinute(scheduleTimeValue) }}</p>
      </div>
      <div>
        <p class="text-xs text-gray-400">{{ actualTimeLabel }}</p>
        <p class="font-medium text-gray-700">{{ formatToHourMinute(actualTimeValue) }}</p>
      </div>
    </div>

    <!-- 不便險理賠資格 Badge：左側標籤固定不換行，右側原因文字截斷避免破版 -->
    <div class="mt-3 border-t border-gray-100 pt-3">
      <InsuranceBadge :eligibility="eligibility" />
    </div>
  </div>
</template>