# Narou Long Translator

`https://ncode.syosetu.com/n7031bs/` 같은 나로우 장편 웹소설을 번역하기 위한 GitHub Pages 웹앱입니다.

기본 추천 조합은 `GitHub Pages + Cloudflare Worker + Azure Translator F0`입니다.

- 설치 없음
- 로컬 서버 없음
- Azure Translator F0 월 2,000,000자 무료
- Azure Translator는 한 요청에 최대 50,000자까지 처리 가능
- 나로우 목차 URL을 넣으면 첫 화를 자동으로 불러오기
- 화 URL을 넣으면 본문을 불러온 뒤 번역

## 접속

```text
https://god199683.github.io/transfer/
```

## 왜 Azure인가

MyMemory는 설치 없이 바로 쓸 수 있지만 이메일을 넣어도 하루 50,000자라 장편 한 작품에는 부족합니다. DeepL API Free는 품질은 좋지만 월 500,000자이고, 브라우저 직접 호출이 CORS로 막힙니다.

Azure Translator F0는 월 2,000,000자라 나로우 장편을 여러 화씩 번역하기에 가장 현실적입니다. API 키는 GitHub Pages에 넣지 않고 Cloudflare Worker에만 저장합니다.

## 준비

1. Azure Portal에서 Translator 리소스를 만듭니다.
2. 가격 계층은 `F0`를 선택합니다.
3. `Keys and Endpoint`에서 Key와 Region을 확인합니다.
4. Cloudflare Workers에서 새 Worker를 만듭니다.
5. `cloudflare-worker/worker.js` 내용을 붙여넣습니다.
6. Worker 환경 변수 또는 Secret을 설정합니다.

```text
AZURE_TRANSLATOR_KEY=Azure에서 받은 Key
AZURE_TRANSLATOR_REGION=Azure 리소스 Region
ALLOWED_ORIGIN=https://god199683.github.io
```

7. Worker를 배포하고 URL을 복사합니다.
8. 번역기 화면의 `Worker URL`에 붙여넣고 `확인`을 누릅니다.

## 사용

1. `나로우 URL`에 `https://ncode.syosetu.com/n7031bs/` 또는 화 URL을 넣습니다.
2. `URL` 버튼을 누릅니다.
3. 원문이 들어오면 `번역`을 누릅니다.

목차 URL이면 첫 화를 자동으로 불러옵니다. 다음 화는 URL 끝 숫자를 바꿔서 불러오면 됩니다.

## 참고

영어 경유 번역은 `일본어 -> 영어 -> 한국어`로 두 번 번역하므로 무료 사용량도 두 배로 소모합니다. Azure에서는 기본값인 `바로 한국어`를 먼저 권장합니다.
