# CLAUDE.md

本檔案提供 Claude Code（claude.ai/code）在此專案中工作時所需的架構指引。

## 專案簡介

FlightGuard（flightGuard）—— 一個 Vue 3 + TypeScript 的 SPA，讓使用者能查詢航班動態（透過交通部運輸資料流通服務 TDX 的 FIDS API）、檢查不便險理賠資格，並透過 OpenSky Network 顯示飛機即時位置地圖，同時提供「理賠工作台」讓使用者批次追蹤、審核與匯出理賠案件。以靜態網站形式部署於 GitHub Pages。

程式碼中的註解與識別字（變數、函式命名的語意）全數以繁體中文撰寫，新增程式碼時請沿用此慣例。

## 常用指令

```sh
npm run dev          # 啟動 Vite 開發伺服器（預設 port 5173）
npm run build         # 型別檢查（vue-tsc --build）+ 正式建置
npm run build-only    # 略過型別檢查，僅執行正式建置
npm run type-check    # 僅執行 vue-tsc --build 型別檢查
npm run preview       # 本機預覽正式建置後的成品
```

本專案**沒有**測試套件、也**沒有**設定 lint 指令 —— 不要假設 `npm test` 或 `npm run lint` 存在。修改程式碼後，請以 `npm run type-check` 作為主要的正確性驗證手段。

需要在專案根目錄建立 `.env` 檔，設定 `VITE_TDX_CLIENT_ID` 與 `VITE_TDX_CLIENT_SECRET`（TDX OAuth2 client-credentials 認證資訊）才能本機開發；CI 建置／部署時（`.github/workflows/deploy.yml`，push 到 `master` 時觸發，將 `dist/` 部署至 GitHub Pages）則改由 GitHub Actions Secrets 注入。

## 路徑別名

`@/*` 對應 `src/*`（同時設定於 `vite.config.ts` 與 `tsconfig.app.json`）—— 專案內一律使用 `@/...` 引入，不使用 `../../` 相對路徑。

## 專案目錄結構與職責

```
src/
├── api/            # 外部 API 串接層，依來源分資料夾
│   ├── http.ts         # 共用 Axios instance + 攔截器
│   ├── tdx/             # TDX（需 OAuth2 認證）
│   └── openSky/         # OpenSky Network（無需認證）
├── components/     # UI 元件，依業務領域分資料夾
│   ├── common/          # 跨領域共用元件（下拉選單骨架、頁首）
│   ├── search/           # 搜尋列相關
│   ├── fids/              # 航班動態列表 / 卡片 / 理賠徽章
│   ├── claim/             # 理賠工作台面板與 Toast
│   └── map/               # Leaflet 地圖與航線繪製
├── composables/     # 可複用的響應式邏輯（Vue Composition API）
├── stores/          # Pinia 狀態管理（見下方專節）
├── types/           # TypeScript 型別定義，依領域拆檔，統一由 index.ts 匯出
├── utils/           # 純函式工具（無外部狀態依賴，易於單元測試）
├── views/           # 路由頁面層級元件
├── data/            # 靜態資料（機場經緯度座標 JSON，非 TDX 資料）
├── router/          # Vue Router 設定
├── App.vue          # 全站 Layout（Header + 路由 + 全域掛載的理賠工作台/Toast）
└── main.ts          # 應用程式進入點（Pinia / Router / Leaflet icon 修正掛載）
```

### `api/` —— 外部服務串接層

- **`api/http.ts`** —— 共用 Axios instance（`httpClient`，baseURL 指向 TDX）。Request 攔截器會 `await fetchToken()` 取得 Token 後才組裝 `Authorization: Bearer` header；Response 攔截器統一把 HTTP 錯誤（401 / 429 / 其他）轉為中文使用者訊息，並在 401 時清空 Token 快取。**只有 TDX 相關 API 使用此 instance**；OpenSky 因不需認證，直接使用原生 `axios`。
- **`api/tdx/auth.ts`** —— 取得並快取 TDX Access Token。用 `inFlightRequest` Promise 鎖，確保頁面載入時「機場、航空公司、FIDS」三支 API 同時發起時，只會真正打一次認證請求、其餘等待共用同一個 Promise。Token 有效期快取，並提前 1 分鐘視為過期以留緩衝。
- **`api/tdx/airport.ts`** / **`api/tdx/airline.ts`** —— 分別呼叫 `GET /v2/Air/Airport`、`GET /v2/Air/Airline` 取得**全量**清單，並將 TDX 原始格式（`AirportName.Zh_tw` 等巢狀結構）轉換為專案內部扁平化的 `TdxAirport` / `TdxAirline` 型別。
- **`api/tdx/fids.ts`** —— 航班動態查詢核心。詳見下方「TDX API 串接特性」專節。
- **`api/openSky/stateVector.ts`** —— 呼叫 OpenSky `/states/all`（公開、無需 Token）取得全球飛機即時狀態向量。429 限流或逾時／網路異常時一律 `catch` 後回傳 `[]`（而非 throw），因為飛機位置屬於「錦上添花」的資訊，不應讓整頁查詢失敗。

