# 아키텍처

## 1. 한눈에 보기

```
data/places.csv ─┐
data/routes.json ├─▶ lib/data/parse.ts (PapaParse + Zod 검증)  ──▶ app/page.tsx (서버, 빌드 시 SSG)
data/categories.json ┘                                               │ props
                                                                      ▼
                                              components/AtlasApp.tsx  (클라이언트: 모든 UI 상태)
                                               ├─ SiteHeader (브랜드·탭·검색·언어·공유) / SearchBar / LanguageSwitcher
                                               ├─ 패널(데스크톱 사이드 패널 = 모바일 MobileBottomSheet 가 같은 내용을 공유)
                                               │    ├─ CategoryFilters · PlaceList ▸ PlaceCard   ← 목록
                                               │    ├─ PlaceDetailPanel                          ← 장소 상세(마커·카드 공통)
                                               │    └─ RouteExplorer                             ← 코스 목록·상세·타임라인
                                               ├─ MapView ▸ PlaceMarker (MapLibre, 동적 import, ssr:false) + MapControls / ListToggle
                                               └─ ShareDialog · Toast · EmptyState

브라우저 ──POST /api/route {routeId, mode}──▶ app/api/route/route.ts ──▶ OpenRouteService
                                              (서버 키·검증·캐시·한도)   (키 없으면 503)
```

핵심 원칙: **데이터 ↔ UI ↔ 지도 분리**.
- `lib/` 는 React·지도에 의존하지 않는 순수 로직(검증, 필터, 공유 URL, 경로 클라이언트) → 단위 테스트 가능.
- `MapView` 는 props 를 받아 그리기만 하고 비즈니스 로직(필터·코스 계산)을 모른다.
- 상태는 `AtlasApp` 한 곳에 있다(수강생이 흐름을 따라가기 쉽게).

## 2. 디렉터리

| 경로 | 역할 |
|---|---|
| `config/site.ts` | 브랜드·지역·지도 기본값·기능 스위치 |
| `app/theme.css` | 디자인 토큰(색·글꼴·그림자) |
| `app/page.tsx` | 데이터 로드(서버) → `AtlasApp` |
| `app/api/route/route.ts` | 경로 API 프록시 |
| `components/map/` | `MapView`(MapLibre), `PlaceMarker`(마커 안 아이콘/번호, React Portal), `MapControls`·`ListToggle` |
| `components/places/` | `CategoryFilters`, `PlaceList`, `PlaceCard`, `PlaceDetailPanel` |
| `components/routes/RouteExplorer.tsx` | 코스 목록·상세·타임라인·이동시간 UI |
| `components/layout/` | `SiteHeader`, `MobileBottomSheet`(드래그·3단계 스냅) |
| `components/common/` | `SearchBar`, `LanguageSwitcher`, `Toast`, `EmptyState`, `PlaceVisual`, `ShareDialog`, `I18nProvider`, `ErrorBoundary` |
| `lib/validation/schemas.ts` | Zod 스키마 + 교차 검증 |
| `lib/data/` | `parse`(순수) · `load`(fs, 서버 전용) · `filter` · `geojson` |
| `lib/i18n/` | `ko.ts`·`en.ts` 사전, 폴백 |
| `lib/routing/ors.ts` | OpenRouteService 클라이언트 |
| `lib/share.ts` | 공유 URL 생성/검증 |
| `scripts/` | `validate-data.ts`, `copy-maplibre-worker.mjs` |
| `tests/unit`, `tests/e2e` | Vitest / Playwright |

## 3. 데이터 흐름

