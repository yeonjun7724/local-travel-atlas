# 배포 가이드 — GitHub 저장소 만들기부터 공개 URL 확인까지

> 이 문서의 외부 서비스(GitHub·Vercel) 작업은 **본인 계정으로 직접** 합니다. 비밀번호·API 키는 AI 채팅창에 붙여 넣지 마세요.

## 0. 시작 전 체크

```bash
npm run validate:data   # ✅ 통과해야 함
npm run build           # 오류 없이 끝나야 함
```

## 1. GitHub 저장소 만들기

1. <https://github.com> 로그인 → 오른쪽 위 **＋ → New repository**
2. Repository name: `local-travel-atlas` (원하는 이름), **Public**(또는 Private) 선택
3. "Add a README" 등은 **체크하지 않고** **Create repository**

## 2. 내 컴퓨터의 프로젝트를 올리기

```bash
git status                       # .env.local 같은 비밀 파일이 목록에 없어야 함
git add .
git commit -m "내 동네 여행 지도 첫 버전"
git branch -M main
git remote add origin https://github.com/<내아이디>/<저장소이름>.git
git push -u origin main
```

- `.env.local` 은 `.gitignore` 로 제외됩니다. 혹시 올라갔다면 **키를 즉시 폐기·재발급**하세요.
- 이미 `origin` 이 있다는 오류가 나면 `git remote -v` 로 확인하세요.

## 3. Vercel 에 연결

1. <https://vercel.com> 에서 **GitHub 계정으로 로그인**
2. **Add New… → Project** → 저장소 목록에서 `local-travel-atlas` → **Import**
3. Framework Preset 이 **Next.js** 로 자동 인식되는지 확인 (빌드 명령 `npm run build` 기본값 그대로)
4. **Environment Variables**(선택)

   | Name | Value |
   |---|---|
   | `ORS_API_KEY` | OpenRouteService 키 (이동시간을 쓸 때만) |
   | `NEXT_PUBLIC_ENABLE_ANALYTICS` | `true` (방문 통계를 쓸 때만) |

   - `ORS_API_KEY` 는 **NEXT_PUBLIC_ 를 붙이지 않습니다**(브라우저에 노출됨).
5. **Deploy** 클릭 → 1~2분 후 `https://<프로젝트>.vercel.app` 주소가 생깁니다.

## 4. 공개 URL 확인 체크리스트

- [ ] 주소를 열면 지도·마커 30개가 보인다
- [ ] 모바일(실제 휴대폰)에서 하단 시트·칩이 보인다
- [ ] 코스 3개가 열리고 번호·점선이 보인다
- [ ] EN 전환이 된다
- [ ] 공유 → QR 의 주소가 `https://…vercel.app` 이다 (localhost 안내가 **없어야** 함)
- [ ] `?route=history-tour` 를 붙인 주소가 해당 코스를 연다
- [ ] (키를 넣었다면) 코스에서 "실제 이동시간·경로 불러오기"가 동작한다

## 5. 방문 통계 켜기 (선택)

1. Vercel 프로젝트 → **Analytics** 탭 → **Enable**
2. 환경변수 `NEXT_PUBLIC_ENABLE_ANALYTICS=true` 추가 후 **Redeploy**
3. 수집되는 것은 기본 페이지 조회입니다. **코스별 인기도가 아닙니다**(OPERATIONS.md 참조). 플랜에 따라 기능·보관 기간 제한이 있으니 대시보드에서 확인하세요.

## 6. 데이터를 고치고 다시 배포

```bash
npm run validate:data
git add data/
git commit -m "장소 추가: ○○카페"
git push
```

`push` 하면 Vercel 이 자동 배포합니다. Vercel → Deployments 에서 상태가 **Ready** 가 되면 완료입니다. 검증 오류가 있으면 **빌드가 실패**하고 기존 사이트는 그대로 유지됩니다 — 로그의 `places.csv ○행 …` 메시지를 보고 고치세요.

## 7. 도메인 연결 (선택)

Vercel → Settings → Domains 에서 본인 도메인을 추가합니다. 도메인을 바꾸면 QR 을 새 주소로 다시 만드세요.

## 7-1. Vercel 대신 Railway CLI 로 배포 (대안)

완성본 데모는 Railway 에 올라가 있습니다: https://local-travel-atlas-production.up.railway.app

```bash
npm i -g @railway/cli
railway login                                   # 브라우저 인증
railway up -y --name local-travel-atlas --ci    # 프로젝트 생성 + 업로드 + 빌드(Railpack: npm install → npm run build → npm start)
railway domain                                  # 공개 주소(*.up.railway.app) 발급
railway variables --set ORS_API_KEY=...         # (선택) 이동시간 API — 채팅·문서에 키를 붙이지 마세요
railway up --ci                                 # 코드·데이터를 고친 뒤 다시 배포
```

- 업로드 대상은 현재 폴더이며 `.gitignore` + `.railwayignore` 를 따릅니다(`.env.local`·`.venv` 제외). 커밋하지 않은 변경도 올라가므로 배포 전에 `npm run build` 로 확인하세요.
- Node 버전은 `package.json` 의 `engines.node`(>=22.12)로 정해집니다.
- Railway 는 **사용량 과금**(상시 실행 서버)이고 Vercel Hobby 는 무료입니다. 비용은 Railway 대시보드 → Usage 에서 확인하세요.
- `@vercel/analytics` 는 Vercel 전용이므로 Railway 에서는 `NEXT_PUBLIC_ENABLE_ANALYTICS` 를 켜지 마세요.
- GitHub 푸시 자동 배포: `railway service source connect --repo <owner>/<repo> --branch main`.

## 8. 자주 겪는 배포 오류

| 증상 | 원인 | 해결 |
|---|---|---|
| 빌드 실패: `데이터 검증 실패` | CSV/JSON 오류 | 로그의 행 번호 확인 → 수정 → push |
| 사이트에 지도 대신 "지도를 불러오지 못했습니다" | 스타일 URL 오류·네트워크 | `NEXT_PUBLIC_MAP_STYLE_URL` 값 확인 |
| 이동시간 버튼이 안 보임 | `ORS_API_KEY` 미설정 또는 설정 후 재배포 안 함 | 환경변수 추가 후 **Redeploy** |
| 이동시간 "불러오지 못했습니다" | 키 오류·무료 한도 | ORS 대시보드에서 키·사용량 확인 |
| 한글이 깨져 보임 | CSV가 UTF-8 아님 | UTF-8 로 다시 저장 |
