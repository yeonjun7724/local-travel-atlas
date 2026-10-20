# 12차시 진행표

강의명: 나도 지역 크리에이터! AI로 만드는 '우리 동네 여행 지도' · 1차시 = 약 25분(영상 기준), 실습 시간은 개인별 추가

| 차시 | 주제 | 핵심 | 결과물 | 구현 위치(완성본) | 문서 |
|---|---|---|---|---|---|
| 1 | 지역 크리에이터에게 지도가 왜 무기가 될까? | 완성 서비스 시연, 지도형 콘텐츠 | 서비스 한 문장 | 전체 | [lesson-01](course/lesson-01.md) |
| 2 | 우리 동네에서 나만 아는 주제 찾기 | 지역·테마·방문객 | 여행 지도 기획안 | `data/categories.json`, `config/site.ts` | [lesson-02](course/lesson-02.md) |
| 3 | AI로 동네 자료 모으기 | 공공데이터·답사·CSV·좌표·라이선스 | 장소 30곳 | `data/places.csv`, `lib/validation/`, `scripts/validate-data.ts` | [lesson-03](course/lesson-03.md) |
| 4 | AI에게 개발을 시키는 방법 | PRD·프롬프트·GitHub | PRD·저장소 | `PRD.md`, `docs/prompts/` | [lesson-04](course/lesson-04.md) |
| 5 | 첫 지도 만들기 | MapLibre·마커·팝업 | 첫 지도 | `components/map/MapView.tsx`, `lib/data/` | [lesson-05](course/lesson-05.md) |
| 6 | 테마별로 골라 보는 지도 | 필터·카드·검색 | 테마 지도 | `lib/data/filter.ts`, `components/places/` | [lesson-06](course/lesson-06.md) |
| 7 | 나만의 추천 코스 3종 | 코스 순서·번호·직선 연결선 | 코스 3종 시각화 | `data/routes.json`, `components/routes/` | [lesson-07](course/lesson-07.md) |
| 8 | 추천 코스에 이동시간 붙이기 *(선택)* | 경로 API·키·비용 | 코스 상세·API 예제 | `app/api/route/`, `lib/routing/ors.ts` | [lesson-08](course/lesson-08.md) |
| 9 | 휴대폰에서 보기 좋게 다듬기 | 반응형·바텀시트·내 위치·브랜딩 | 모바일 지도 | `components/AtlasApp.tsx`, `app/theme.css` | [lesson-09](course/lesson-09.md) |
| 10 | 외국인 방문객용 다국어 화면 | 사전·AI 번역·폴백 | 다국어 지도 | `lib/i18n/` | [lesson-10](course/lesson-10.md) |
| 11 | 인터넷에 공개하고 SNS에 연결하기 | Vercel·환경변수·QR·공유 | 공개 URL·QR | `components/common/ShareDialog.tsx`, `lib/share.ts` | [lesson-11](course/lesson-11.md) |
| 12 | 조회 통계로 인기 코스 찾고 지도 키우기 | 기본 통계의 한계·운영 | 운영 점검표 | `app/layout.tsx`, `docs/OPERATIONS.md` | [lesson-12](course/lesson-12.md) |

**필수 완성 범위**: 장소 목록 → 마커·팝업 → 테마 필터 → 코스 3종 → 모바일 → 공개 URL. 이동시간 API(8)·다국어(10)·통계(12)는 사전 템플릿 활용·선택 확장.

## 강사 사전 준비사항

- [ ] **GitHub 시작 템플릿**: 이 저장소는 *완성본*이다. 단계별 시작점(예: 4차시 시작, 5차시 시작 …)은 아래 "코드 스냅샷 전략"대로 강사가 만들어 배포해야 한다 (현재 자동 생성하지 않음).
- [ ] **샘플 장소 CSV**: `data/places.csv`(가상 30곳, `isSample=true`)를 수강생용으로 복사 제공. 실제 동네 샘플을 쓸 경우 출처·이용허락 확인.
- [ ] **지도 설정 가이드**: 별도 키 불필요(OpenFreeMap). 회사망·교육장 방화벽에서 `tiles.openfreemap.org` 접근 가능 여부 사전 점검, WebGL 켜진 브라우저 확인.
- [ ] **경로 API(선택)**: OpenRouteService 계정·키 발급 → 무료 한도·약관 사전 확인 → 시연용 키는 강사가 `.env.local` 로만 사용(화면 공유 주의). 수강생은 키 없이도 완주 가능.
- [ ] **배포 예제**: 강사 Vercel 계정으로 완성본 1회 배포해 둔다(데모 URL·QR). 수강생은 본인 GitHub/Vercel 계정 필요(사전 가입 안내).
- [ ] **차시별 프롬프트**: `docs/prompts/` 배포. 비밀 키를 붙이지 않도록 1차시·4차시에 안내.
- [ ] **경쟁 강의 조사**: 유사 강의의 가격·난이도·산출물 비교는 별도 검토(기획안 미결 사항).
- [ ] 사진·장소 정보 라이선스 안내(직접 촬영 기본).
- [ ] 로컬 점검: `npm install && npm run validate:data && npm test && npm run build`

## 코드 스냅샷 전략 (제안 — 아직 생성하지 않음)

완성본과 단계별 시작점이 충돌하지 않도록 **Git 태그**를 권장한다. 이 저장소에서는 실제 브랜치·태그를 만들지 않았다(각 차시 시점 코드를 따로 만들고 빌드·테스트까지 검증해야 하므로 별도 작업). 만들 때 순서:

1. 완성본 커밋에 태그 `lesson-12-complete`.
2. 완성본에서 기능 파일을 제거/단순화해 `lesson-04-start` → … → `lesson-11-start` 를 역방향으로 만들고, 각 태그에서 `npm run build` 와 해당 차시 e2e 가 통과하는지 확인.
3. 차시 문서의 파일 경로·프롬프트는 완성본 기준이므로, 태그마다 문서가 가리키는 파일이 존재하는지 점검.

수강생에게는 `git checkout lesson-05-start` 대신 **새 브랜치**(`git switch -c my-lesson-05 lesson-05-start`)로 시작하도록 안내하면 본인 작업을 덮어쓰지 않는다.

## 수강생 최종 점검표

- [ ] 장소 30곳, `npm run validate:data` 통과
- [ ] 코스 3종(5~8곳), 번호·점선·방문 순서 목록
- [ ] 모바일 화면 확인
- [ ] 공개 URL·QR(공개 주소 기준)
- [ ] 출처·라이선스 기록, 직접 촬영 사진만 사용
- [ ] 운영 점검표 작성
