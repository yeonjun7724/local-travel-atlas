# 빈 폴더에서 단계별로 만들기

> 각 프롬프트 앞에 [00-common-rules.md](00-common-rules.md)를 붙이세요. 완성본(이 저장소)과 파일 이름·구조를 맞추면 이후 차시 문서와 충돌하지 않습니다.
> **이미 파일이 있으면 AI가 "이미 있습니다"라고 멈추게 되어 있습니다** — 덮어쓰기 방지.

## 4차시 — 프로젝트 초기화
```text
빈 폴더(또는 지금 폴더)에 Next.js(App Router) + TypeScript(strict) + Tailwind CSS 프로젝트를 만들어 주세요.
- 폴더가 비어 있지 않다면 멈추고 어떤 파일이 있는지 알려 주세요.
- 폴더 구조: app/, components/{map,places,routes,layout,common}/, lib/{data,map,routing,i18n,validation}/, data/, public/images/, docs/, scripts/, tests/
- .gitignore 에 .env* (단 .env.example 제외), node_modules, .next 를 포함해 주세요.
- 완료 후 npm run dev 가 실행되고 첫 화면에 서비스 이름이 보이는지 확인해 주세요.
```

## 5차시 — 장소 데이터 + 지도
```text
data/places.csv 의 장소를 읽어 지도에 마커로 표시해 주세요.
- 데이터: PapaParse 로 CSV 를 읽고 Zod 로 검증(필수 열: id,nameKo,nameEn,latitude,longitude,category,theme,descriptionKo,descriptionEn,address,imageUrl,source,license). 서버 파일(lib/data/load.ts)에서 fs 로 읽고, 순수 파싱 함수(lib/data/parse.ts)는 fs 를 쓰지 않게 분리해 주세요.
- 검증: id 중복, 좌표 범위, 필수 값 누락, URL 형식(http/https 만), 존재하지 않는 category, 깨진 문자(�)를 오류로 알려 주세요. npm run validate:data 명령도 만들어 주세요.
- 지도: MapLibre GL JS, 스타일 https://tiles.openfreemap.org/styles/liberty (환경변수로 교체 가능), 브라우저에서만 초기화(next/dynamic ssr:false), 출처 표시 유지.
- 마커 클릭 시 장소명·카테고리 팝업(innerHTML 금지, textContent 사용).
- 지도 컴포넌트(components/map/MapView.tsx)는 props 로 받은 장소만 그리고, 필터·검색 같은 로직은 넣지 마세요.
- 지도 스타일을 못 불러오면 안내 문구와 '다시 시도' 버튼을 보여 주세요.
- 마커를 HTML 버튼 요소(data-testid="marker-<id>", aria-label=장소명)로 만들어 주세요.
```

## 6차시 — 필터·검색·목록
```text
장소 테마 필터와 검색, 장소 카드 목록을 만들어 주세요.
- 카테고리는 data/categories.json 에서 읽어 칩으로 표시(하드코딩 금지). '전체' 칩 포함.
- lib/data/filter.ts 에 순수 함수 filterPlaces(places,{category,query}) 를 만들고 이름(한/영)·태그·주소로 검색해 주세요.
- 필터 결과 하나의 배열을 목록과 지도 마커가 함께 사용해 항상 개수가 같아야 합니다. "N곳" 표시, 결과 없음 안내, 필터 초기화 버튼 포함.
- 마커 클릭 → 목록의 해당 카드 활성화(aria-current)와 상세 펼침, 목록 클릭 → 지도 이동과 팝업.
- 카드 상세: 설명, 주소, 영업시간, 태그, 출처/라이선스, 외부 길찾기(target=_blank rel="noopener noreferrer"), 이미지가 없으면 카테고리 색 플레이스홀더.
```

## 7차시 — 코스 3종
```text
data/routes.json 의 추천 코스 3종을 보여 주는 '추천 코스' 탭을 만들어 주세요.
- 필드: routeId,titleKo,titleEn,descriptionKo,descriptionEn,theme,placeIds(방문 순서),transportMode(walking|driving). Zod 로 검증하고 placeIds 가 CSV 의 id 인지, 한 코스 안에서 중복이 없는지 검사해 주세요.
- 코스를 선택하면 그 장소만 번호(1,2,3…) 마커로 표시, 장소 사이를 점선 직선으로 연결(GeoJSON line 레이어), 코스 범위에 맞춰 지도 이동, 방문 순서 목록 표시.
- 점선이 실제 도로 경로가 아니라 직선 연결선이라는 안내 문구를 코스 화면에 항상 보여 주세요. 이동시간을 표시하지 마세요(이번 단계에서는 API 없음).
```