1. 빌드(또는 dev 서버 요청) 시 `loadAtlasData()` 가 CSV·JSON을 읽고 **전부 검증**. 오류가 있으면 빌드가 실패 → Vercel은 이전 정상 버전을 유지한다.
2. 검증된 `AtlasData` 가 props 로 클라이언트에 전달된다.
3. `AtlasApp` 이 `filterPlaces()` 로 목록을 만들고, **같은 배열**을 지도(`mapPlaces`)에 전달 → 목록과 마커가 항상 일치.
4. 선택(`selectedId`, `routeId`)은 URL 쿼리(`?route=&place=`)와 동기화(`history.replaceState`). 첫 진입 시 `parseShareParams()` 로 검증 후 복원.
5. 언어는 `localStorage` + `useSyncExternalStore`(서버 렌더링은 기본 언어, 하이드레이션 불일치 없음).

## 4. 지도 렌더링 구조

- MapLibre 는 브라우저 전용이므로 `next/dynamic(..., { ssr: false })` 로 로드. 초기화는 `useEffect` 안.
- **마커는 HTML 요소**(`<button>`) — 키보드/스크린리더 접근, 번호 표시, 테스트 용이(30개 규모에 적합). 대량(수천 곳)이면 GeoJSON 레이어로 전환.
- 코스 연결선은 GeoJSON 소스 2개: `route-straight`(점선, 직선) / `route-real`(실선, API 경로). 레이어는 `style.load` 에서 추가.
- 팝업 내용은 DOM `textContent` 로만 생성(XSS 방지).
- 워커 파일은 번들러 경로 문제를 피하려고 `public/maplibre/` 에서 제공(`setWorkerUrl`). `prebuild`/`predev` 가 복사한다.
- 스타일 URL 은 `NEXT_PUBLIC_MAP_STYLE_URL` 로 교체 가능. 스타일을 못 받으면(또는 20초 내 준비 안 됨) 안내 + 재시도.
- 출처 표시: MapLibre 의 attribution control(스타일이 OpenFreeMap/OSM 문구 포함)을 항상 표시.

## 5. 외부 API

| 서비스 | 용도 | 키 | 실패 시 |
|---|---|---|---|
| OpenFreeMap | 지도 스타일·타일 | 불필요 | 안내 + 재시도, 목록·코스 UI 동작 |
| OpenRouteService | 실제 경로·시간 | 서버 `ORS_API_KEY` | 503/429/5xx → 화면에 안내, 직선 모드 유지 |
| Vercel Web Analytics | 페이지 조회 | 불필요(대시보드 활성화) | 비활성 |

`/api/route` 는 클라이언트가 **좌표를 보내지 못하게** `routeId`+`mode` 만 받고, 좌표는 서버가 `data/` 에서 조회 → 임의 좌표 중계(남용) 방지. 입력은 Zod, 상류 호출은 8초 타임아웃, 인스턴스 메모리 캐시(1시간)와 분당 20회 제한을 둔다(서버리스 특성상 **인스턴스 단위**이므로 완전한 보장은 아님 — 운영 문서 참조).

## 6. 기술 선택 이유 (Decision Log)

| 결정 | 이유 | 대안/트레이드오프 |
|---|---|---|
| Next.js App Router | Vercel 배포가 가장 쉬움, 서버 API Route 로 키 보호 | Vite SPA는 키 보호용 서버 별도 필요 |
| MapLibre + OpenFreeMap | 무료·키 불필요·오픈 라이선스 | Google/Kakao 지도는 키·약관·요금 |
| CSV + JSON (DB 없음) | 비전공자가 엑셀로 수정, Git으로 이력 관리 | 데이터가 커지면 DB/CMS (`load.ts` 만 교체) |
| Zod 검증을 빌드에 포함 | 잘못된 데이터가 배포되지 않음 | 런타임 검증은 비용 |
| HTML 마커 + supercluster | 각 핀이 키보드로 누를 수 있는 버튼, 화면 안 클러스터만 그려 1,000곳 이상도 가벼움 | 수만 곳이면 GeoJSON 클러스터 레이어 |
| 상태를 `AtlasApp` 한 곳에 | 교육 난이도, 추적 용이 | 규모 커지면 Context/Zustand |
| 직선 연결선(7차시) → OSMnx 실제 도보 경로(완성본) | 실습은 키·비용 없이 완성, 완성본은 빌드 전에 경로를 계산해 정적 파일로 제공(실행 중 외부 호출·비용 0). 경로 파일이 없으면 직선으로 자동 대체 | ORS 는 다른 이동수단용 선택 기능 |
| 분석은 기본 페이지 조회만 | 개인정보 최소화, 코드 단순 | 코스 인기도는 이벤트 수집 필요 |
| 워커 파일 복사 | Next(Turbopack)에서 번들된 워커 경로가 깨지는 것을 확인함 | `maplibre-gl-csp` 빌드 등 |


