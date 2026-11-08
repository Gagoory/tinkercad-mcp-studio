# Legal Notices, Attribution & Disclaimers (법적 고지 및 저작권/상표권 안내)

## 1. Open-Source Attribution (오픈소스 출처 및 저작권 명시)

The MCP server inside `server/` is a heavily modified derivative work based on the open-source project **[sethski/tinkercad-mcp-server](https://github.com/sethski/tinkercad-mcp-server)**, distributed under the **MIT License**.

- **Original Work**: Copyright (c) 2026 sethski (`https://github.com/sethski/tinkercad-mcp-server`)
  - Provided the initial TypeScript MCP tool schemas, project structure, and evaluation fixtures.
- **Derivative Work & Enhancements**: Copyright (c) 2026 Gagoory
  - Rewrote the circuit manipulation engine (`server/src/services/editor-bridge.ts`) and DOM/state scraper (`server/src/injected/scrape-circuit.js`) to interface with the in-page editor state instead of fragile UI drag-and-drop.
  - Added breadboard hole coordinate resolution and automatic lead insertion (`{ insert: true }`).
  - Added full Korean UI support and expanded the component catalog (`server/src/catalog.ts`) with numeric device IDs (`did`) for lab instruments (Function Generator, Oscilloscope, Multimeter, Power Supply, Capacitors, etc.).
  - Conducted a 12-point security audit and implemented comprehensive security hardening (removal of unauthenticated CDP ports, strict URL/path allowlisting, local profile isolation, Chromium OS sandboxing, and 3-layer indirect prompt injection defenses).

Both the original work and all modifications in this repository are licensed under the [MIT License](./LICENSE).

---

## 2. Trademark & Non-Affiliation Disclaimer (상표권 및 비공식 프로젝트 면책 조항)

- **English**:
  This repository is an independent, unofficial open-source project developed for educational and personal circuit prototyping assistance. It is **NOT** affiliated with, endorsed by, sponsored by, or officially connected with **Autodesk, Inc.**, **Tinkercad**, **Arduino SA**, or **Google LLC**.
  - **Tinkercad** and **Autodesk** are registered trademarks or trademarks of Autodesk, Inc., and/or its subsidiaries and/or affiliates in the USA and/or other countries.
  - **Arduino** is a registered trademark of Arduino SA.
  - All other trademarks, service marks, and company names cited in this repository are the property of their respective owners.

- **한국어**:
  본 저장소는 교육 및 개인 회로 설계·실험 보조 목적으로 개발된 독립적인 비공식 오픈소스 프로젝트입니다. 본 프로젝트는 **Autodesk, Inc.(오토데스크)**, **Tinkercad(팅커캐드)**, **Arduino SA(아두이노)** 또는 **Google LLC**와 어떠한 공식적인 제휴, 후원, 승인 관계도 없습니다.
  - **Tinkercad** 및 **Autodesk**는 미국 및 기타 국가에서 Autodesk, Inc. 및 그 계열사의 등록 상표 또는 상표입니다.
  - 문서 및 코드 내에 언급된 모든 제품명과 상표는 각 소유자의 자산입니다.

---

## 3. Responsible Use & Terms of Service Notice (책임 있는 사용 안내)

- This software operates locally on the user's machine by automating a standard web browser session authenticated by the user's own account.
- It does **not** bypass authentication, access controls, rate limits, or paid tiers, nor does it redistribute any proprietary source code or assets belonging to Autodesk, Inc.
- Users are solely responsible for complying with [Autodesk's Terms of Use](https://www.autodesk.com/company/legal-notices-trademarks/terms-of-service-autodesk360-web-services) when using this tool with their personal accounts.
- Pursuant to the MIT License, this software is provided **"AS IS"**, without warranty of any kind.

---

## 4. Third-Party Runtime Dependencies (서드파티 오픈소스 의존성)

These packages are declared in `server/package.json` and installed via npm (not bundled in source form):

| Package | License | Purpose |
| :--- | :--- | :--- |
| [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) | MIT | Model Context Protocol stdio server SDK |
| [`playwright`](https://github.com/microsoft/playwright) | Apache-2.0 | Local Chromium browser automation |
| [`zod`](https://github.com/colinhacks/zod) | MIT | Runtime schema validation |