## 8차시 — 이동시간 (선택)
```text
선택 기능으로 OpenRouteService 실제 경로·이동시간을 추가해 주세요.
- 서버 API Route(app/api/route/route.ts): POST {routeId, mode(walking|driving)} 만 받고 Zod 로 검증, 좌표는 서버가 data/ 에서 조회(클라이언트 좌표 신뢰 금지).
- API 키는 process.env.ORS_API_KEY (서버 전용). 키가 없으면 503 {error:"not_configured"}, 한도 초과는 429, 시간 초과(8초)는 504, 기타 502.
- 같은 코스·이동수단 결과는 서버 메모리에 캐시하고 분당 호출 수를 제한해 주세요.
- 화면: 키가 설정된 경우에만 '이동시간 불러오기' 버튼. 성공하면 총/구간별 거리·시간과 실선 경로, 실패하면 안내 문구만(가상의 시간 표시 절대 금지). 키가 없으면 안내 문구.
- API 키를 코드/문서/예시에 쓰지 말고 .env.example 에는 빈 값(ORS_API_KEY=)만 넣어 주세요.
- 네트워크 없이 mock fetch 로 하는 단위 테스트(정상/429/500/형식 오류/네트워크 실패)를 추가해 주세요.
```

## 9차시 — 모바일 + 내 위치
```text
화면 폭 768px 미만에서는 지도를 전체 화면으로 두고 하단 시트(바텀시트: 접힘/절반/전체)에 장소·코스 패널을 넣어 주세요. 테마 칩은 지도 위쪽에 가로 스크롤로 띄워 주세요.
- 768px 이상에서는 왼쪽 패널 + 오른쪽 지도.
- 모든 버튼은 높이 약 44px 이상. 시트 안에서만 스크롤되게(overscroll-behavior: contain).
- '내 위치' 버튼: 사용자가 누를 때만 navigator.geolocation 호출, 접속 시 자동 요청 금지, 좌표는 서버로 보내거나 저장하지 않기. 허용하면 파란 점으로 표시하고 이동, 거부/실패/시간초과 시 각각 안내 문구.
```

## 10차시 — 다국어
```text
한국어/영어 전환을 추가해 주세요.
- 문구 사전: lib/i18n/ko.ts(기준)와 en.ts(Record<MessageKey,string> 으로 키 일치를 타입이 검사).
- 장소·코스의 영어 값(nameEn, descriptionEn, titleEn)이 비어 있으면 한국어로 대체하고 '영어 번역이 없어 한국어로 표시됩니다' 안내를 보여 주세요.
- 언어는 localStorage 에 저장해 새로고침 후에도 유지(저장소 접근 실패 시 기본 언어로 동작), <html lang> 갱신.
- 서버 렌더링과 클라이언트 첫 렌더가 달라 생기는 hydration 오류가 없게 useSyncExternalStore 를 사용해 주세요.
```

## 11차시 — 공유·QR
```text
공유 기능을 만들어 주세요.
- lib/share.ts: buildShareUrl(base,{routeId,placeId}) 와 parseShareParams(search, 유효한 장소 id 집합, 유효한 코스 id 집합). 형식(/^[a-z0-9-]{1,64}$/)이 틀리거나 존재하지 않는 값은 무시.
- 첫 진입 시 URL 의 route/place 를 읽어 해당 코스·장소 자동 선택, 선택이 바뀌면 history.replaceState 로 주소창 갱신.
- 공유 대화상자(<dialog>): 범위(전체/현재 코스/현재 장소), URL 복사, QR 코드(qrcode 패키지)와 PNG 저장, navigator.share 가 있으면 '다른 앱으로 공유'. localhost/사설 IP 주소일 때는 '로컬 주소이므로 배포 주소에서 QR 을 만드세요' 안내.
```

## 12차시 — 방문 통계
```text
Vercel Web Analytics 를 설정으로 켜고 끌 수 있게 추가해 주세요.
- @vercel/analytics 의 Analytics 컴포넌트를 NEXT_PUBLIC_ENABLE_ANALYTICS 가 "true" 일 때만 app/layout.tsx 에서 렌더링.
- 커스텀 이벤트·별도 수집 코드는 추가하지 말고, 코스별 인기도는 기본 조회수로 알 수 없다는 점을 docs/OPERATIONS.md 에 적어 주세요.
```