## 7. UX 구조 (리디자인 이후)

- **단일 장소 상세 상태**: `selectedId` 하나가 지도 마커 강조·팝업·목록 카드 `aria-current`·상세 패널을 모두 결정한다. 마커를 누르든 카드를 누르든 같은 `PlaceDetailPanel` 이 열린다. 상세가 열려도 목록은 `hidden` 으로만 숨겨 스크롤·상태를 유지하고, 돌아오면 방금 본 카드로 포커스를 복원한다(Esc 로도 닫힘).
- **패널 공유**: 데스크톱 `<aside>` 와 모바일 `MobileBottomSheet` 는 같은 `panelBody` 를 렌더링한다(한 번에 하나만 마운트).
- **바텀시트**: `collapsed(124px) / half(46%) / full(지도 높이 − 116px)`. 손잡이를 Pointer Events 로 끌면 실시간 높이 → 놓을 때 속도를 반영해 가장 가까운 단계로 스냅. 탭/Enter 는 순환, ↑↓ 키 지원, 접힌 상태의 내용은 `inert`. 전체 단계에서도 상단 검색 바·칩(116px)은 가리지 않는다.
- **시트 ↔ 지도 연동**: 시트 높이를 CSS 변수 `--sheet-inset` 과 `bottomInsetRatio` 로 지도에 전달 → ① `fitBounds/easeTo` 의 하단 패딩 ② 지도 출처 표시·컨트롤이 시트 위로 따라 올라감.
- **반응형**: <768 모바일(시트) / 768~1023 태블릿(좁은 사이드 패널 22rem, 검색은 패널 상단) / ≥1024 헤더 검색 + 26rem 패널 / ≥1536 30rem 패널.
- **마커 클러스터링(supercluster)**: 30곳 실습 단계에서는 필요 없지만, 완성본은 1,222곳이라 클러스터 없이는 지도가 덮입니다. 줌 18까지 클러스터를 유지하고, 끝까지 확대해도 나뉘지 않는 클러스터(같은 건물에 여러 점포 — 최대 11곳이 한 좌표)는 누르면 **그 위치의 장소 목록**으로 보여 줍니다.
- **상태 피드백**: 지도 로딩 스켈레톤 → 실패 시 재시도, 위치 성공/거부/시간초과 `Toast`, 오프라인 배너, 경로 계산 중 스켈레톤·오류, 빈 검색 결과 `EmptyState`.
- **모션**: 모든 CSS 전환·애니메이션과 지도 `easeTo/fitBounds` 가 `prefers-reduced-motion` 에서 꺼진다.


## 8. 실데이터 파이프라인 (오프라인 → 정적 파일)

```
Overpass(OSM) ─┐                         ┌→ data/places.csv  (1,222곳, 출처·라이선스 열 포함)
Nominatim ─────┤                         │
Wikidata/위키백과/Commons ┼→ fetch_places.py ─┤
진흥공단 상가정보 API ─┘ (키 없으면 OSM 대체)  └→ (검증) npm run validate:data
OSM 보행 네트워크 → OSMnx(build_routes.py) → data/route-paths.json (코스별 실제 경로·구간 거리)
```

