# 5차시. 첫 지도 만들기

⏱ 25분 (개념 6 · 실습 15 · 정리 4) · 결과물: **장소가 표시된 지도**

## 학습 목표
- 지도 라이브러리(MapLibre)와 타일·스타일의 개념을 안다.
- CSV 데이터가 지도 마커로 바뀌는 흐름을 이해한다.
- 마커 클릭 시 팝업이 뜨는지 확인한다.

## 선수 준비사항
- 4차시 저장소, `data/places.csv` (3차시 결과 또는 샘플).
- 코드: `components/map/MapView.tsx`, `lib/data/parse.ts`, `lib/data/load.ts`, `app/page.tsx`

## 강사 설명 핵심 개념
1. **지도 = 스타일 + 타일 + 라이브러리.** 스타일(URL)이 "어떻게 그릴지", 타일이 "데이터 조각". MapLibre 는 무료 오픈소스, OpenFreeMap 은 키 없이 쓰는 스타일/타일.
2. **출처 표시는 의무**: 지도 오른쪽 아래 © 표기를 지우지 않는다.
3. **데이터 흐름**: `places.csv` → (서버) 읽기·검증 → props → `MapView` 마커.
4. **브라우저에서만**: 지도는 브라우저 기술(WebGL) → `dynamic(..., { ssr:false })` 로 로드해야 서버 오류가 없다.
5. 지도 코드와 데이터 코드는 **분리** (지도는 그리기만).

## 단계별 실습
1. `config/site.ts` 의 `region.center` / `zoom` 을 내 동네로 변경 (**[경도, 위도]**).
2. `npm run dev` → 마커가 내 동네에 찍혔는지 확인. 안 보이면 우측 **전체 보기(⤢)** 버튼.
3. 마커를 눌러 팝업(장소명·카테고리) 확인.
4. 개발자 도구(F12) → Console 에 빨간 오류가 없는지 확인.
5. (선택) `data/categories.json` 의 `color` 를 바꿔 마커 색을 바꿔 본다.

## AI 코딩 도구용 실습 프롬프트
시작 템플릿에 지도가 없는 경우(강사 제공 `starter` 기준) 다음처럼 요청합니다. 완성본에서는 이미 구현되어 있으므로 **읽고 설명**만 시켜도 좋습니다.
```text
Next.js App Router + TypeScript 프로젝트입니다. MapLibre GL JS 로 지도를 추가해 주세요.
- 새 파일 components/map/MapView.tsx 를 만들고 기존 파일은 덮어쓰지 마세요. 이미 있으면 멈추고 알려 주세요.
- 지도 스타일 URL: https://tiles.openfreemap.org/styles/liberty (환경변수 NEXT_PUBLIC_MAP_STYLE_URL 로 교체 가능하게)
- props 로 장소 배열(places)을 받아 각 장소에 마커를 표시하고, 마커 클릭 시 장소명이 팝업으로 보이게 해 주세요.
- 팝업 내용은 innerHTML 대신 textContent 로 넣어 주세요.
- 지도는 브라우저에서만 초기화하고 Next.js 서버 렌더링 오류가 없게 next/dynamic ssr:false 로 불러 주세요.
- 지도 출처 표시(attribution)를 제거하지 마세요.
- 완료 후 npm run typecheck 와 npm run build 를 실행해 결과를 알려 주세요.
```

## 예상 결과물
내 동네 지도 위에 장소 마커 30개, 팝업 동작.

## 정상 작동 확인 방법
- 마커 개수 = CSV 행 수 (화면 "30곳" 표시). 완성본처럼 장소가 수백 곳 이상이면 숫자 클러스터로 묶여 보입니다(확대하면 풀림).
- 오른쪽 아래에 OpenFreeMap/OpenStreetMap 출처가 보인다.
- 지도를 끌고 확대·축소할 수 있다.
- 자동 확인: `npm run test:e2e -- -g "마커 30개"`.

## 초보자가 겪을 수 있는 오류 → 해결
| 증상 | 해결 |
|---|---|
| `window is not defined` / `document is not defined` | 지도를 서버에서 불러옴 → `dynamic(..., {ssr:false})` 확인 |
| 지도가 회색·베이지 빈 화면 | 타일 로딩 중/인터넷 끊김. 기다리거나 새로고침 |
| 마커가 바다에 찍힘 | 위도·경도가 바뀜 |
| 지도에 "Worker failed to load" 콘솔 오류, 배경만 비어 있음 | `npm run predev`(워커 복사) 실행 후 재시작 — 완성본은 `public/maplibre/` 로 해결 |
| "지도를 불러오지 못했습니다" | WebGL 비활성/네트워크. **다시 시도** 버튼, 하드웨어 가속 켜기 |
| 팝업에 `<b>` 태그 글자가 그대로 보임 | 정상(안전하게 텍스트로 처리). HTML을 넣지 않는다 |

## 학습 정리
스타일·타일·출처, CSV → 마커, 서버/브라우저 분리.

## 복습 퀴즈
**Q1. 지도를 Next.js에서 `ssr:false` 로 불러오는 이유는?**
① 속도 ② 지도는 브라우저 전용 기능(WebGL)을 쓰기 때문 ③ 디자인 ④ 비용
**정답: ②**

**Q2. 지도 오른쪽 아래 출처 표시는?**
① 지워도 된다 ② 항상 유지해야 한다 ③ 모바일에서만 ④ 배포할 때만
**정답: ②**

**Q3. `region.center` 에 들어갈 값 순서는?**
① [위도, 경도] ② [경도, 위도] ③ [줌, 위도] ④ 이름
**정답: ②**