### `components/` —— 依業務領域分資料夾

- **`common/`** —— 與業務邏輯無關的共用 UI 骨架：`DropdownList.vue`（純容器 + slot，負責 `<ul>/<li>` 樣式與 empty state）、`FilterDropdown.vue`（打字篩選 + 關鍵字高亮，泛型 `T`）、`RecommendDropdown.vue`（Focus 時的常見推薦清單，泛型 `T`），三者共同支撐 `useEntitySearch` 的 UI 呈現；`AppHeader.vue` 為全站頁首，內建理賠工作台入口按鈕與未結案筆數徽章。
- **`search/SearchHeader.vue`** —— 搜尋列（機場/航空公司/航班號輸入框、方向切換、日期）。
- **`fids/`** —— `FlightList.vue`（Loading 骨架屏／錯誤／空狀態／卡片清單四態切換，並在查無結果時提供「切換至另一方向查詢」按鈕以降低使用者重試造成的 429 機率）、`FlightCard.vue`（單張航班卡片，顯示時串接 `airlineID + flightNumber` 組成完整班號）、`InsuranceBadge.vue`（理賠資格徽章）。
- **`claim/`** —— `ClaimModal.vue`（理賠工作台右側抽屜面板：篩選、排序、逐筆核付/駁回/移除、匯出 CSV）、`ClaimToast.vue`（全站掛載於 `App.vue` 的加入結果提示 Toast，由 `stores/claimWorkspace.ts` 集中控制顯示內容與 2 秒後自動關閉）。
- **`map/`** —— `FlightMap.vue`（Leaflet 地圖主體，繪製起降機場 Marker、飛機圖示、大圓航線）、`RoutePolyline.vue`（純粹負責在既有地圖實例上繪製/更新/清除一條 Polyline，不渲染任何 DOM）。

### `composables/` —— 可複用響應式邏輯

- **`useEntitySearch.ts`** —— 「輸入框 + Focus 常見推薦 + 打字 Debounce 篩選」共用互動邏輯，使用泛型 `T`。新增任何「從清單中搜尋並選取一個實體」的 UI，應優先複用此 composable，而非重新實作 debounce/focus 邏輯。
- **`useAirportSearch.ts`** / **`useAirlineSearch.ts`** —— 分別包裝 `useEntitySearch` 並串接 `tdxBaseData` store 的搜尋方法；`useAirportSearch.ts` 額外處理「國外機場語意反轉」（見下方專節）。
- **`useFidsData.ts`** —— FIDS 航班動態查詢邏輯主體，整合 `useAirportSearch` + `useAirlineSearch`，串接 `api/tdx/fids.ts`，並依「今日全天」/「即時未來」兩種範圍模式做前端時間過濾。`SearchView.vue` 的主要資料來源。
- **`useFlightTracking.ts`** —— 將 TDX 航班號（IATA 航空代碼）轉換為 OpenSky 呼號（ICAO 代碼）並查詢即時位置，詳見下方「航班號 → OpenSky 呼號橋接」專節。
- **`useInsuranceCheck.ts`** —— 薄響應式包裝層，依查詢方向（進站/離站）挑出正確的表定/實際時間欄位，餵給 `utils/insuranceRule.ts` 的純函式計算理賠資格。
- **`useMapState.ts`** —— 管理地圖中心座標／縮放層級，供 `FlightMap.vue` 呼叫 Leaflet `flyTo`。

### `stores/` —— Pinia 狀態架構

詳見下方「Pinia Store 狀態架構」專節。