- **실행 시 외부 데이터 API 를 호출하지 않습니다.** 수집 결과를 Git 에 커밋하고, 빌드 때 Zod 로 검증합니다 → 배포가 외부 서비스 장애·요금·키 노출과 무관.
- 코스는 OSM 명소(id `osm-…`)로만 구성 → 진흥공단 데이터를 갱신해 상가 id 가 바뀌어도 코스가 깨지지 않음(단위 테스트로 강제).
- 대량 마커: `supercluster` 로 줌별 클러스터 계산 → 화면 안의 클러스터/핀만 HTML 마커로 그리고, 이동이 끝날 때(`moveend`) 기존 요소를 재사용하며 갱신. 줌 18 이상 또는 선택·코스 핀만 이름 라벨 표시.
- 목록은 "현재 지도 영역" 기준(처음 화면 → 사용자가 **이 지역에서 다시 찾기**로 갱신), 검색·필터를 바꾸면 전체 지역 결과로 전환하고 결과에 지도를 맞춤. 30곳씩 페이지 단위 렌더링.

## 8-1. 전국 모드 · 내 코스 (완성본 확장)

```
진흥공단 전국 '음식' 업소(storeListInUpjong, 약 84만) → semas_nationwide.py → data/raw/*.jsonl.gz
                                              + data/places.csv 의 OSM 명소(doc jsonb) → load_postgres.py → PostGIS places
브라우저 ─ 지도 이동(moveend, 250ms 디바운스) → GET /api/places?bbox&z → count ≤ 1,500 ? 개별 장소 : 격자 클러스터(약 88px)
                                                                         + 화면 중심 KNN(geom <-> point) 가까운 100곳 목록
내 코스 ─ POST /api/walk {placeIds} → 서버가 좌표 조회 → OSRM(foot, 내부망) → 구간(leg)별 형상·거리, 시간은 4.5km/h 추정
```

- **모드 전환은 `DATABASE_URL` 하나**: 없으면 동네 모드(CSV, 강의 기준), 있으면 페이지에는 추천 코스 방문지만 싣고 장소는 API 로 받습니다. 같은 `AtlasApp`/`MapView` 가 두 모드를 처리합니다(`remote` 플래그).
- 서버 클러스터는 격자 좌표에 범위를 맞춰(snap) 같은 화면 요청이 캐시에 맞고 클러스터가 흔들리지 않게 합니다. 화면 안 결과가 적어지면 브라우저 `supercluster` 가 이어받습니다.
- 진흥공단 행은 열만 저장하고 설명·출처는 API 가 템플릿으로 구성(동네 모드 CSV 와 같은 규칙) → 84만 행을 JSON 문서로 저장하지 않음.
- 적재는 `places_new` 에 COPY 후 인덱스(GiST·trigram·category) 생성 → 한 트랜잭션에서 교체 → 갱신 중에도 서비스 유지.
- 내 코스는 브라우저(localStorage)에만 저장, 공유 링크(`?route=my-route&stops=a,b`)로 전달. 코스 순서 색(`ORDER_COLORS`)은 흰 글자 대비 4.5:1 이상을 단위 테스트로 보장.
- 경로 엔진은 외부에 공개하지 않고(Railway 내부망) 앱 API 를 거쳐 호출 → 분당 호출 제한·결과 캐시.

## 9. 알려진 한계

- 동네 모드는 1,222곳 전체를 서버 컴포넌트가 클라이언트로 전달 → `index.html` 약 1.4MB(gzip 약 76KB). 더 큰 데이터는 전국 모드(§8-1)를 사용합니다.
- 전국 모드 검색은 이름·주소·업종 부분 일치(trigram 인덱스)이며, 검색 결과 전체 범위로 지도를 옮긴 뒤 목록은 화면 기준입니다(전국에 흩어진 체인점은 넓게 보임).
- 전국 모드 OSM 명소는 전주 일대 46곳뿐입니다(전국 관광지는 진흥공단 데이터에 없음 → 한국관광공사 TourAPI 연동이 다음 단계).
- 세부 종류(진흥공단 업종명)는 한국어만 있어 영어 화면에서도 한국어로 보입니다.
- OSM 영업시간은 원문 형식(`Mo-Su 09:00-17:00`) 그대로 표시합니다.
