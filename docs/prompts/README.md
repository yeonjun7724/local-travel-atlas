# 실습 프롬프트 모음

차시 문서(`docs/course/lesson-XX.md`)에 들어 있는 프롬프트와 같은 취지의 **복사용 프롬프트**입니다.
`<…>` 부분만 내 내용으로 바꿔서 AI 코딩 도구(Claude Code, Codex 등)에 붙여 넣으세요.

| 파일 | 내용 |
|---|---|
| [00-common-rules.md](00-common-rules.md) | **모든 프롬프트 앞에 붙이는 안전 규칙** (덮어쓰기·비밀 키·지어내기 방지) |
| [10-build-from-scratch.md](10-build-from-scratch.md) | 빈 폴더에서 5~11차시 기능을 단계별로 만드는 프롬프트 |
| [20-data-and-content.md](20-data-and-content.md) | 3·7·10차시 데이터 정리·번역 프롬프트 |
| [30-review-and-debug.md](30-review-and-debug.md) | 점검·오류 해결 프롬프트 |

## 사용 원칙
1. **한 번에 한 기능.** 만든 뒤 `npm run dev` 로 확인하고 `git commit`.
2. **변경 전 계획 먼저**: "수정하기 전에 어떤 파일을 어떻게 바꿀지 알려 주세요."
3. **덮어쓰기 금지**: 이미 있는 파일은 새 이름으로 만들거나 최소 수정만 요청.
4. **결과 확인 명령을 요구**: `npm run typecheck`, `npm run build`, `npm run validate:data`.
5. 비밀 키·토큰은 프롬프트에 붙이지 않습니다.