### `types/` —— 型別定義

依領域拆分為 `common.ts`（`SearchMode` 輸入框互動狀態列舉）、`tdx.ts`（`TdxAirport`／`TdxAirline`／`TripStatus`／`FlightDirection`／`FidsFlight`／`FidsQueryParams`）、`openSky.ts`（`OpenSkyStateVector`／`FlightAirborneStatus`／`FlightState`／`AircraftPosition`）、`insurance.ts`（`InsuranceReasonType`／`DelayCalculationResult`／`InsuranceEligibility`）、`claim.ts`（`ClaimStatus`／`ClaimItem`），統一由 `index.ts` 用 `export *` 匯出，其餘檔案一律從 `@/types` 引入、不直接指到子檔案。

### `utils/` —— 純函式工具

- **`insuranceRule.ts`** —— 不便險理賠資格判定核心邏輯，見下方專節。
- **`dateTime.ts`** —— ISO 字串 ↔ 顯示格式轉換（`formatToHourMinute`／`formatToFullDateTime`）、取得今日日期字串。
- **`flightId.ts`** —— `getFlightId(flight)` 產生「航班號-時間」格式的唯一識別字串，供 `v-for` key、批次選取、理賠工作台去重等場景共用同一套規則。
- **`geoUtils.ts`** —— Haversine 距離公式、跨換日線最短經度差修正、大圓航線（Great Circle Arc）插值點陣列生成，供地圖繪製長距離航線的平滑曲線。
- **`airportCoordLookup.ts`** —— 讀取 `data/airports.json`（第三方開源機場座標資料，非 TDX 提供）依 IATA 碼查座標，供地圖與航線計算使用。
- **`tripStatusMeta.ts`** / **`claimStatusMeta.ts`** —— 「狀態 → 顯示標籤 + 樣式」的單一事實來源（Single Source of Truth），避免各元件各自用 switch/字串比對重複判斷。
- **`csvExport.ts`** —— 理賠工作台匯出 CSV 用的通用下載工具（含 UTF-8 BOM 避免 Excel 開啟中文亂碼）。

### `views/` —— 路由頁面

- **`SearchView.vue`** —— 主搜尋頁：搜尋列 + 查詢結果列表 + 批次選取操作列 + 理賠特搜浮動抽屜。
- **`FlightDetailView.vue`** —— 單一航班詳情頁：優先讀取 `flightCache` store 的暫存資料，缺快取時（重新整理／直接貼網址）才重新呼叫 TDX 查詢比對；整合 `useInsuranceCheck` 與 `useFlightTracking`，並嵌入 `FlightMap`。

## TDX API 串接特性

### 認證流程與請求防護

見上方 `api/tdx/auth.ts`、`api/http.ts` 說明——重點是「Token 快取 + 併發鎖」與「攔截器統一錯誤轉譯」。任何新增的 TDX API 呼叫都必須透過 `httpClient`（`@/api/http.ts`）發送，才能吃到這兩層保護，切勿在個別檔案中另建 Axios instance。

### `AirlineID` 與 `FlightNumber` 為兩個獨立欄位（重要）

TDX FIDS 資料中，**航空公司代碼**（`AirlineID`，如 `"CI"`）與**純數字班次**（`FlightNumber`，如 `"791"`）是兩個獨立欄位；畫面上顯示的完整班號（如 `"CI791"`）是前端在 `FlightCard.vue` / `FlightDetailView.vue` 等處自行以 `{{ flight.airlineID }}{{ flight.flightNumber }}` 拼接而成，**並非 TDX 原始欄位**。

因此 `api/tdx/fids.ts` 的 `buildFlightNumberFilterExpr()` 在組裝 OData `$filter` 查詢字串前，會先用 `normalizeFlightNumberKeyword()`（去除所有空白、轉大寫）正規化使用者輸入的航班號關鍵字，再依輸入型態拆解：

- 純數字（如 `"791"`）→ 比對 `FlightNumber eq '791'`
- 純英文（如 `"CI"`）→ 比對 `AirlineID eq 'CI'`
- 英數混合（如 `"CI791"`）→ 拆解字首英文與尾端數字，組合成 `AirlineID eq 'CI' and FlightNumber eq '791'`

