# 데이터·콘텐츠 프롬프트

> 앞에 [00-common-rules.md](00-common-rules.md) 를 붙이세요.

## CSV 정리 (3차시)
```text
아래는 제가 직접 답사해 적은 메모입니다. data/places.csv 형식의 CSV 행으로 정리해 주세요.
- 헤더: id,nameKo,nameEn,latitude,longitude,category,theme,descriptionKo,descriptionEn,address,imageUrl,source,license,openingHours,tags,externalUrl,recommendedDurationMinutes,updatedAt,isSample
- category/theme 는 data/categories.json 의 id 만 사용하고, 맞는 것이 없으면 비워 두고 알려 주세요.
- 제가 안 준 값은 비워 두고, source=직접 답사, license=직접 작성, isSample=false.
- 결과는 새 파일 data/my-places.csv 로 만들고 data/places.csv 는 건드리지 마세요.
메모:
<붙여넣기>
```

## 공공데이터 후보 정리 (3차시)
```text
제가 내려받은 공공데이터 파일(<파일명>)에서 <동네> 안의 장소만 추려 주세요.
- 열 이름 대응표(원본 열 → places.csv 열)를 먼저 보여 주세요.
- source 에 데이터 이름과 URL, license 에 이용허락범위를 제가 알려 드린 문구 그대로 넣어 주세요: "<이용허락범위 문구>"
- 좌표가 비었거나 이상한 행은 버리지 말고 별도 목록으로 알려 주세요(자동 추측 금지).
- 사진·리뷰 열은 가져오지 마세요.
```

## 영문 번역 (10차시)
```text
아래 한국어 장소 정보를 영어 관광 안내로 번역해 주세요.
- 상호명·지명은 의미 번역하지 말고 국립국어원 로마자 표기로 쓰고, 확실하지 않으면 [확인 필요].
- 원문에 없는 사실(메뉴, 가격, 영업시간)을 추가하지 마세요.
- "id | nameEn | descriptionEn" 표로 출력, 쉼표가 들어가면 큰따옴표.
원문(id | nameKo | descriptionKo):
<붙여넣기>
```

## 코스 제안 (7차시)
```text
data/places.csv 의 id·좌표만 사용해 도보 코스 후보 3개(각 5~8곳)를 제안해 주세요. 파일은 수정하지 마세요.
- 가까운 장소끼리 이어지게, 마지막은 식사나 휴식 장소로.
- 거리는 '직선거리 추정치'로만 표기하고 실제 도보시간이라고 쓰지 마세요.
- CSV 에 없는 장소는 추가 금지.
```
