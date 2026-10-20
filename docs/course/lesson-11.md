# 11차시. 인터넷에 공개하고 SNS에 연결하기

⏱ 25분 (개념 5 · 실습 16 · 정리 4) · 결과물: **공개 URL과 QR코드**

> 배포는 **본인 계정으로 직접** 합니다(AI에게 계정·토큰을 주지 않습니다). 상세 단계: [docs/DEPLOYMENT.md](../DEPLOYMENT.md)

## 학습 목표
- GitHub → Vercel 자동 배포 흐름을 이해한다.
- 환경변수를 안전하게 등록한다.
- 공개 URL·QR·공유 링크(코스/장소)를 만들고 테스트한다.

## 선수 준비사항
- 4차시 GitHub 저장소(최신 코드 push 완료), Vercel 계정(GitHub 로그인).
- `npm run validate:data` 와 `npm run build` 가 로컬에서 통과.

## 강사 설명 핵심 개념
1. **배포 = 코드가 인터넷의 서버에서 실행되게 하는 것.** GitHub에 push → Vercel이 감지 → 빌드 → 공개.
2. **빌드가 검증한다**: 데이터 오류가 있으면 빌드 실패 → 기존 사이트 유지(안전장치).
3. **환경변수**: 비밀 값은 Vercel Settings → Environment Variables. `ORS_API_KEY`(선택), `NEXT_PUBLIC_ENABLE_ANALYTICS`(선택). 바꾸면 **재배포** 필요.
4. **공유 링크 구조**: `https://내주소/?route=<routeId>&place=<placeId>` → 열면 자동 선택. 잘못된 값은 무시.
5. **QR 은 배포 주소로**: 로컬(localhost) QR 은 남이 열 수 없다(화면에 안내).

## 단계별 실습
1. 로컬 확인: `npm run validate:data && npm run build`.
2. `git add . && git commit -m "배포 준비" && git push`
3. Vercel → **Add New → Project** → 저장소 **Import** → **Deploy**.
4. 배포 주소 열기: 지도·마커·코스·EN 확인(DEPLOYMENT.md §4 체크리스트).
5. **공유** 버튼 → 범위(전체/코스/장소) 선택 → **링크 복사**, **QR 이미지 저장**. 주소가 `https://…` 이고 "로컬 주소" 안내가 **없는지** 확인.
6. 휴대폰으로 QR 스캔 → 해당 코스가 바로 열리는지 확인.
7. SNS 프로필 링크에 공개 주소 등록(실제 계정 설정은 본인 선택).
8. (선택) 환경변수 `ORS_API_KEY` 등록 → **Redeploy**.

## AI 코딩 도구용 실습 프롬프트
```text
이 프로젝트를 Vercel 에 배포하기 전 점검해 주세요. 파일은 수정하지 말고 보고만 해 주세요.
1) .gitignore 에 .env* 가 제외되어 있고 git 이력에 비밀 키가 없는지(git ls-files 로 .env 파일 추적 여부 확인)
2) npm run validate:data, npm run typecheck, npm run lint, npm run build 결과
3) .env.example 의 항목과 README 의 환경변수 설명이 일치하는지
실제 배포·push 는 하지 마세요(제가 직접 합니다).
```

## 예상 결과물
`https://<프로젝트>.vercel.app` 공개 주소, 전체·코스·장소 링크, QR 이미지 파일.

## 정상 작동 확인 방법
- 공개 주소에서 마커 30개, 코스 3개, EN 전환 동작.
- 공유 링크 `?route=…&place=…` 로 접속 시 해당 코스·장소가 선택됨.
- QR 스캔 → 같은 화면.
- 로컬에서 `npm run test:e2e -- -g "공유"` 통과.

## 초보자가 겪을 수 있는 오류 → 해결
| 증상 | 해결 |
|---|---|
| Vercel 빌드 실패 `데이터 검증 실패` | 로그의 `places.csv ○행` 수정 → push |
| `git push` 거부(권한/원격) | 저장소 주소·로그인 확인 |
| 배포했는데 예전 화면 | Deployments 에서 **Ready** 확인, 브라우저 강력 새로고침 |
| QR이 안 열림 | localhost 주소로 만든 QR → 공개 주소에서 다시 생성 |
| 이동시간 버튼이 없음 | 환경변수 추가 후 **Redeploy** 안 함 |
| 키가 GitHub에 올라감 | 즉시 키 폐기·재발급 |

## 학습 정리
push → 자동 빌드·검증 → 공개. 비밀은 환경변수. QR은 공개 주소로.

## 복습 퀴즈
**Q1. 데이터에 오류가 있는 채 push 하면 Vercel은?**
① 그대로 배포 ② 빌드가 실패하고 기존 사이트가 유지된다 ③ 사이트 삭제 ④ 자동 수정
**정답: ②**

**Q2. 환경변수를 바꾼 뒤 필요한 것은?**
① 아무것도 ② 재배포(Redeploy) ③ 저장소 삭제 ④ 도메인 변경
**정답: ②**

**Q3. 공유 링크로 접속하면?**
① 항상 첫 화면 ② 링크에 담긴 코스·장소가 자동 선택된다 ③ 로그인 요구 ④ 새 지도 생성
**정답: ②**