日後若新增任何「依航班號查詢/比對」的邏輯（例如 `FlightDetailView.vue` 的 `parseRouteId()` 三層比對：航空公司代碼 + 航班號數字 + 表定日期），都必須遵循「先拆解、分別比對」的原則，直接用完整字串去比對單一 `FlightNumber` 欄位一定比對不到。

### `resolveTripStatus()`：以時間差為主、Remark 為輔覆寫狀態

`api/tdx/fids.ts` 的 `resolveTripStatus()` 會覆寫 TDX 原始的 `TripStatus` 欄位，判定優先順序：

1. `DepartureRemark`／`ArrivalRemark` 含 `CANCELLED` / `取消` 關鍵字 → 強制判定為 `Cancelled`（最高優先）
2. 表定與實際時間差 >= 1 分鐘 → 強制判定為 `Delayed`（不依賴 TDX 原始狀態是否已更新——這是**測試用門檻**，正式環境上線前需與業務單位確認實際門檻）
3. Remark 關鍵字比對（中英混合）→ `Departed` / `Normal`
4. 都無法判定 → 沿用 TDX 原始 `TripStatus`

存在的原因：TDX 原始 `TripStatus` 欄位更新常常落後於實際的表定/實際時間與 Remark 文字，直接信任該欄位會導致 UI 顯示過時狀態。

### 國外機場查詢語意反轉

TDX FIDS 只服務台灣機場的航班看板。`useAirportSearch.ts` 維護 `DOMESTIC_AIRPORT_IATA_LIST` 白名單；使用者選擇非國內機場時，`getEffectiveQueryAirportCode()` 會靜默把實際查詢目標代換成 `TPE`（桃園），`getEffectiveDirection()` 則把離站/進站方向反轉（因為「從東京出發」等同於「抵達桃園」）。查回的結果會再由前端依原始選定的國外機場代碼二次過濾。`useFidsData.ts` 的 `search()` 是實際串接這套邏輯的呼叫端，修改查詢邏輯時務必同時檢視這兩個檔案。

### 航班號 → OpenSky 呼號橋接

`useFlightTracking.ts` 需要把 TDX 的 `AirlineID + FlightNumber`（IATA 航空代碼，如 `BR301`）轉換為 OpenSky 用的呼號（ICAO 代碼，如 `EVA301`）才能比對兩邊資料。轉換順序：先查 `tdxBaseData` store 快取的 `airlineICAO` 欄位，查無資料（store 尚未載入完成，或該航空公司缺此欄位）時退回檔案內建的 `FALLBACK_AIRLINE_ICAO_MAP` 靜態對照表（涵蓋台灣籍與常見區域籍航空公司）。

## OpenSky API 串接特性

公開、無需認證，直接以原生 `axios` 呼叫（不經過 `httpClient`）。因免費額度嚴格、極易觸發 429，`getAllStateVectors()` 內部已將 429 與網路異常一律 `catch` 後回傳 `[]`，呼叫端（`useFlightTracking.ts`）據此判定為「查無即時位置」而非讓整頁查詢中斷。新增任何呼叫 OpenSky 的邏輯，都應延續這個「失敗降級為空結果」的模式，並盡量透過既有的父層資料（如 `FlightDetailView.vue` 統一呼叫一次 `useFlightTracking` 後以 props 傳給 `FlightMap.vue`）避免同一航班在多處各自重複發送請求。

## Pinia Store 狀態架構

專案採 Pinia Setup Store 語法（`defineStore(id, () => {...})`），共 3 個 store：

### `stores/tdxBaseData.ts` —— 全量基礎資料快取

- **用途**：`initialize()` 於 App 啟動時一次性平行呼叫機場／航空公司全量清單 API 並快取於 `airports` / `airlines`，之後所有搜尋（`searchAirports` / `searchAirlines`）皆為前端 `Array.filter`（模糊比對中文名/英文名/IATA/ICAO），完全避免逐字打字觸發 API。
- **精準查找**：`getAirportByIATA` / `getAirlineByIATA` 供代碼 → 顯示名稱、ICAO 轉換等場景使用，被 `useFlightTracking.ts`、`FlightDetailView.vue`、`ClaimModal.vue`（CSV 匯出）等多處消費。
- **狀態**：`isLoading` / `error` / `isInitialized`（防止重複初始化，除非傳入 `force: true`）。

### `stores/flightCache.ts` —— 單次交接快取（One-shot Handoff Cache）

