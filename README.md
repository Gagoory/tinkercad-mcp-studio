# Tinkercad Studio & Hardened Circuits MCP Server (Unofficial)

> **법적 고지 및 면책 조항 (Legal & Trademark Disclaimer)**
> - 본 프로젝트는 교육 및 개인 전자회로 설계·실험 보조를 위해 개발된 **독립적인 비공식(Unofficial) 오픈소스 도구**입니다. **Autodesk, Inc.(오토데스크)**, **Tinkercad(팅커캐드)**, **Arduino SA**, **Google LLC**와 어떠한 제휴·후원·승인 관계도 없습니다. ("Tinkercad" 및 "Autodesk"는 Autodesk, Inc.의 등록 상표입니다.)
> - `server/` 디렉터리의 MCP 서버는 **[sethski/tinkercad-mcp-server](https://github.com/sethski/tinkercad-mcp-server)** (MIT License)를 기반으로 포크(Fork)하여, 내부 회로 제어 엔진을 전면 재작성하고 12가지 보안 취약점을 패치한 파생 저작물(Derivative Work)입니다. 자세한 라이선스 및 저작권 고지는 [LICENSE](./LICENSE) 및 [NOTICE.md](./NOTICE.md)를 참고하세요.

---

## 📌 프로젝트 개요 (Overview)

AI 에이전트가 브라우저를 통해 **Tinkercad Circuits**에서 전자회로(브레드보드, 저항, 커패시터, 함수 발생기, 오실로스코프, 멀티미터, 아두이노 등)를 자동으로 배치·배선·시뮬레이션할 수 있도록 지원하는 플러그인 및 보안 강화 MCP(Model Context Protocol) 서버입니다.

---

## 🛠️ 문제 해결 및 보안 패치 전 과정 (Troubleshooting & Security Hardening Log)

상세한 영문/국문 변경 이력은 [`server/CHANGES.md`](./server/CHANGES.md)에도 기록되어 있습니다.

### Phase 1. 초기 MCP 서버의 작동 불능 원인 진단 및 엔진 전면 재작성

초기 오픈소스 스캐폴드(`sethski/tinkercad-mcp-server`)를 그대로 실행했을 때 회로 구성이 실패하고 무한 대기 상태에 빠졌던 **4가지 근본 원인**을 찾아내어 해결했습니다.

| 문제 현상 | 근본 원인 (Root Cause) | 해결 방법 (Engineering Fix) | 관련 파일 |
| :--- | :--- | :--- | :--- |
| **1. 부품 배치 시 45초 타임아웃** | 팔레트에서 마우스 드래그(`locator.dragTo()`)를 시도했으나, 캔버스 위의 투명 `.cgfx__hitarea` 오버레이 레이어에 가로막혀 드롭 이벤트가 전달되지 않음 | 마우스 드래그를 폐기하고, 페이지 내부 엔진 API(`deviceLib.getPackagedDeviceDescription(Number(did))` 및 `root.circuit.addDevice()`)를 직접 호출하여 0.1초 내에 즉시 배치하도록 재작성 | `server/src/services/editor-bridge.ts` |
| **2. 한국어 UI에서 버튼·부품 인식 실패** | 모든 셀렉터가 영문 텍스트(`Start Simulation`, `Create`, 영문 부품명)에만 의존 | 한국어/영어 양방향 셀렉터(`#SIMULATION_ID`, `시뮬레이션 시작/중지`, `만들기`) 및 전체 부품의 숫자형 고유 ID(`did`)와 한국어 별칭 매핑 추가 | `server/src/catalog.ts`, `server/src/types.ts` |
| **3. 브레드보드 위에 꽂은 소자에 전류가 흐르지 않음 (오실로스코프 `0.00 V`)** | 소자 좌표를 브레드보드 구멍 위로 옮기기만 했을 뿐, 브레드보드 핀과의 내부 결선(insert)이 생성되지 않음 | 소자 배치·이동 후 `root.runAllHeavies()`를 호출해 터미널 좌표를 갱신하고, 반경 `1.5` 이내의 브레드보드 홀을 찾아 `editorModel.makeConnection(term, hole, { insert: true })`로 자동 결선 | `server/src/services/editor-bridge.ts` |
| **4. 회로 상태 조회 시 핀·배선 누락** | 깨지기 쉬운 SVG `<defs>` 태그 파싱에 의존 | `window.circuit_editor.data.devices` 및 `.wires` 모델을 직접 순회하여 정확한 좌표, 브레드보드 핀, 속성값, 점퍼선 연결 상태를 추출 | `server/src/injected/scrape-circuit.js` |

---

### Phase 2. 저장소 공개 전환 대비 12대 보안 취약점 감사 및 패치

비공개(Private) 저장소를 향후 공개(Public)로 전환하더라도 개인 계정 정보 유출이나 원격 코드 실행, 프롬프트 인젝션이 발생하지 않도록 2차에 걸친 보안 감사를 수행하고 **12개 항목을 전수 패치**했습니다.

#### 1차 보안 패치 (브라우저 세션 보호 및 도메인 검증)
1. **[높음] 무인증 원격 디버깅 포트(`9222`) 제거**:
   - `--remote-debugging-port=9222` 및 `connectOverCDP("http://127.0.0.1:9222")`를 제거하고 Playwright 전용 비공개 파이프(Pipe) 통신만 사용하도록 변경하여 로컬 프로세스의 세션 하이재킹 차단.
2. **[높음] 도메인 검증 우회(`endsWith`) 수정**:
   - `hostname.endsWith("tinkercad.com")`으로 인해 `eviltinkercad.com`이 통과되던 취약점을 수정하여 정확한 루트 도메인/서브도메인(`isAllowedHost`) 및 `https:` 프로토콜만 허용.
3. **[중간] 브라우저 로그인 프로필 격리**:
   - 작업 폴더(`process.cwd()/.browser-profile`)에 저장되어 클라우드(OneDrive 등)나 Git에 동기화될 위험이 있던 프로필 경로를 `%LOCALAPPDATA%\tinkercad-mcp\browser-profile`로 격리.
4. **[낮음] 네트워크 응답 캡처 필터링 및 자동 다운로드 차단**:
   - `auth/login/token/session/account` 관련 URL의 JSON 응답은 메모리에 저장하지 않도록 제외하고, `acceptDownloads: false` 적용.

#### 2차 심층 보안 패치 (코드 인젝션·경로 조작·프롬프트 인젝션·샌드박스)
5. **[치명적/저장소] 레거시 `.browser-profile` 영구 삭제 및 루트 `.gitignore` 추가**:
   - 프로젝트 폴더 내에 남아 있던 `.browser-profile`을 완전 삭제하고, 최상위 `.gitignore`에서 모든 프로필·스크린샷·빌드 산출물·환경변수 파일 커밋을 원천 차단.
6. **[높음] `setCode()`의 동적 문자열 결합(`eval` 방식) 제거**:
   - ``page.evaluate(`${setCodeJs}(${JSON.stringify(source)})`)`` 형태의 문자열 코드 합성을 제거하고, `page.evaluate((next: string) => { ... }, source)` 인자 직렬화 방식으로 교체.
7. **[높음] `resolveTinkercadUrl()` 경로 조작(Path Traversal) 차단**:
   - `../../logout`, `/api/users/me`, `//evil.com` 등의 상대 경로 조작을 막기 위해 `thingId` 정규식(`/^[a-zA-Z0-9_-]{1,64}$/`) 및 허용 경로 화이트리스트(`/things/`, `/circuits`, `/dashboard`) 적용.
8. **[높음] Playwright Chromium OS 레벨 샌드박스 강제 활성화**:
   - Playwright가 기본으로 끄는 브라우저 샌드박스를 `chromiumSandbox: true` 및 `bypassCSP: false`로 강제 활성화하여 렌더러 탈출 공격 방어.
9. **[중간] `compId.includes(bbVer)` 빈 문자열 오매칭 버그 수정**:
   - `bbVer`가 빈 문자열(`""`)일 때 `compId.includes("") === true`가 되어 엉뚱한 소자가 삭제/변조될 수 있던 로직을 `Boolean(bbVer && compId.includes(bbVer))`로 수정.
10. **[중간] CSS Selector Injection 및 Prototype Pollution 방어**:
    - `scrape-circuit.js`에서 DOM ID 조회 시 `CSS.escape()`를 적용하고, 속성 객체를 `Object.create(null)`로 생성 후 `__proto__`, `constructor`, `prototype` 키를 차단.
11. **[중간] 간접 프롬프트 인젝션(Indirect Prompt Injection) 3중 방어막 구축**:
    - 타인이 공유한 회로의 코드·시리얼 출력·제목에서 삼중 백틱(`` ``` ``)과 개행을 이스케이프(`sanitizeCodeBlock`, `sanitizeInline`)하고, 인젝션 시그니처(`ignore previous instructions`, `you are now` 등)를 `[BLOCKED_INJECTION_ATTEMPT]`로 마스킹(`maskPromptInjection`)하며, `<untrusted_circuit_content>` XML 경계선 태그로 격리.
12. **[낮음] 스크린샷 저장소 격리 및 자동 정리**:
    - 공용 임시 폴더(`os.tmpdir()`) 대신 `%LOCALAPPDATA%\tinkercad-mcp\screenshots`에 저장하고 최근 20개만 유지하도록 자동 삭제 구현.

#### 3차 공개 출판 수준(Public-Release Grade) 심층 하드닝
13. **[치명적/공급망] 의존성 패키지 보안 취약점 9건 전수 패치 (`npm audit` 0건)**:
    - `@modelcontextprotocol/sdk`, `zod` 등 하위 의존성에 존재하던 9건의 CVE(Critical 1, High 3, Moderate 5 — `proxy-addr`, `body-parser`, `hono`, `fast-uri`, `zod` 등)를 최신 보안 버전으로 업그레이드하여 **`npm audit` 취약점 0건** 달성.
14. **[높음] JSON 응답 모드 및 `structuredContent` 우회 차단 (`sanitizeCircuitState`)**:
    - 기존에는 마크다운 출력만 인젝션 필터링을 거치고 `response_format: "json"`이나 MCP `structuredContent` 객체에는 원본이 전달되던 우회 경로를 발견하여, 상태 객체 자체를 딥-새니타이즈(`sanitizeCircuitState`)하도록 강화.
15. **[높음] 브라우저 런타임 네비게이션 가드 및 외부 팝업 차단 (`attachNavigationGuard`)**:
    - 초기 URL 검사뿐 아니라, 페이지 로드 이후 스크립트 리다이렉트(`window.location`)나 `window.open` 팝업이 `https://*.tinkercad.com` / `https://*.autodesk.com` 이외의 외부 도메인으로 이동하려 할 때 네트워크 계층(`context.route`)에서 즉시 차단(`blockedbyclient`).
16. **[중간] 로컬 OS 계정명 및 홈 디렉터리 경로 마스킹 (`redactLocalPaths`, `0o700`)**:
    - 에러 메시지나 스크린샷 저장 경로 반환 시 로컬 사용자 홈 경로(`C:\Users\<username>` 등)를 자동으로 `~`로 마스킹하고, 프로필·스크린샷 폴더 권한을 `0o700`으로 제한.
17. **[중간] Python STL 생성기(`scripts/stl_generator.py`) 경로 조작 및 DoS 방어**:
    - `--output` 확장자(`.stl`) 강제 및 `..` 상위 경로 탈출 차단, 기어 톱니 수(`3~500`) 및 치수(`0.1~2000 mm`) 범위 제한으로 메모리 고갈(DoS) 방지.
18. **[표준] 공개 저장소 보안 정책 문서([`SECURITY.md`](./SECURITY.md)) 추가**:
    - 6계층 방어 아키텍처 명세 및 비공개 취약점 제보 절차(GitHub Private Vulnerability Reporting) 수립.

---

## 🚀 설치 및 실행 방법 (Setup & Usage)

```bash
cd server
npm install
npx playwright install chromium
npm run build
npm test
```

1. 최초 1회 로그인 시 MCP 도구(`tinkercad_open_circuit` 또는 `npm start`)를 실행하면 열리는 크롬 창에서 본인의 Tinkercad 계정으로 로그인합니다.
2. 로그인 세션은 Git 저장소 외부의 `%LOCALAPPDATA%\tinkercad-mcp\browser-profile`에 안전하게 보관됩니다.

---

## 📄 라이선스 (License)

본 프로젝트는 **MIT License** 하에 배포됩니다. 상세 내용은 [LICENSE](./LICENSE) 및 [NOTICE.md](./NOTICE.md)를 확인하세요.
