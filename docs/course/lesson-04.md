# 4차시. AI에게 개발을 시키는 방법

⏱ 25분 (개념 7 · 실습 14 · 정리 4) · 결과물: **PRD와 GitHub 저장소**

## 학습 목표
- PRD(제품 요구사항 문서)가 AI 코딩의 "설계도"임을 이해한다.
- 좋은 프롬프트의 5요소로 요청을 작성한다.
- GitHub 저장소를 만들고 프로젝트를 올린다. 개발환경을 확인한다.

## 선수 준비사항
- GitHub 계정, [Node.js](https://nodejs.org) 설치, Git 설치, VS Code(권장), AI 코딩 도구(Claude Code/Codex 등).
- 강사 제공 시작 템플릿(zip 또는 템플릿 저장소).

## 강사 설명 핵심 개념
1. **PRD**: 무엇을(기능) · 누구를 위해 · 어디까지(범위/제외) · 어떻게 확인(수용 기준). 이 저장소의 `PRD.md` 를 예시로 보여 준다.
2. **좋은 프롬프트 5요소**: ① 목표 ② 맥락(어떤 파일/기술) ③ 제약(건드리지 말 것) ④ 완료 기준 ⑤ 확인 방법.
3. **작게 요청 → 확인 → 저장(commit)**. 한 번에 모든 기능을 시키지 않는다.
4. **덮어쓰기 금지 습관**: "기존 파일은 수정하지 말고 새 파일로", "변경 전 계획부터 보여 줘".
5. **비밀 키는 AI 채팅·코드에 붙이지 않는다.**

## 단계별 실습
1. 템플릿 폴더를 열고 터미널에서:
   ```bash
   node -v          # v20.9 이상
   npm install
   npm run dev      # http://localhost:3000 에서 지도가 보이면 성공
   ```
2. `PRD.md` 를 복사해 내 서비스에 맞게 수정(목적·페르소나·기능 목록·제외 범위).
3. GitHub에서 새 저장소 생성(Public 또는 Private, README 추가 **안 함**).
4. 올리기 (자세한 설명 `docs/DEPLOYMENT.md` §1~2):
   ```bash
   git add .
   git commit -m "프로젝트 시작"
   git branch -M main
   git remote add origin https://github.com/<아이디>/<저장소>.git
   git push -u origin main
   ```
5. GitHub 페이지를 새로고침해 파일이 보이고, `.env.local` 이 **없는지** 확인.

## AI 코딩 도구용 실습 프롬프트
```text
이 프로젝트(Next.js + TypeScript)의 구조를 읽고, 초보자도 이해할 수 있게 폴더별 역할을 표로 설명해 주세요.
파일은 수정하지 마세요. 읽기만 하고, 다음에 제가 수정해야 할 파일 3개(config/site.ts, data/places.csv, data/routes.json)가
각각 무엇을 바꾸는 파일인지도 알려 주세요.
```
```text
PRD.md 를 읽고 제 서비스 기준으로 바꿀 부분을 제안해 주세요.
- 기존 PRD.md 는 덮어쓰지 말고 PRD.my.md 로 새 파일에 초안을 써 주세요.
- 제가 말하지 않은 기능(로그인, 결제, AI 추천)은 추가하지 마세요.
내 서비스 한 문장: "<...>"
```

## 예상 결과물
- `PRD.my.md`(또는 수정한 PRD.md)
- GitHub 저장소 URL

## 정상 작동 확인 방법
- `npm run dev` 화면에 지도 + 장소 목록이 보인다.
- GitHub 저장소에 코드가 보이고 `.env.local` 은 없다.
- `npm run typecheck` 가 오류 없이 끝난다.

## 초보자가 겪을 수 있는 오류 → 해결
| 증상 | 해결 |
|---|---|
| `npm: command not found` | Node.js 설치 후 터미널 재시작 |
| `EADDRINUSE: 3000` | 이미 실행 중인 개발 서버 종료 또는 `npm run dev -- -p 3001` |
| `git push` 가 인증 실패 | GitHub 로그인(브라우저 인증) 또는 Personal Access Token. **토큰을 채팅에 붙이지 말 것** |
| `remote origin already exists` | `git remote -v` 확인 → `git remote set-url origin <새주소>` |
| AI가 파일을 많이 바꿔 버림 | `git diff` 로 확인, 마음에 안 들면 `git restore <파일>` (commit 전 변경만 되돌림) |

## 학습 정리
PRD로 설계 → 작은 프롬프트 → 확인 → 커밋. 이 사이클이 12차시 내내 반복된다.

## 복습 퀴즈
**Q1. 좋은 프롬프트에 가장 필요한 것은?**
① 길이 ② 목표·제약·완료 기준 ③ 영어로만 작성 ④ 이모지
**정답: ②**

**Q2. `.env.local` 파일을 GitHub에 올리면 안 되는 이유는?**
① 용량이 커서 ② API 키 같은 비밀 값이 공개되기 때문 ③ 한글이 깨져서 ④ 지도가 사라져서
**정답: ②**

**Q3. AI가 코드를 바꾼 뒤 가장 먼저 할 일은?**
① 바로 배포 ② 변경 내용(diff)과 실행 결과를 확인 ③ 저장소 삭제 ④ 키를 공유
**정답: ②**