- **用途**：使用者在 `SearchView.vue` 點擊航班卡片跳轉至 `FlightDetailView.vue` 時，把當下已查到的 `FidsFlight` 物件用路由 id（`"航班號-YYYYMMDD"`）暫存於此；詳情頁 `onMounted` 時優先呼叫 `consumeFlight(routeId)` 讀取（讀取後立即清空），避免重新整理跳頁就再打一次 TDX API 造成 429。
- **Fallback**：`routeId` 不吻合（例如使用者直接貼網址、或重新整理頁面）時 `consumeFlight` 回傳 `null`，`FlightDetailView.vue` 會退回呼叫 `loadFlightDetail()` 重新查詢並三層比對（航空公司代碼 + 航班號數字 + 表定日期）出正確航班。

### `stores/claimWorkspace.ts` —— 理賠待處理工作台

- **用途**：讓使用者把查詢結果／理賠特搜清單中的航班加入 `items` 清單，統一追蹤處理進度。
- **狀態機**：`ClaimStatus` 為 `'watching'`（追蹤中，未達理賠門檻）／`'pending'`（待審核，加入當下已符合資格）／`'approved'`（已核付）／`'rejected'`（駁回），加入當下由 `resolveEligible()`（邏輯與 `useInsuranceCheck.ts` 完全一致）自動判定初始狀態為 `watching` 或 `pending`。
- **持久化**：`items` 透過 `watch(..., { deep: true })` 同步寫入 `localStorage`（key: `flightguard-claim-workspace`），重新整理頁面後案件仍會保留；讀取失敗一律回傳空陣列，避免格式異常時整頁白屏。
- **去重**：`addFlightInternal()` 以 `utils/flightId.ts` 的 `getFlightId()` 判斷是否已存在，`addFlight()`／`batchAddFlights()` 皆基於此避免重複加入。
- **Toast 提示**：`toastMessage` + `showToast()` 統一控制全域 Toast 顯示內容與 2 秒後自動清空（單一計時器，避免連續加入時互搶）；`notifyAddResult(addedCount, duplicateCount)` 依「新增筆數／重複略過筆數」組出對應文案。任何新增「加入工作台」按鈕的功能，都應呼叫 `claimStore.addFlight()` 或 `batchAddFlights()`，不需要自行處理 Toast——`components/claim/ClaimToast.vue` 已全站掛載於 `App.vue` 頂層，會自動反映 `toastMessage` 的變化。
- **面板開關**：`isOpen` + `openWorkspace()` / `closeWorkspace()` / `toggleWorkspace()`，供 `AppHeader.vue` 按鈕與 `ClaimModal.vue` 抽屜共用同一狀態。
- **金額估算**：`estimatedTotalAmount` 以每筆 `CLAIM_AMOUNT_PER_ITEM`（新台幣 5000 元，寫死於檔案內）估算「待審核 + 已核付」案件的預估總理賠金額，追蹤中／駁回案件不計入。

## 不便險理賠資格為純函式

`utils/insuranceRule.ts`（`checkInsuranceEligibility`）刻意設計為無副作用純函式：輸入 `TripStatus` + 表定/實際 ISO 時間戳，輸出 `InsuranceEligibility` 判定結果。`composables/useInsuranceCheck.ts` 是薄響應式包裝層，依 `FlightDirection`（離站/進站）挑選正確的時間欄位餵入。延誤門檻常數 `DEFAULT_DELAY_THRESHOLD_MINUTES` 目前設為 **60（測試用）**——正式 不便險 保單通常採 4 小時門檻（`FlightDetailView.vue` 畫面文字仍顯示「延誤 ≥ 240 分鐘（4 小時）」），修改此常數前務必與使用者確認是否已可切換為正式門檻。

## 路由

採 Hash 路由模式（`createWebHashHistory`），因為網站部署在 GitHub Pages 子路徑（`/flightGuard/`）且無伺服器端 rewrite 支援 —— 若使用一般 history 模式，重新整理 `/flight/:id` 會直接 404。`src/router/index.ts` 有兩條路由：`/search`（主搜尋+列表+地圖頁，`meta.keepAlive: true` 保留搜尋條件與結果）與 `/flight/:id`（詳情頁，`id` 為「航班號-日期」編碼字串，`props: true` 自動轉為頁面 Prop）。
