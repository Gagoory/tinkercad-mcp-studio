import fs from "node:fs";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import {
  CIRCUITS_DASHBOARD_URL,
  DEFAULT_TIMEOUT_MS,
  HEADED,
  PROFILE_DIR,
  TINKERCAD_ORIGIN
} from "../constants.js";
import { BridgeError } from "./errors.js";

let context: BrowserContext | undefined;
let page: Page | undefined;
let lastCircuitJson: unknown;

function log(message: string): void {
  console.error(`[tinkercad-mcp] ${message}`);
}

export function getLastCircuitJson(): unknown {
  return lastCircuitJson;
}

export async function getPage(): Promise<Page> {
  if (page && !page.isClosed()) {
    return page;
  }
  await launchBrowser();
  if (!page) {
    throw new BridgeError(
      "Browser page is not available",
      "Call tinkercad_open_circuit after the Chrome window appears."
    );
  }
  return page;
}

export async function launchBrowser(): Promise<Page> {
  if (context && page && !page.isClosed()) {
    return page;
  }

  // Security: no fixed --remote-debugging-port and no connectOverCDP to 127.0.0.1:9222.
  // Playwright talks to its own browser over a private pipe, so other local
  // processes cannot hijack the logged-in session, and we never attach to a
  // foreign browser that happens to own port 9222.
  fs.mkdirSync(PROFILE_DIR, { recursive: true, mode: 0o700 });
  log("Launching persistent Chrome profile");

  context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: !HEADED,
    viewport: { width: 1440, height: 900 },
    acceptDownloads: false,
    bypassCSP: false,
    // Playwright disables the Chromium sandbox by default (adds --no-sandbox). Keep it on.
    chromiumSandbox: process.env.TINKERCAD_NO_SANDBOX !== "1",
    args: ["--disable-blink-features=AutomationControlled"]
  });

  attachNavigationGuard(context);
  attachNetworkCapture(context);

  page = context.pages()[0] ?? await context.newPage();
  page.setDefaultTimeout(DEFAULT_TIMEOUT_MS);
  page.setDefaultNavigationTimeout(DEFAULT_TIMEOUT_MS);

  page.on("close", () => {
    page = undefined;
  });

  if (!page.url() || page.url() === "about:blank") {
    await page.goto(CIRCUITS_DASHBOARD_URL, { waitUntil: "domcontentloaded" });
  }

  return page;
}

function attachNavigationGuard(browserContext: BrowserContext): void {
  browserContext.route("**/*", async (route) => {
    const req = route.request();
    if (req.isNavigationRequest() && !req.frame()?.parentFrame()) {
      const url = req.url();
      if (url === "about:blank") {
        await route.continue();
        return;
      }
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" || !isAllowedHost(parsed.hostname)) {
          log(`Blocked top-level navigation to disallowed host: ${parsed.hostname}`);
          await route.abort("blockedbyclient");
          return;
        }
      } catch {
        await route.abort("blockedbyclient");
        return;
      }
    }
    await route.continue();
  });

  browserContext.on("page", (popup) => {
    popup.on("framenavigated", (frame) => {
      if (frame !== popup.mainFrame()) return;
      const u = frame.url();
      if (!u || u === "about:blank") return;
      try {
        const parsed = new URL(u);
        if (parsed.protocol !== "https:" || !isAllowedHost(parsed.hostname)) {
          void popup.close().catch(() => {});
        }
      } catch {
        void popup.close().catch(() => {});
      }
    });
  });
}

function attachNetworkCapture(browserContext: BrowserContext): void {
  browserContext.on("response", (response) => {
    void (async () => {
      try {
        const url = response.url();
        let host = "";
        try {
          host = new URL(url).hostname;
        } catch {
          return;
        }
        if (!isAllowedHost(host) || /auth|login|token|session|account/i.test(url)) {
          return;
        }
        const contentType = response.headers()["content-type"] ?? "";
        if (!contentType.includes("application/json")) {
          return;
        }
        const data: unknown = await response.json();
        if (looksLikeCircuitPayload(data)) {
          lastCircuitJson = data;
        }
      } catch {
        // Ignore non-JSON or already-consumed bodies.
      }
    })();
  });
}

function looksLikeCircuitPayload(data: unknown): boolean {
  if (!data || typeof data !== "object") {
    return false;
  }
  const record = data as Record<string, unknown>;
  const keys = Object.keys(record).map((key) => key.toLowerCase());
  const hints = ["components", "wires", "circuit", "breadboard", "arduino", "netlist"];
  return hints.some((hint) => keys.includes(hint));
}

export async function gotoTinkercad(targetUrl: string): Promise<Page> {
  const active = await getPage();
  const resolved = resolveTinkercadUrl(targetUrl);
  if (active.url() !== resolved) {
    await active.goto(resolved, { waitUntil: "domcontentloaded" });
  }
  return active;
}

const ALLOWED_PATH_PREFIXES = ["/things/", "/circuits", "/dashboard"];
const SAFE_THING_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

function isAllowedPathname(pathname: string): boolean {
  if (pathname.includes("..") || pathname.includes("\\") || pathname.startsWith("//")) {
    return false;
  }
  return ALLOWED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

export function resolveTinkercadUrl(targetUrl: string): string {
  const trimmed = targetUrl.trim();
  if (trimmed === "new" || trimmed === "circuits") {
    return CIRCUITS_DASHBOARD_URL;
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" || !isAllowedHost(parsed.hostname)) {
      throw new BridgeError(
        `Refusing to open non-Tinkercad URL: ${parsed.hostname}`,
        "Pass a https://www.tinkercad.com circuit URL or the word 'new'."
      );
    }
    if (!isAllowedPathname(parsed.pathname)) {
      throw new BridgeError(
        `Refusing to open disallowed Tinkercad path: ${parsed.pathname}`,
        "Only /things/<id>/editel, /circuits, or /dashboard URLs are allowed."
      );
    }
    return parsed.toString();
  }
  if (trimmed.startsWith("/")) {
    const candidate = new URL(trimmed, TINKERCAD_ORIGIN);
    if (candidate.origin !== TINKERCAD_ORIGIN || !isAllowedPathname(candidate.pathname)) {
      throw new BridgeError(
        `Refusing to open disallowed relative path: ${trimmed}`,
        "Only /things/<id>/editel, /circuits, or /dashboard paths are allowed."
      );
    }
    return candidate.toString();
  }
  if (!SAFE_THING_ID_RE.test(trimmed)) {
    throw new BridgeError(
      `Invalid Tinkercad thing id: ${trimmed}`,
      "Pass an alphanumeric thing id (e.g. abc123xyz), a full https://www.tinkercad.com/things/<id>/editel URL, or 'new'."
    );
  }
  return `${TINKERCAD_ORIGIN}/things/${trimmed}/editel`;
}

const ALLOWED_ROOT_DOMAINS = ["tinkercad.com", "autodesk.com"];

/** Exact domain or true subdomain match (rejects e.g. eviltinkercad.com). */
export function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return ALLOWED_ROOT_DOMAINS.some((root) => host === root || host.endsWith(`.${root}`));
}

export function profilePath(): string {
  return path.resolve(PROFILE_DIR);
}

export async function closeBrowser(): Promise<void> {
  if (context) {
    await context.close();
  }
  context = undefined;
  page = undefined;
}
