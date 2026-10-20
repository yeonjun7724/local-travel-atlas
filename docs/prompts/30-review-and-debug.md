# 점검·오류 해결 프롬프트

> 앞에 [00-common-rules.md](00-common-rules.md) 를 붙이세요.

## 오류 메시지 해석
```text
아래 오류가 났습니다. 초보자가 이해할 수 있게 ① 무슨 뜻인지 ② 가능한 원인 3가지 ③ 가장 먼저 확인할 것을 알려 주세요.
아직 파일을 수정하지 말고, 제가 확인할 명령어만 알려 주세요.
오류:
<터미널 출력 붙여넣기 (API 키가 보이면 지우고 붙여넣기)>
```

## 데이터 검증 실패
```text
npm run validate:data 결과입니다. 각 오류가 data/places.csv 또는 data/routes.json 의 어느 행·열인지 정리하고 고치는 방법을 알려 주세요.
파일은 직접 수정하지 말고 수정 전/후 값을 표로 보여 주세요.
<검증 출력>
```

## 변경 점검
```text
방금 바뀐 파일(git diff)을 검토해 주세요.
- 요청하지 않은 변경이 있는지, 비밀 키가 들어갔는지, .env 가 추적되는지 확인해 주세요.
- npm run typecheck, npm run lint, npm test, npm run build 를 실행하고 결과를 그대로 보고해 주세요.
```

## 모바일 점검
```text
npm run test:e2e -- --project=mobile 을 실행하고 실패한 테스트가 있으면 스크린샷 파일(test-results/)을 보고 원인을 설명해 주세요. 코드는 수정하지 마세요.
```
