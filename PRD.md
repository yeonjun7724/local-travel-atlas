# PRD — LOCAL ATLAS (우리 동네 여행 지도)

## 1. 서비스 목적

지역 크리에이터가 글·영상으로 흩어져 있던 동네 정보를 **지도 하나**로 모아, **공개 URL·QR 하나로 공유**할 수 있게 한다. 동시에 비전공자가 **AI 코딩 도구로 첫 웹서비스를 제작·배포**하는 12차시 교육의 실습 결과물이다.

**성공 기준**
- 수강생이 12차시 안에 "장소 30곳 + 코스 3종 + 모바일 + 공개 URL"을 완성한다.
- 서비스는 DB·로그인·유료 서비스 없이 무료로 운영 가능하다.
- LLM 기반 코스 자동 추천은 **범위 밖**이다 (AI는 개발 보조 도구).

## 2. 사용자 페르소나

| 구분 | 설명 |
|---|---|
| 제작자 · 정하늘(31) | 동네 빵집·산책길을 SNS에 소개. 링크 하나로 공유할 동네 지도가 필요. 코딩 경험 없음 |
| 방문객 · 여행자 | 스마트폰으로 링크/QR를 열어 코스를 따라 걷는다. 외국인 방문객은 영어 화면 사용 |
| 강사 | 완성본을 시연하고 수강생 진행을 점검 |

## 3. 주요 기능 (우선순위)

**P0 (필수)** 지도·마커·팝업 / 장소 CSV·검증 / 테마 필터·검색 / 장소 상세 / 코스 3종(번호·직선 연결선) / 반응형 UI / 공개 배포
**P1** 현재 위치 / 한·영 / 공유 링크·QR / 이동시간(선택 API)
**P2** Vercel Web Analytics / 운영 점검표

## 4. 사용자 시나리오

1. **방문객(모바일)** QR 스캔 → 지도 + 하단 시트 → "카페" 칩 선택 → 마커 탭 → 상세·길찾기.
2. **방문객** "추천 코스" → 코스 선택 → 번호 마커·점선 확인 → 순서대로 방문지 목록 확인.
3. **외국인 방문객** EN 전환 → 영어 장소명·설명(없으면 한국어+안내).
4. **제작자** CSV에 장소 추가 → `npm run validate:data` → `git push` → Vercel 자동 재배포.
5. **제작자** 코스 공유 → 공유 대화상자 → 링크 복사/QR 저장 → SNS 프로필에 연결.

## 4-1. 사용자 스토리 수용 기준 (발췌)

- 필터를 바꾸면 지도 마커 수와 목록 수가 **항상 같다**.
- 마커를 누르면 목록의 해당 항목이 활성화(`aria-current`)되고 상세가 펼쳐진다.
- 공유 링크(`?route=…&place=…`)를 열면 해당 코스/장소가 선택된다. 잘못된 값은 무시한다.
- 경로 API 키가 없거나 실패해도 지도·코스는 정상 동작하며, 가상의 이동시간을 표시하지 않는다.
- 접속만으로 위치 권한을 요청하지 않는다.

## 5. 데이터 구조

**places.csv** (CSV → Zod 검증 → `Place`)

필수: `id, nameKo, nameEn, latitude, longitude, category, theme, descriptionKo, descriptionEn, address, imageUrl, source, license`
선택: `openingHours, tags(|), externalUrl, recommendedDurationMinutes, updatedAt, isSample`

> `nameEn`/`descriptionEn` 열은 필수이나 값은 비울 수 있다(폴백 정책: 한국어로 대체 + 안내). 나머지 필수 값 누락은 오류.

**routes.json** `routeId, titleKo, titleEn, descriptionKo, descriptionEn, theme, placeIds[], transportMode(walking|driving)`
**categories.json** `categories[{id,labelKo,labelEn,color,icon}]`, `themes[{id,labelKo,labelEn}]`

**검증 규칙** id 중복 / 좌표 범위 / 필수 값 / URL 형식(http·https만) / 없는 category·theme / 깨진 문자(U+FFFD) / 코스 참조 id 유효·중복 / BOM 허용

## 6. 비기능 요구사항

| 영역 | 요구 |
|---|---|
| 성능 | 최초 화면은 정적 생성(SSG), 지도는 클라이언트 전용 로드 |
| 접근성 | 버튼·칩에 `aria-*`, 키보드 조작 가능한 HTML 마커, 최소 터치 영역 44px 목표(검증 ≥40px), `prefers-reduced-motion` |
| 보안 | API 키 서버 전용, `.env` 미추적, 입력(쿼리·API) Zod/정규식 검증, 팝업 `textContent`, 외부 링크 `rel="noopener noreferrer"`, API 타임아웃 8초, 오류 경계 |
| 프라이버시 | 위치 서버 미저장·클릭 시 요청, 방문 통계는 플랫폼 기본 지표만 |
| 라이선스 | 지도 출처 표시 항상 유지, 장소별 `source`/`license` 보관, 직접 촬영 사진 기본 |
| 비용 | 무료 구성(Vercel Hobby, OpenFreeMap, ORS 무료 티어·선택) |
| 호환 | 최신 Chrome/Safari/Edge, WebGL 필요(없으면 안내) |

## 7. 범위 제외

LLM 코스 자동 추천, DB·로그인·관리자 페이지, SNS 콘텐츠 제작, 코스별 인기도 집계(별도 이벤트 수집 필요 → 선택 확장).

## 8. 확장 계획

1. 데이터 계층 교체: `lib/data/load.ts` 만 바꿔 CMS(Notion/Airtable/Sheets)·DB 연결
2. 관리자 페이지(인증 추가)
3. 코스별 인기도: 사용자 이벤트(코스 선택·공유) 수집 + 별도 집계 (Vercel 커스텀 이벤트는 플랜에 따라 제한 → 확인 후 도입)
4. 지역별 템플릿화(`config/site.ts` + `data/`), 지자체 양성교육(B2G)
5. 언어 추가(`lib/i18n/` 사전 + CSV 열)
