# Chrome Built-in JP -> EN -> KR Translator

GitHub Pages에서 바로 배포할 수 있는 정적 번역기입니다. 일본어 원문을 청크로 나눠 Chrome 내장 Translator API로 `ja -> en`, `en -> ko` 순서로 번역합니다.

## 특징

- 별도 번역 API 키가 필요 없습니다.
- 별도 번역 서버를 운영하지 않습니다.
- 긴 원문을 청크로 나눠 10,000자 이상도 순차 처리합니다.
- 영어 중간본과 한국어 결과를 함께 확인할 수 있습니다.

## 브라우저 조건

Chrome 내장 Translator API가 필요합니다.

- 데스크톱 Chrome 138 이상 권장
- 모바일 브라우저 미지원
- 첫 사용 시 Chrome이 언어팩을 다운로드할 수 있습니다.

## GitHub Pages 배포

1. 저장소에 `index.html`, `styles.css`, `app.js`, `.nojekyll`을 커밋합니다.
2. GitHub 저장소에서 `Settings -> Pages`로 이동합니다.
3. `Deploy from a branch`를 선택하고 `main` 브랜치의 `/root`를 선택합니다.

배포 후 주소는 보통 `https://god199683.github.io/transfer/`입니다.

## 참고

이 앱은 Chrome의 브라우저 내장 번역 기능에 의존합니다. 지원되지 않는 브라우저에서는 번역 버튼이 비활성화됩니다.
