# 3차시. AI로 동네 자료 모으기

⏱ 25분 (개념 7 · 실습 14 · 정리 4) · 결과물: **장소 데이터 30개** (`data/places.csv`)

## 학습 목표
- 관광 공공데이터와 직접 답사의 차이를 안다.
- 위도·경도를 확인하고 CSV로 정리한다.
- **출처·라이선스**를 기록하고, 검증 명령으로 오류를 찾는다.

## 선수 준비사항
- 2차시 기획안, 구글 시트/엑셀 또는 VS Code.
- 강사 제공 `data/places.csv` 샘플(가상 30곳)과 `npm run validate:data` 가 실행되는 템플릿.

## 강사 설명 핵심 개념
1. **데이터 출처 3종**: ① 직접 답사(가장 안전) ② 공공데이터포털·한국관광공사 TourAPI 등(**이용허락범위 확인**) ③ 지도·SNS 사진·리뷰 복사는 **금지**(저작권·약관).
2. **좌표**: 위도(latitude, 남북) · 경도(longitude, 동서). 지도에서 우클릭해 복사 후 **마커가 실제 입구 근처인지** 눈으로 확인.
3. **필수 열**: `id, nameKo, nameEn, latitude, longitude, category, theme, descriptionKo, descriptionEn, address, imageUrl, source, license` (설명은 README §5).
4. **AI의 역할**: 내가 모은 메모를 CSV 형식으로 *정리·번역*. **AI에게 장소를 만들어 내게 하지 않는다.** 확인 안 된 정보는 비워 두거나 "확인 필요" 표기.
5. 샘플 30곳은 **가상 데이터**(`isSample=true`). 실제 데이터로 바꿀 때 `false`.

## 단계별 실습
1. `data/places.csv` 를 복사해 백업(`places.sample.csv`)하고, 내 동네 장소 **5곳**부터 직접 입력(나머지는 숙제로 30곳).
2. 각 장소: 이름·좌표·주소·한 줄 설명·`source`(예: "직접 답사 2026-10-12")·`license`(예: "직접 작성").
3. CSV UTF-8 로 저장.
4. 터미널에서 `npm run validate:data` 실행 → `✅` 또는 `❌ places.csv ○행 …` 확인 후 수정.
5. 공공데이터를 쓴다면: 데이터 이름·URL·**이용허락범위**를 `source`·`license` 에 기록.

## AI 코딩 도구용 실습 프롬프트
```text
아래는 제가 직접 답사해 적은 메모입니다(장소명, 주소, 느낌, 좌표).
이 내용을 data/places.csv 의 열 형식에 맞게 CSV 행으로 정리해 주세요.
규칙:
- 헤더는 id,nameKo,nameEn,latitude,longitude,category,theme,descriptionKo,descriptionEn,address,imageUrl,source,license,openingHours,tags,externalUrl,recommendedDurationMinutes,updatedAt,isSample 입니다.
- id 는 영문 소문자-하이픈. category/theme 는 data/categories.json 에 있는 id 만 사용.
- 제가 주지 않은 정보(영업시간, 전화, 좌표 등)는 비워 두고 지어내지 마세요.
- source 는 "직접 답사", license 는 "직접 작성" 으로 넣어 주세요.
- 쉼표가 들어가는 값은 큰따옴표로 감싸 주세요.
- 기존 data/places.csv 를 덮어쓰지 말고, 결과를 새 파일 data/my-places.csv 로 만들어 주세요.
메모: <여기에 붙여넣기>
```
(새 파일의 내용을 확인한 뒤 `places.csv` 에 직접 합칩니다.)

## 예상 결과물
`data/places.csv` 에 내 장소 30행, `npm run validate:data` 통과.

## 정상 작동 확인 방법
```bash
npm run validate:data
# ✅ 데이터 검증 통과: 장소 30곳, 코스 3개 …
```
`npm run dev` 에서 마커 30개가 내 동네에 찍혀 있다.

## 초보자가 겪을 수 있는 오류 → 해결
| 메시지 / 증상 | 원인 → 해결 |
|---|---|
| `깨진 문자(�)` | CSV가 UTF-8 아님 → 엑셀 "CSV UTF-8" 로 저장 |
| `latitude: …` 범위 오류 | 위도·경도 바뀜/한 칸 밀림 → 열 위치 확인 |
| `존재하지 않는 category` | `categories.json` 의 id 와 철자 불일치 |
| `장소 id 중복` | id 가 같은 행 → 하나를 고유한 값으로 |
| 한 행의 열이 밀림 | 설명에 쉼표 → `"…, …"` 로 감싸기 |
| 마커가 바다/엉뚱한 곳 | 좌표 소수점·부호 오류 → 지도에서 다시 복사 |
| 좌표는 맞는데 코스 검증 실패 | `routes.json` 이 예전 샘플 id를 참조 → 7차시에서 교체 (그 전에는 샘플 routes 유지) |

## 학습 정리
데이터의 품질은 **출처·좌표·라이선스**. AI는 정리 담당, 사실 확인은 사람이.

## 복습 퀴즈
**Q1. 장소의 사진을 구글 지도에서 저장해 쓰는 것은?**
① 괜찮다 ② 직접 촬영·허가된 사진만 사용해야 한다 ③ 리뷰만 가져오면 된다 ④ 출처만 쓰면 항상 된다
**정답: ②**

**Q2. CSV에서 한글이 깨질 때 해결책은?**
① 글꼴 변경 ② UTF-8로 저장 ③ 좌표 삭제 ④ id 변경
**정답: ②**

**Q3. AI에게 장소 정보를 정리시킬 때 올바른 지시는?**
① 근처 맛집을 만들어 채워 줘 ② 내가 준 메모만 정리하고 모르는 값은 비워 줘 ③ 영업시간을 추측해서 채워 줘 ④ 좌표를 대충 넣어 줘
**정답: ②**
