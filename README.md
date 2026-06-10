# JP -> EN -> KR Translator

GitHub Pages에서 바로 배포할 수 있는 정적 번역기입니다. 일본어 원문을 청크로 나눠 `ja -> en`, `en -> ko` 순서로 번역합니다.

## 사용 방법

1. `index.html`을 열거나 GitHub Pages로 배포합니다.
2. LibreTranslate 호환 API 엔드포인트를 입력합니다.
3. 일본어 원문을 붙여 넣고 `번역`을 누릅니다.

## GitHub Pages 배포

1. 저장소에 `index.html`, `styles.css`, `app.js`, `.nojekyll`을 커밋합니다.
2. GitHub 저장소에서 `Settings -> Pages`로 이동합니다.
3. `Deploy from a branch`를 선택하고 `main` 브랜치의 `/root`를 선택합니다.

## API 키 주의

이 앱은 정적 사이트라서 서버에 비밀 키를 숨길 수 없습니다. API 키를 입력하면 브라우저에서 직접 요청하며, `키 저장`을 켠 경우 현재 브라우저의 `localStorage`에만 저장됩니다. 외부에 노출되면 안 되는 키는 별도 백엔드 또는 프록시를 두고 사용하세요.

## 장문 번역

- 기본 청크 크기: 3,000자
- 조절 범위: 500자부터 5,000자
- 긴 원문은 문장 부호와 줄바꿈 근처에서 나눠 순차 처리합니다.

공개 번역 엔드포인트는 사용량 제한, CORS, API 키 정책에 따라 실패할 수 있습니다. 안정적인 장문 번역에는 개인 LibreTranslate 서버나 별도 번역 API 프록시를 권장합니다.
