# Change Log: Functional Fixes & Security Hardening (수정 및 보안 패치 기록)

> **Attribution & Legal Disclaimer**
> - This MCP server is a derivative work based on the open-source project **[sethski/tinkercad-mcp-server](https://github.com/sethski/tinkercad-mcp-server)** (Copyright (c) 2026 sethski, MIT License). All modifications, engine rewrites, Korean localization, and security patches are Copyright (c) 2026 Gagoory and licensed under the same [MIT License](./LICENSE).
> - This is an independent, unofficial project and is **NOT** affiliated with, endorsed by, or sponsored by **Autodesk, Inc.**, **Tinkercad**, or **Arduino SA**. See [../NOTICE.md](../NOTICE.md) for full trademark and legal notices.

---

## 개요 (Overview)

이 문서는 초기 오픈소스 MCP 서버에서 발생하던 회로 구성 실패 문제를 해결한 **엔진 재작성 과정(Part 1)**과, GitHub 저장소 공개 전환에 대비해 수행한 **12대 보안 취약점 감사 및 패치 과정(Part 2)**을 순서대로 기록한 문서입니다.

- **빌드 및 테스트 검증**: `npm run build` (TypeScript 오류 0건), `npm test` (13/13 단위 및 보안 테스트 통과), 실제 Tinkercad Circuits 에디터 연동 검증 완료.

---

## Part 1. Functional Fixes (회로 구성 엔진 전면 재작성)

### Problem (기존 문제점)
- **마우스 드래그 타임아웃**: `locator.dragTo()`가 캔버스의 `.cgfx__hitarea` 오버레이에 막혀 45초 타임아웃 발생.
- **한국어 UI 미지원**: 영어 텍스트 셀렉터만 존재하여 한국어 Tinkercad 환경에서 시뮬레이션 버튼 및 부품 탐색 실패.
- **브레드보드 미결선**: 브레드보드 홀 위에 소자를 배치해도 전기적 연결(insert)이 생성되지 않아 오실로스코프에 `0.00 V`만 출력됨.
- **불완전한 SVG 스크래핑**: SVG `<defs>` 파싱 방식이 브레드보드 핀과 계측기 상태를 제대로 읽지 못함.

### Fixes (해결 내역)

| File | Change |
| :--- | :--- |
| `src/types.ts` | `ComponentSpec` 인터페이스에 숫자/문자열 소자 고유 ID(`did?: number \| string`) 필드 추가. |
| `src/catalog.ts` | 전 소자의 숫자형 `did` 및 한국어 별칭 매핑 추가 (`저항` `53184`, `커패시터` `57752`, `전해 커패시터` `57950`, `작은 브레드보드` `111211`, `함수 발생기` `209278`, `오실로스코프` `58630`, `멀티미터` `116662`, `전원 공급 장치` `111724`, `인덕터` `58208`, `다이오드` `58320`, `Arduino Uno R3` `132521`, `LED` `58422` 등). |
| `src/injected/scrape-circuit.js` | SVG `<defs>` 파싱을 제거하고 `window.circuit_editor.data.devices` 및 `.wires`에서 직접 좌표, 핀, 속성, 배선 상태를 추출하도록 재작성. 한국어 시뮬레이션 버튼(`#SIMULATION_ID`) 감지 추가. |
| `src/services/editor-bridge.ts` | `addComponent`, `moveComponent`, `deleteComponent`, `connectPins`, `deleteWire`, `setComponentAttribute`를 내부 JS 엔진(`deviceLib.getPackagedDeviceDescription(Number(did))`, `editorModel.makeConnection`, `setProperty`) 직접 호출 방식으로 재작성. 브레드보드 홀 반경 1.5 이내 소자 다리를 자동 결선(`{ insert: true }`)하는 로직 구현. |

---

## Part 2. Security Hardening (12대 보안 취약점 감사 및 패치)

### Round 1: Browser Session & Origin Protection (1차 패치)

| # | Severity | Issue | Fix | File |
| :-- | :-- | :-- | :-- | :-- |
| 1 | High | `--remote-debugging-port=9222` 및 `connectOverCDP("127.0.0.1:9222")`로 인해 로컬 프로세스가 로그인된 브라우저를 탈취하거나 악성 브라우저에 연결될 위험. | 디버깅 포트 및 CDP 연결 코드를 제거하고 Playwright 전용 비공개 파이프만 사용. | `src/services/browser.ts` |
| 2 | High | `hostname.endsWith("tinkercad.com")` 조건으로 인해 `eviltinkercad.com`이나 `http://` 주소가 허용됨. | 정확한 루트/서브도메인만 통과시키는 `isAllowedHost()` 구현 및 `https:` 강제. | `src/services/browser.ts` |
| 3 | Medium | 로그인 프로필이 `process.cwd()/.browser-profile`에 생성되어 OneDrive 동기화나 Git 커밋에 노출될 위험. | 기본 저장 위치를 `%LOCALAPPDATA%/tinkercad-mcp/browser-profile`로 분리. | `src/constants.ts` |
| 4 | Low | URL에 `"autodesk"`만 포함되면 인증 관련 JSON 응답까지 메모리에 저장하고 파일 다운로드를 자동 허용함. | 허용 도메인 검증 후 `auth/login/token/session/account` 경로 제외, `acceptDownloads: false` 설정. | `src/services/browser.ts` |

### Round 2: Deep Code & Repository Audit (2차 패치)

| # | Severity | Issue | Fix | File |
| :-- | :-- | :-- | :-- | :-- |
| 5 | Critical (Repo) | 플러그인 루트 폴더에 남아 있던 `.browser-profile`이 Git 커밋 히스토리에 포함될 위험. | 레거시 프로필 폴더 완전 삭제 및 루트 `.gitignore` 생성. | `../.gitignore` |
| 6 | High | `setCode()`가 문자열 결합(``page.evaluate(`${script}(${JSON.stringify(src)})`)``)으로 코드를 동적 실행함. | `page.evaluate((next: string) => {...}, source)` 인자 직렬화 방식으로 교체. | `src/services/editor-bridge.ts` |
| 7 | High | `resolveTinkercadUrl()`에 `../../logout`, `/api/...`, `//evil.com` 등 상대 경로 조작이 가능함. | `thingId` 정규식(`^[a-zA-Z0-9_-]{1,64}$`) 검증 및 `/things/`, `/circuits`, `/dashboard` 경로 화이트리스트 적용. | `src/services/browser.ts` |
| 8 | Medium | `compId.includes(bbVer)`에서 `bbVer === ""`일 때 항상 `true`가 되어 엉뚱한 소자가 삭제/변조될 수 있음. | 4곳의 조회 로직을 모두 `Boolean(bbVer && compId.includes(bbVer))`로 수정. | `src/services/editor-bridge.ts` |
| 9 | Medium | `querySelector`에 이스케이프되지 않은 ID가 들어가고, 소자 속성 객체에 Prototype Pollution 가능성이 있음. | `CSS.escape()` 적용 및 `Object.create(null)` + `__proto__`/`constructor`/`prototype` 키 차단. 시리얼 모니터 셀렉터에서 UI 버튼 텍스트 제외. | `src/injected/scrape-circuit.js` |
| 10 | Medium | 외부 회로의 제목·코드·시리얼 출력이 마크다운으로 그대로 반환되어 코드펜스 탈출 및 간접 프롬프트 인젝션 가능. | `sanitizeInline()`, `sanitizeCodeBlock()`, 인젝션 시그니처 마스킹(`maskPromptInjection`), `<untrusted_circuit_content>` XML 경계선 격리 적용. | `src/services/format.ts`, `src/tools/index.ts` |
| 11 | Low | 스크린샷이 공용 임시 폴더(`os.tmpdir()`)에 무한 누적됨. | `%LOCALAPPDATA%/tinkercad-mcp/screenshots`로 격리하고 최신 20개만 유지하도록 자동 삭제. | `src/constants.ts`, `src/services/editor-bridge.ts` |
| 12 | High | Playwright 기본값으로 인해 Chromium OS 샌드박스가 비활성화(`--no-sandbox`)됨. | `chromiumSandbox: true` 및 `bypassCSP: false`를 강제 활성화하고 Tinkercad 정상 구동 확인. | `src/services/browser.ts` |

### Round 3: Public-Release Supply Chain & Runtime Hardening (3차 공개 출판 대비 패치)

| # | Severity | Issue | Fix | File |
| :-- | :-- | :-- | :-- | :-- |
| 13 | Critical (Supply Chain) | `npm audit`에서 하위 의존성(`@modelcontextprotocol/sdk`, `zod`, `proxy-addr`, `body-parser`, `hono`, `fast-uri`, `ip-address`, `qs`)에 9건의 보안 취약점(Critical 1, High 3, Moderate 5) 발견. | 보안 패치 버전으로 의존성 및 락파일을 업그레이드하여 **`npm audit` 취약점 0건** 달성. | `package.json`, `package-lock.json` |
| 14 | High | `ResponseFormat.JSON` 및 MCP `structuredContent` 반환 시 마크다운용 프롬프트 인젝션 필터가 우회됨. | `sanitizeCircuitState()`를 도입하여 JSON 응답, 마크다운 응답, `structuredContent` 모두에서 인젝션 마스킹 및 프로토타입 오염 필터링이 작동하도록 강화. | `src/services/format.ts`, `src/tools/index.ts` |
| 15 | High | 페이지 로드 후 클라이언트 스크립트 리다이렉트(`window.location`)나 `window.open` 팝업이 외부 도메인으로 이탈할 수 있음. | `attachNavigationGuard()`를 통해 최상위 프레임 네비게이션과 팝업을 네트워크 계층(`context.route`)에서 감시하고 비허용 도메인 접근을 즉시 차단. | `src/services/browser.ts` |
| 16 | Medium | 오류 메시지 및 스크린샷 저장 경로에 로컬 OS 사용자 계정명(`C:\Users\<user>`)이 노출될 수 있음. | `redactLocalPaths()`로 홈 디렉터리를 `~`로 자동 마스킹하고 폴더 생성 권한을 `0o700`으로 설정. | `src/services/errors.ts`, `src/tools/index.ts` |
| 17 | Medium | `scripts/stl_generator.py`에서 임의 경로 덮어쓰기 및 과도한 `--teeth` 입력을 통한 메모리 고갈(DoS) 가능성. | `.stl` 확장자 강제, `..` 상위 경로 참조 차단, 톱니 수(`3~500`) 및 치수(`0.1~2000 mm`) 범위 검증 추가. | `../scripts/stl_generator.py` |
| 18 | Info | 공개 오픈소스 저장소 표준 보안 정책 문서 부재. | 6계층 보안 설계와 비공개 취약점 제보 절차를 담은 `SECURITY.md` 추가. | `../SECURITY.md` |

---

## Part 4. Reliability & Localization Fixes (실제 브라우저 에디터 네비게이션 및 다국어 핀 매핑 패치)

실제 회로 실습 프로젝트(커패시터 병렬 등가 회로, RC 직렬 및 병렬 임피던스/위상각 측정 회로) 생성 과정에서 발견된 에디터 진입 지연 및 한국어 UI 결선 충돌 문제를 해결한 패치 내역입니다.

| # | Severity | Issue | Fix | File |
| :-- | :-- | :-- | :-- | :-- |
| 19 | High (Reliability) | `openCircuit("new")`에서 CSS 셀렉터와 텍스트 엔진이 쉼표로 결합되어 Playwright 파서 문법 오류(`Unexpected token "="`) 발생 및 클릭 실패. 또한 `waitUntil: "networkidle"`로 인해 팅커캐드의 실시간 웹소켓/분석 트래픽으로 30초 타임아웃 발생. | `#create-design` 고유 ID 및 `a.button-circuits` 클래스 기반 클릭으로 개편하고, `waitUntil: "domcontentloaded"`와 `page.waitForURL(/\/editel/)`로 전환하여 1초 이내 즉각 에디터 진입 보장. | `src/services/editor-bridge.ts` |
| 20 | Medium (Navigation) | 팅커캐드 대시보드에서 신규 회로 생성 시 브라우저 팝업이나 새 탭으로 에디터가 열릴 때, 기존 세션이 이전 페이지를 계속 참조하여 에디터 요소를 찾지 못하는 문제. | `browser.ts`에 `setPage()` 함수를 신설하고 브라우저 컨텍스트의 `on("page")` 팝업 리스너와 연동하여 활성 페이지 인스턴스를 자동으로 최신 에디터 탭으로 동기화. | `src/services/browser.ts`, `src/services/editor-bridge.ts` |
| 21 | High (Functional) | 한국어 UI 환경에서 2단자 수동소자(저항, 커패시터)의 단자 인덱스가 `[0] = "터미널 2"`, `[1] = "터미널 1"`로 반환되는데, 기존 코드의 `\|\| index === 0` 폴백 조건 때문에 `terminal1`을 요청해도 `터미널 2`가 매칭되어 핀 충돌 및 배선 생성 실패(`Pin connection failed: undefined`) 발생. | 인덱스 기반 추측(`index === 0`)을 제거하고, 현지화된 한글 단자명(`터미널 1`, `터미널 2`, `양`, `음`)을 정밀하게 1:1 매칭하도록 `matchAliases` 로직 전면 수정. | `src/services/editor-bridge.ts` |

---

## Pre-publish Verification Results (공개 전환 전 체크리스트 검증 완료)

- [x] 저장소 내 `.browser-profile` 폴더 및 쿠키/세션 파일 없음 (`Test-Path: False`).
- [x] 하드코딩된 개인 사용자 경로, API 키, 토큰 없음 (`redactLocalPaths` 적용).
- [x] `npm audit` 취약점 **0건** 확인 완료.
- [x] `npm run build` 및 `npm test` 14개 항목 전수 통과.
- [x] 원저작자 MIT 라이선스 표기 및 비공식 프로젝트/상표권 면책 고지(`LICENSE`, `NOTICE.md`, `SECURITY.md`, `README.md`) 완료.
- [x] 실제 Tinkercad 회로 생성, 다국어 단자 자동 결선, 시뮬레이션 및 스크린샷 캡처 실동작 검증 완료.
