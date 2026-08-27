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
import { InsuranceReasonType, FlightDirection, type FidsFlight } from '@/types';
import { formatToHourMinute } from '@/utils/dateTime';
import { getTripStatusMeta } from '@/utils/tripStatusMeta';
import InsuranceBadge from '@/components/fids/InsuranceBadge.vue';

const props = withDefaults(
  defineProps<{
    flight: FidsFlight;
    /** 是否為批次選取模式；開啟時點擊卡片改為切換選取狀態，不再直接導頁 */
    selectable?: boolean;
    /** 批次選取模式下，本卡片目前是否已被選取 */
    selected?: boolean;
  }>(),
  {
    selectable: false,
    selected: false,
  },
);

const emit = defineEmits<{
  select: [flight: FidsFlight];
  'toggle-select': [flight: FidsFlight];
}>();

const tdxStore = useTdxBaseDataStore();

/** 不便險理賠資格判定（傳入單一航班） */
const { eligibility } = useInsuranceCheck(props.flight);

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
const tripStatusMeta = computed(() => getTripStatusMeta(props.flight.tripStatus));

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
  if (props.selectable) {
    emit('toggle-select', props.flight);
  } else {
    emit('select', props.flight);
  }
}
</script>

<template>
  <!-- 取消理賠用紅色系、延誤理賠用黃色系 -->
  <div
    class="flex cursor-pointer flex-col rounded-xl border p-4 shadow-sm transition hover:shadow-md"
    :class="[
      eligibility?.reasonType === InsuranceReasonType.Cancelled
        ? 'border-2 border-red-400 bg-red-50/60 hover:border-red-500'
        : eligibility?.reasonType === InsuranceReasonType.DelayOver4Hours
          ? 'border-2 border-amber-400 bg-amber-50/60 hover:border-amber-500'
          : 'border-gray-200 bg-white hover:border-blue-300',
      selectable && selected ? 'ring-2 ring-blue-500 ring-offset-1' : '',
    ]"
    @click="handleClick"
  >
    <!-- 卡片頭部：批次選取 Checkbox / 航空公司 / 航班號 / TripStatus -->
    <div class="flex min-h-52px items-start justify-between gap-2">
      <div class="flex min-w-0 flex-1 items-start gap-2">
        <!-- 批次選取模式 Checkbox -->
        <div
          v-if="selectable"
          class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition"
          :class="selected ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'"
        >
          <svg
            v-if="selected"
            xmlns="http://www.w3.org/2000/svg"
            class="h-3.5 w-3.5 text-white"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.5 7.6a1 1 0 0 1-1.42.006l-3.5-3.5a1 1 0 1 1 1.414-1.414l2.796 2.796 6.79-6.888a1 1 0 0 1 1.414-.014Z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-gray-400" :title="airlineName">{{ airlineName }}</p>
          <p class="text-lg font-semibold text-gray-800">{{ flight.airlineID }}{{ flight.flightNumber }}</p>
        </div>
      </div>
      <span
        class="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium"
        :class="tripStatusMeta.badgeClass"
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