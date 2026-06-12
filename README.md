# Open Source Long Translator

LibreTranslate 호환 API를 사용하는 GitHub Pages용 장문 번역기입니다.

기본 흐름은 `일본어 -> 영어 -> 한국어`이며, 긴 원문은 줄바꿈을 보존하면서 여러 조각으로 나눠 처리합니다. 그래서 10,000자 이상 텍스트도 API 제한에 맞춰 순차 번역할 수 있습니다.

## 접속

```text
https://god199683.github.io/transfer/
```

## API

기본 API 주소는 다음 값입니다.

```text
https://libretranslate.com
```

공식 호스팅 인스턴스는 API 키가 필요할 수 있습니다. 직접 운영하는 LibreTranslate 서버나 키가 필요 없는 호환 인스턴스를 쓰려면 화면의 `API 주소`만 바꾸면 됩니다.

LibreTranslate 문서에 따르면 `/translate`는 `q`, `source`, `target`, `format`, `api_key` 값을 받으며, 자체 호스팅 인스턴스에서는 API 키가 선택 사항일 수 있습니다.

## 기능

- 일본어 원문을 영어로 번역한 뒤 한국어로 번역
- 영어 원문은 바로 한국어 번역 가능
- 10,000자 이상 장문 분할 처리
- 줄바꿈 보존
- 붙여넣기 시 과한 빈 줄 정리
- `원문 = 번역명` 형식의 간단 용어집
- TXT 불러오기, 복사, TXT 저장
- API 요청 크기와 요청 간 대기 시간 조절

## 배포

이 저장소는 GitHub Pages 배포 워크플로를 포함합니다.

1. `main` 브랜치에 push합니다.
2. GitHub 저장소의 `Settings -> Pages`에서 GitHub Actions 배포를 사용합니다.
3. Actions가 끝나면 위 접속 주소로 열 수 있습니다.

## 주의

공개 API는 글자 수, 속도, CORS, API 키 제한이 있을 수 있습니다. 번역이 멈추면 `요청` 값을 줄이고 `대기` 값을 늘리세요.

오픈소스 기계번역 API는 프롬프트를 이해하는 LLM이 아니므로, 라이트노벨식 윤문 품질은 모델과 언어쌍 성능에 크게 좌우됩니다.
