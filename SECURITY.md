# Security Policy (보안 정책 및 아키텍처 안내)

## 1. Security Architecture Overview (보안 설계 요약)

This project automates a local Chromium browser session to interact with Tinkercad Circuits via the Model Context Protocol (MCP). Because it handles an authenticated browser profile and reads circuit data that may come from third-party shared designs, it enforces **6 defense-in-depth layers**:

1. **Private Pipe Browser Transport (No Open Debug Ports)**
   - The server communicates with Chromium exclusively over Playwright's private OS pipe (`--remote-debugging-pipe`). No TCP debugging port (`9222`) is opened, preventing other local processes or malicious websites from hijacking the session.
2. **Chromium OS Sandbox & Runtime Navigation Guard**
   - `chromiumSandbox: true`, `bypassCSP: false`, and `acceptDownloads: false` are enforced.
   - Both initial URL resolution (`resolveTinkercadUrl`) and an active runtime navigation interceptor (`attachNavigationGuard`) restrict top-level frame navigations and popups strictly to `https://*.tinkercad.com` and `https://*.autodesk.com` (`/things/<id>`, `/circuits`, `/dashboard`).
3. **Out-of-Tree Profile & Screenshot Isolation (`0o700`)**
   - Persistent browser profiles and screenshots are stored outside the repository under `%LOCALAPPDATA%/tinkercad-mcp` (or `~/.local/share/tinkercad-mcp`) with `0o700` directory permissions, preventing accidental Git commits or cloud-drive synchronization.
4. **Local Path Redaction**
   - Any error messages or screenshot file paths returned to the MCP client automatically redact the host OS user home directory (`os.homedir()` $\rightarrow$ `~`).
5. **3-Layer Indirect Prompt Injection Defense (Markdown + JSON + `structuredContent`)**
   - All circuit fields (`title`, `code`, `serial`, `components`, `wires`) pass through `sanitizeCircuitState()`, `sanitizeInline()`, `sanitizeCodeBlock()`, and `maskPromptInjection()` before being returned in either Markdown, JSON, or MCP `structuredContent`.
   - Untrusted code and serial monitor blocks are wrapped in `<untrusted_circuit_content>` XML boundary tags.
6. **Zero-Vulnerability Dependency Tree (`npm audit`)**
   - Runtime dependencies (`@modelcontextprotocol/sdk`, `playwright`, `zod`) are kept patched with `0` known CVEs in `npm audit`.

---

## 2. Reporting a Vulnerability (보안 취약점 제보 방법)

If you discover a security vulnerability in this repository:
- **Please do NOT open a public GitHub issue.**
- Instead, report it privately via **GitHub Private Vulnerability Reporting** (`Security` tab $\rightarrow$ `Report a vulnerability`) on this repository.
- Include steps to reproduce and the affected file/line numbers.
