import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "playwright";
import {
  CIRCUITS_DASHBOARD_URL,
  EDITOR_READY_TIMEOUT_MS,
  SCREENSHOT_DIR,
  SIMULATION_SETTLE_MS
} from "../constants.js";
import type {
  CircuitComponent,
  CircuitState,
  CircuitWire,
  EditorCapabilities,
  LoginStatus
} from "../types.js";
import { resolveComponent } from "../catalog.js";
import { BridgeError } from "./errors.js";
import { getLastCircuitJson, getPage, gotoTinkercad, setPage } from "./browser.js";

const LOGIN_URL_HINTS = ["signin", "login", "accounts.autodesk", "oauth"];
const injectedDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "injected");

function loadInjectedScript(filename: string): string {
  return fs.readFileSync(path.join(injectedDir, filename), "utf8");
}

interface ScrapedState {
  url: string;
  title: string;
  editorReady: boolean;
  simulationRunning: boolean;
  code: string;
  serial: string;
  components: CircuitComponent[];
  wires: CircuitWire[];
  capabilities: EditorCapabilities;
}

export async function loginStatus(): Promise<LoginStatus> {
  const page = await getPage();
  const url = page.url();
  const looksLikeLogin = LOGIN_URL_HINTS.some((hint) => url.toLowerCase().includes(hint));
  const signInVisible =
    (await page.getByRole("link", { name: /sign in|로그인/i }).first().isVisible().catch(() => false)) ||
    (await page.getByRole("button", { name: /sign in|로그인/i }).first().isVisible().catch(() => false));
  const userChrome = await firstVisible(page, [
    '[data-testid="user-menu"]',
    ".user-avatar",
    "img.avatar",
    '[aria-label*="Account" i]',
    '[aria-label*="profile" i]',
    "#breadboardTab",
    'button:has-text("만들기")',
    'button:has-text("Create")',
    'a[href*="/dashboard"]'
  ]);
  const loggedIn = !looksLikeLogin && !signInVisible && Boolean(userChrome || url.includes("/editel") || url.includes("/dashboard"));

  if (looksLikeLogin) {
    return {
      loggedIn: false,
      url,
      message: "Chrome is on an Autodesk sign-in page. Finish login in the opened window, then call tinkercad_login_status again."
    };
  }

  if (!loggedIn) {
    return {
      loggedIn: false,
      url,
      message: `No Tinkercad session detected at ${url}. Keep the Chrome window open, sign in, then retry.`
    };
  }

  return {
    loggedIn: true,
    url,
    message: "Tinkercad session looks active. Use tinkercad_open_circuit to open or create a circuit."
  };
}

export async function openCircuit(target: string): Promise<CircuitState> {
  let page = await gotoTinkercad(target === "new" ? CIRCUITS_DASHBOARD_URL : target);

  if (target === "new") {
    await createNewCircuit(page);
    await page.waitForTimeout(1500);
    const ctx = page.context();
    const pages = ctx.pages();
    const editel = pages.find((p) => p.url().includes("/editel"));
    if (editel) {
      setPage(editel);
      page = editel;
    }
  }

  await waitForEditorOrLogin(page);
  return inspectCircuit();
}

async function createNewCircuit(page: Page): Promise<void> {
  if (!page.url().includes("tinkercad.com/circuits")) {
    await page.goto("https://www.tinkercad.com/circuits", { waitUntil: "domcontentloaded" });
  }
  await page.waitForTimeout(1000);
  const directBtn = page.getByRole("button", { name: /new circuit|circuit design|회로 디자인/i }).first();
  if (await directBtn.isVisible().catch(() => false)) {
    await directBtn.click();
    await page.waitForURL(url => url.toString().includes("/editel"), { timeout: 20000 }).catch(() => {});
    return;
  }
  const createBtn = page.locator("#create-design, button:has-text('만들기'), button:has-text('Create')").first();
  if (await createBtn.isVisible().catch(() => false)) {
    await createBtn.click();
    await page.waitForTimeout(600);
    const circuitItem = page.locator("a.button-circuits, button:has-text('회로'), a:has-text('회로')").first();
    if (await circuitItem.isVisible().catch(() => false)) {
      await circuitItem.click();
      await page.waitForURL(url => url.toString().includes("/editel"), { timeout: 20000 }).catch(() => {});
      return;
    }
  }
  const fallbackCreate = page.getByText(/만들기|create/i).first();
  if (await fallbackCreate.isVisible().catch(() => false)) {
    await fallbackCreate.click();
    await page.waitForTimeout(600);
    const circuitItem = page.locator("a.button-circuits").first();
    if (await circuitItem.isVisible().catch(() => false)) {
      await circuitItem.click();
      await page.waitForURL(url => url.toString().includes("/editel"), { timeout: 20000 }).catch(() => {});
    }
  }
}

async function waitForEditorOrLogin(page: Page): Promise<void> {
  const deadline = Date.now() + EDITOR_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const url = page.url();
    if (LOGIN_URL_HINTS.some((hint) => url.toLowerCase().includes(hint))) {
      throw new BridgeError(
        "Tinkercad asked for login before the editor opened",
        "Sign in inside the Chrome window, then call tinkercad_open_circuit again."
      );
    }
    const ready = await page.locator("#breadboardTab svg, #CODE_EDITOR_ID").first().isVisible().catch(() => false);
    if (ready) {
      await page.waitForTimeout(800);
      return;
    }
    await page.waitForTimeout(500);
  }
  throw new BridgeError(
    "Circuits editor did not become ready in time",
    "Confirm you are logged in and the URL ends with /editel, then retry tinkercad_open_circuit."
  );
}

export async function inspectCircuit(): Promise<CircuitState> {
  const page = await getPage();
  const scraped = await scrapePage(page);
  const merged = mergeCapturedJson(scraped);
  const status = await loginStatus();
  return {
    ...merged,
    loggedIn: status.loggedIn
  };
}

async function scrapePage(page: Page): Promise<ScrapedState> {
  return page.evaluate(loadInjectedScript("scrape-circuit.js")) as Promise<ScrapedState>;
}

function mergeCapturedJson(scraped: ScrapedState): CircuitState {
  const captured = getLastCircuitJson();
  let source: CircuitState["source"] = scraped.components.length > 0 ? "svg" : "empty";
  if (captured && scraped.components.length === 0) {
    const extracted = extractComponentsFromUnknown(captured);
    if (extracted.components.length > 0) {
      scraped.components = extracted.components;
      scraped.wires = extracted.wires;
      source = "json";
    }
  } else if (captured && scraped.components.length > 0) {
    source = "mixed";
  }

  return {
    url: scraped.url,
    title: scraped.title,
    loggedIn: false,
    editorReady: scraped.editorReady,
    simulationRunning: scraped.simulationRunning,
    code: scraped.code,
    serial: scraped.serial,
    components: scraped.components,
    wires: scraped.wires,
    capabilities: scraped.capabilities,
    source
  };
}

function extractComponentsFromUnknown(data: unknown): { components: CircuitComponent[]; wires: CircuitWire[] } {
  const components: CircuitComponent[] = [];
  const wires: CircuitWire[] = [];
  const visit = (node: unknown, depth: number): void => {
    if (!node || typeof node !== "object" || depth > 6) {
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item, depth + 1);
      }
      return;
    }
    const record = node as Record<string, unknown>;
    if (typeof record.id === "string" && (record.type || record.name || record.component)) {
      components.push({
        id: record.id,
        name: String(record.name ?? record.title ?? record.id),
        type: String(record.type ?? record.component ?? "unknown"),
        x: Number(record.x ?? 0),
        y: Number(record.y ?? 0),
        width: Number(record.width ?? 0),
        height: Number(record.height ?? 0),
        pins: [],
        attributes: {}
      });
    }
    if (typeof record.from === "string" && typeof record.to === "string") {
      wires.push({
        id: String(record.id ?? `${record.from}-${record.to}`),
        from: record.from,
        to: record.to
      });
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === "object") {
        visit(value, depth + 1);
      }
    }
  };
  visit(data, 0);
  return { components, wires };
}

const MAX_SAVED_SCREENSHOTS = 20;

export async function takeScreenshot(): Promise<{ path: string; base64: string }> {
  const page = await getPage();
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true, mode: 0o700 });
  const filePath = path.join(SCREENSHOT_DIR, `circuit-${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  const base64 = fs.readFileSync(filePath).toString("base64");
  try {
    const files = fs
      .readdirSync(SCREENSHOT_DIR)
      .filter((f) => f.startsWith("circuit-") && f.endsWith(".png"))
      .sort();
    if (files.length > MAX_SAVED_SCREENSHOTS) {
      for (const old of files.slice(0, files.length - MAX_SAVED_SCREENSHOTS)) {
        fs.unlinkSync(path.join(SCREENSHOT_DIR, old));
      }
    }
  } catch {
    // Ignore cleanup errors.
  }
  return { path: filePath, base64 };
}

export async function addComponent(query: string, x: number, y: number): Promise<CircuitState> {
  const page = await getPage();
  await ensureEditor(page);
  const spec = resolveComponent(query);
  const targetDid = spec?.did;

  const addedId = await page.evaluate(
    ({ didArg, queryArg, screenX, screenY }) => {
      const ce = (window as any).circuit_editor;
      if (!ce || !ce.root || !ce.stateMachine) {
        return null;
      }
      const root = ce.root;
      const devLib = root.deviceLib;
      const sm = ce.stateMachine.breadboardStateMachine;
      const em = sm.editorModel;
      const svg = document.querySelector("#breadboardTab svg");
      const svgBox = svg ? svg.getBoundingClientRect() : { x: 0, y: 96 };

      let resolvedDid: any = didArg;
      if (!resolvedDid) {
        const needle = String(queryArg).trim().toLowerCase();
        const domItem = Array.from(document.querySelectorAll("[data-did]")).find((el) => {
          const text = (el.textContent || "").toLowerCase();
          return el.getAttribute("data-did") === needle || text.includes(needle);
        });
        if (domItem) {
          const attrDid = domItem.getAttribute("data-did") || "";
          resolvedDid = /^\d+$/.test(attrDid) ? Number(attrDid) : attrDid;
        }
      } else if (typeof resolvedDid === "string" && /^\d+$/.test(resolvedDid)) {
        resolvedDid = Number(resolvedDid);
      }

      if (!resolvedDid) {
        return null;
      }

      const desc = devLib.getPackagedDeviceDescription(resolvedDid) || devLib.getPackagedDeviceDescription(String(resolvedDid));
      if (!desc) {
        return null;
      }

      root.rec();
      const dev = root.circuit.addDevice(desc);
      const bb = dev.breadboard();
      const curPos = bb.pos();
      const CoordCtor = curPos.constructor;
      // Convert screen pixel coordinates to workplane coordinates
      const relX = screenX - svgBox.x;
      const relY = screenY - svgBox.y;
      const realCoord = em.toRealCoord(new CoordCtor(relX, relY));
      bb.pos(realCoord);

      em.emptySelection();
      em.selection.add(bb);
      em.onElementMovingStop();
      root.runAllHeavies();
      const bbDev = ce.data.devices.values().find((d: any) => Number(d.did()) === 111211);
      if (bbDev && dev !== bbDev) {
        for (const term of dev.terminals.values()) {
          const tp = term.getBreadboardPos();
          const hole = bbDev.terminals.values().find((h: any) => h.getBreadboardPos().distance(tp) < 1.5);
          if (hole) {
            em.makeConnection(term, hole, { insert: true });
          }
        }
      }
      root.stopRec();
      root.runAllHeavies();
      return dev.versions_id as string;
    },
    { didArg: targetDid ?? null, queryArg: query, screenX: x, screenY: y }
  );

  if (!addedId) {
    throw new BridgeError(
      `Could not add component "${query}"`,
      `Call tinkercad_list_components to see known types (e.g., resistor, capacitor, function_generator, oscilloscope, multimeter, breadboard_small).`
    );
  }

  await page.waitForTimeout(250);
  return inspectCircuit();
}

export async function moveComponent(componentId: string, x: number, y: number): Promise<CircuitState> {
  const page = await getPage();
  await ensureEditor(page);

  const moved = await page.evaluate(
    ({ compId, screenX, screenY }) => {
      const ce = (window as any).circuit_editor;
      if (!ce || !ce.data || !ce.stateMachine) return false;
      const root = ce.root;
      const em = ce.stateMachine.breadboardStateMachine.editorModel;
      const svg = document.querySelector("#breadboardTab svg");
      const svgBox = svg ? svg.getBoundingClientRect() : { x: 0, y: 96 };

      const target = ce.data.devices.values().find((d: any) => {
        const bbVer = d.breadboard()?.versions_id;
        const name = d.description?.device?.name || "";
        return (
          d.versions_id === compId ||
          bbVer === compId ||
          `id_${bbVer}_5` === compId ||
          `id_${bbVer}_3` === compId ||
          Boolean(bbVer && compId.includes(bbVer)) ||
          name.toLowerCase() === compId.toLowerCase()
        );
      });

      if (!target) return false;

      const bb = target.breadboard();
      const CoordCtor = bb.pos().constructor;
      const relX = screenX - svgBox.x;
      const relY = screenY - svgBox.y;
      const realCoord = em.toRealCoord(new CoordCtor(relX, relY));

      root.rec();
      em.emptySelection();
      em.selection.add(bb);
      em.onElementMovingStart();
      bb.pos(realCoord);
      em.onElementMovingStop();
      root.runAllHeavies();
      const bbDev = ce.data.devices.values().find((d: any) => Number(d.did()) === 111211);
      if (bbDev && target !== bbDev) {
        for (const term of target.terminals.values()) {
          const tp = term.getBreadboardPos();
          const hole = bbDev.terminals.values().find((h: any) => h.getBreadboardPos().distance(tp) < 1.5);
          if (hole) {
            em.makeConnection(term, hole, { insert: true });
          }
        }
      }
      root.stopRec();
      root.runAllHeavies();
      return true;
    },
    { compId: componentId, screenX: x, screenY: y }
  );

  if (!moved) {
    throw new BridgeError(
      `Component "${componentId}" was not found`,
      "Call tinkercad_get_circuit to list ids."
    );
  }

  await page.waitForTimeout(200);
  return inspectCircuit();
}

export async function deleteComponent(componentId: string): Promise<CircuitState> {
  const page = await getPage();
  await ensureEditor(page);

  const deleted = await page.evaluate((compId) => {
    const ce = (window as any).circuit_editor;
    if (!ce || !ce.data || !ce.stateMachine) return false;
    const root = ce.root;
    const em = ce.stateMachine.breadboardStateMachine.editorModel;

    const target = ce.data.devices.values().find((d: any) => {
      const bbVer = d.breadboard()?.versions_id;
      const name = d.description?.device?.name || "";
      return (
        d.versions_id === compId ||
        bbVer === compId ||
        `id_${bbVer}_5` === compId ||
        `id_${bbVer}_3` === compId ||
        compId.includes(bbVer) ||
        name.toLowerCase() === compId.toLowerCase()
      );
    });

    if (!target) return false;

    root.rec();
    em.emptySelection();
    em.selection.add(target.breadboard());
    em.removeSelection();
    root.stopRec();
    root.runAllHeavies();
    return true;
  }, componentId);

  if (!deleted) {
    throw new BridgeError(
      `Component "${componentId}" was not found`,
      "Call tinkercad_get_circuit to list ids."
    );
  }

  await page.waitForTimeout(200);
  return inspectCircuit();
}

export async function connectPins(fromRef: string, toRef: string): Promise<CircuitState> {
  const page = await getPage();
  await ensureEditor(page);

  const result = await page.evaluate(
    ({ fromStr, toStr }) => {
      const ce = (window as any).circuit_editor;
      if (!ce || !ce.data || !ce.stateMachine) {
        return { ok: false, reason: "Editor not initialized" };
      }
      const root = ce.root;
      const em = ce.stateMachine.breadboardStateMachine.editorModel;
      const devices = ce.data.devices.values();

      const resolveTerminal = (ref: string) => {
        const cleanRef = ref.split(":")[0].trim();
        const dot = cleanRef.lastIndexOf(".");
        const compKey = dot > 0 ? cleanRef.slice(0, dot).trim() : cleanRef;
        const pinKey = (dot > 0 ? cleanRef.slice(dot + 1) : cleanRef).trim().toLowerCase();

        const dev = devices.find((d: any) => {
          const bbVer = d.breadboard()?.versions_id || "";
          const didStr = String(d.did ? d.did() : "");
          const name = (d.description?.device?.name || "").toLowerCase();
          return (
            d.versions_id === compKey ||
            bbVer === compKey ||
            `id_${bbVer}_5` === compKey ||
            `id_${bbVer}_3` === compKey ||
            Boolean(bbVer && compKey.includes(bbVer)) ||
            name === compKey.toLowerCase() ||
            (compKey.toLowerCase().includes("breadboard") && didStr === "111211") ||
            (compKey.toLowerCase().includes("resistor") && didStr === "53184") ||
            (compKey.toLowerCase().includes("capacitor") && (didStr === "57752" || didStr === "57950")) ||
            (compKey.toLowerCase().includes("function") && didStr === "209278") ||
            (compKey.toLowerCase().includes("scope") && didStr === "58630") ||
            (compKey.toLowerCase().includes("multimeter") && didStr === "116662")
          );
        });

        if (!dev) return null;

        const terms = dev.terminals.values();
        const matchAliases = (t: any, index: number): boolean => {
          const rawName = String(
            (t.breadboardDescription && t.breadboardDescription.name) || (t.getName ? t.getName() : "") || ""
          )
            .trim()
            .toLowerCase();
          const bbidStr = String(t.bbid ? t.bbid() : "");
          if (rawName === pinKey || bbidStr === pinKey || `pin${index}` === pinKey || `pin${index + 1}` === pinKey) {
            return true;
          }
          if (
            (pinKey === "pin1" || pinKey === "1" || pinKey === "terminal1" || pinKey === "터미널 1") &&
            (rawName === "터미널 1" || rawName === "terminal 1" || rawName === "1")
          ) {
            return true;
          }
          if (
            (pinKey === "pin2" || pinKey === "2" || pinKey === "terminal2" || pinKey === "터미널 2") &&
            (rawName === "터미널 2" || rawName === "terminal 2" || rawName === "2")
          ) {
            return true;
          }
          if (
            (pinKey === "positive" || pinKey === "pos" || pinKey === "+" || pinKey === "anode" || pinKey === "양" || pinKey === "양극") &&
            (rawName === "양" || rawName === "양극" || rawName === "positive" || rawName === "anode" || index === 0)
          ) {
            return true;
          }
          if (
            (pinKey === "negative" || pinKey === "neg" || pinKey === "-" || pinKey === "cathode" || pinKey === "gnd" || pinKey === "음" || pinKey === "음극") &&
            (rawName === "음" || rawName === "음극" || rawName === "negative" || rawName === "cathode" || rawName === "접지" || rawName === "gnd" || index === 1)
          ) {
            return true;
          }
          return false;
        };

        return terms.find((t: any, idx: number) => matchAliases(t, idx)) || null;
      };

      const tStart = resolveTerminal(fromStr);
      const tEnd = resolveTerminal(toStr);
      if (!tStart || !tEnd) {
        return {
          ok: false,
          reason: `Could not resolve terminals: from=${Boolean(tStart)} (${fromStr}), to=${Boolean(tEnd)} (${toStr})`
        };
      }

      let wireColor = em.newWireColor ? em.newWireColor() : "green";
      const explicitColor = (fromStr.split(":")[1] || toStr.split(":")[1] || "").trim().toLowerCase();
      if (explicitColor) {
        wireColor = explicitColor;
      } else if (/pos|\+|양|vcc|5v/i.test(fromStr + toStr)) {
        wireColor = "red";
      } else if (/neg|-|음|gnd|접지|w\d|y\d/i.test(fromStr + toStr)) {
        wireColor = "black";
      }

      root.rec();
      const wire = em.makeConnection(tStart, tEnd, {
        innerPoints: [],
        color: wireColor
      });
      root.stopRec();
      root.runAllHeavies();
      return { ok: Boolean(wire), wireId: wire?.versions_id || "connected" };
    },
    { fromStr: fromRef, toStr: toRef }
  );

  if (!result.ok) {
    throw new BridgeError(
      `Pin connection failed: ${result.reason}`,
      "Use componentId.pinName (e.g. breadboard.e5, resistor.pin1, funcgen.positive, scope.negative)."
    );
  }

  await page.waitForTimeout(200);
  return inspectCircuit();
}

export async function deleteWire(wireId: string): Promise<CircuitState> {
  const page = await getPage();
  const removed = await page.evaluate((wId) => {
    const ce = (window as any).circuit_editor;
    if (!ce || !ce.data || !ce.data.wires) return false;
    const wire = ce.data.wires.values().find((w: any) => w.versions_id === wId);
    if (!wire) return false;
    ce.root.rec();
    wire.remove();
    ce.root.stopRec();
    ce.root.runAllHeavies();
    return true;
  }, wireId);

  if (!removed) {
    throw new BridgeError(
      `Wire "${wireId}" was not found`,
      "Call tinkercad_get_circuit and use a wire id from that list."
    );
  }
  return inspectCircuit();
}

export async function setComponentAttribute(componentId: string, name: string, value: string): Promise<CircuitState> {
  const page = await getPage();
  await ensureEditor(page);

  const updated = await page.evaluate(
    ({ compId, attrName, attrValue }) => {
      const ce = (window as any).circuit_editor;
      if (!ce || !ce.data) return false;
      const root = ce.root;
      const em = ce.stateMachine.breadboardStateMachine.editorModel;

      const target = ce.data.devices.values().find((d: any) => {
        const bbVer = d.breadboard()?.versions_id || "";
        const devName = (d.description?.device?.name || "").toLowerCase();
        return (
          d.versions_id === compId ||
          bbVer === compId ||
          `id_${bbVer}_5` === compId ||
          `id_${bbVer}_3` === compId ||
          Boolean(bbVer && compId.includes(bbVer)) ||
          devName === compId.toLowerCase()
        );
      });

      if (!target) return false;

      const keyLower = attrName.trim().toLowerCase();
      if (keyLower === "angle" || keyLower === "rotation" || keyLower === "rotate") {
        root.rec();
        const bb = target.breadboard();
        bb.setAngle(Number(attrValue) || 0);
        em.emptySelection();
        em.selection.add(bb);
        em.onElementMovingStop();
        root.stopRec();
        root.runAllHeavies();
        return true;
      }

      if (keyLower === "name" || keyLower === "label") {
        root.rec();
        if (target.setName) target.setName(attrValue);
        root.stopRec();
        root.runAllHeavies();
        return true;
      }

      // Map common aliases to Tinkercad property names
      let propObj: any = null;
      target.properties.forEach((k: any, v: any) => {
        const p = v && v.name ? v : k;
        if (!p || !p.name) return;
        const pLower = String(p.name).toLowerCase();
        if (
          pLower === keyLower ||
          (keyLower === "저항" && pLower === "resistance") ||
          ((keyLower === "capacitance" || keyLower === "정전 용량" || keyLower === "용량") && pLower === "capacitance") ||
          ((keyLower === "frequency" || keyLower === "freq" || keyLower === "주파수") && pLower === "frequency") ||
          ((keyLower === "amplitude" || keyLower === "amp" || keyLower === "진폭") && pLower === "amplitude") ||
          ((keyLower === "offset" || keyLower === "dc offset" || keyLower === "dc_offset" || keyLower === "오프셋") && pLower === "dc offset") ||
          ((keyLower === "function" || keyLower === "waveform" || keyLower === "파형" || keyLower === "함수") && pLower === "function") ||
          ((keyLower === "mode" || keyLower === "모드") && pLower === "mode") ||
          ((keyLower === "time" || keyLower === "time_per_div" || keyLower === "time per division") && pLower === "time per division")
        ) {
          propObj = p;
        }
      });

      if (!propObj) return false;

      root.rec();
      const valStr = String(attrValue).trim();
      if (propObj.unit && propObj.unit[0] === "[") {
        // Enum property (e.g. Function: square/sine/triangle, Mode: 0/1/2, color: red/green/...)
        let enumKey = valStr.toLowerCase();
        if (propObj.name === "Mode") {
          if (/amp|전류|0/i.test(enumKey)) enumKey = "0";
          else if (/res|저항|2/i.test(enumKey)) enumKey = "2";
          else enumKey = "1"; // Voltage
        }
        target.setProperty(propObj.name, null, enumKey);
      } else {
        // Numeric property with optional unit prefix (p, n, u, m, k, M, G)
        const match = valStr.match(/^([+-]?\d+(?:\.\d+)?)\s*([pnumkMGµ]?)/);
        if (match) {
          const numVal = Number(match[1]);
          let prefix = match[2] || "";
          if (prefix === "µ") prefix = "u";
          if (!prefix && propObj.prefix === "none") prefix = "none";
          target.setProperty(propObj.name, false, numVal, prefix);
        } else {
          target.setProperty(propObj.name, false, Number(valStr) || 0, propObj.prefix || "");
        }
      }
      root.stopRec();
      root.runAllHeavies();
      return true;
    },
    { compId: componentId, attrName: name, attrValue: value }
  );

  if (!updated) {
    throw new BridgeError(
      `Could not set attribute "${name}"="${value}" on ${componentId}`,
      "Common attributes: resistance, capacitance, Frequency, Amplitude, DC Offset, Function (sine/square/triangle), Mode (voltage/amperage/resistance), Time per division, angle."
    );
  }

  await page.waitForTimeout(200);
  return inspectCircuit();
}

export async function getCode(): Promise<string> {
  const page = await getPage();
  await openCodePanel(page);
  await switchCodeMode(page, "Text");
  const state = await scrapePage(page);
  if (state.code.trim() === "") {
    throw new BridgeError(
      "Arduino code panel is empty or not readable",
      "Click Code, switch the dropdown to Text, then retry tinkercad_get_code."
    );
  }
  return state.code;
}

export async function setCode(source: string): Promise<void> {
  const page = await getPage();
  await openCodePanel(page);
  await switchCodeMode(page, "Text");

  const applied = await page.evaluate((next: string) => {
    const cmHost = document.querySelector(".CodeMirror") as any;
    if (cmHost && cmHost.CodeMirror) {
      cmHost.CodeMirror.setValue(next);
      return "codemirror";
    }
    const aceEl = document.querySelector(".ace_editor") as any;
    if (aceEl && aceEl.env && aceEl.env.editor) {
      aceEl.env.editor.setValue(next, -1);
      return "ace";
    }
    const textarea = document.querySelector("#CODE_EDITOR_ID textarea, .code_panel textarea") as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.focus();
      textarea.value = next;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
      return "textarea";
    }
    return "";
  }, source);

  if (applied) {
    return;
  }

  const editor = page.locator(".monaco-editor, .ace_editor, .CodeMirror, #CODE_EDITOR_ID").first();
  if (!(await editor.isVisible().catch(() => false))) {
    throw new BridgeError(
      "Could not find a writable Arduino code editor",
      "Open the Code panel and switch it to Text mode, then retry tinkercad_set_code."
    );
  }
  await editor.click();
  const modifier = process.platform === "darwin" ? "Meta" : "Control";
  await page.keyboard.press(`${modifier}+KeyA`);
  await page.keyboard.insertText(source);
}

export async function startSimulation(): Promise<void> {
  const page = await getPage();
  const state = await scrapePage(page);
  if (state.simulationRunning) {
    return;
  }
  const simBtn = page.locator("#SIMULATION_ID").first();
  if (await simBtn.isVisible().catch(() => false)) {
    await simBtn.click();
    await page.waitForTimeout(SIMULATION_SETTLE_MS);
    return;
  }
  const alt = page.getByText(/start simulation|시뮬레이션 시작/i).first();
  if (await alt.isVisible().catch(() => false)) {
    await alt.click();
    await page.waitForTimeout(SIMULATION_SETTLE_MS);
    return;
  }
  throw new BridgeError(
    "Start Simulation control is not visible",
    "Make sure a circuit is open and simulation is not already running."
  );
}

export async function stopSimulation(): Promise<void> {
  const page = await getPage();
  const state = await scrapePage(page);
  if (!state.simulationRunning) {
    return;
  }
  const simBtn = page.locator("#SIMULATION_ID").first();
  if (await simBtn.isVisible().catch(() => false)) {
    await simBtn.click();
    await page.waitForTimeout(400);
    return;
  }
  const alt = page.getByText(/stop simulation|시뮬레이션 중지/i).first();
  if (await alt.isVisible().catch(() => false)) {
    await alt.click();
    return;
  }
  throw new BridgeError(
    "Stop Simulation control is not visible",
    "Simulation may already be stopped. Check with tinkercad_get_circuit."
  );
}

export async function readSerial(waitMs: number): Promise<string> {
  const page = await getPage();
  await openCodePanel(page);
  if (waitMs > 0) {
    await page.waitForTimeout(waitMs);
  }
  const state = await scrapePage(page);
  if (state.serial.trim() === "") {
    const fallback = await page
      .locator(".code_panel__serial__content__text, .js-code_panel__serial__text")
      .allTextContents();
    const text = fallback.join("\n").trim();
    if (text !== "") {
      return text;
    }
    return "";
  }
  return state.serial;
}

async function openCodePanel(page: Page): Promise<void> {
  const already = await page.locator(".code_panel:visible, .js-code_panel__serial__input:visible").first().isVisible().catch(() => false);
  if (already) {
    return;
  }
  const codeBtn = page.locator("#CODE_EDITOR_ID").first();
  if (await codeBtn.isVisible().catch(() => false)) {
    await codeBtn.click();
    await page.waitForTimeout(400);
  }
}

async function switchCodeMode(page: Page, mode: string): Promise<void> {
  const safeMode = mode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const dropdown = page.getByRole("combobox").first();
  if (await dropdown.isVisible().catch(() => false)) {
    await dropdown.selectOption({ label: mode }).catch(async () => {
      await dropdown.click();
      await page.getByRole("option", { name: new RegExp(`${safeMode}|텍스트`, "i") }).first().click();
    });
    return;
  }
  const textOption = page.getByText(new RegExp(`^${safeMode}$|^텍스트$`, "i")).first();
  if (await textOption.isVisible().catch(() => false)) {
    await textOption.click();
  }
}

async function firstVisible(page: Page, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    if (await page.locator(selector).first().isVisible().catch(() => false)) {
      return true;
    }
  }
  return false;
}

async function ensureEditor(page: Page): Promise<void> {
  const ready = await page.locator("#breadboardTab, #CODE_EDITOR_ID").first().isVisible().catch(() => false);
  if (!ready) {
    throw new BridgeError(
      "Circuits editor is not open",
      "Call tinkercad_open_circuit with a circuit URL or 'new' first."
    );
  }
}

export async function probeEditor(): Promise<ScrapedState> {
  const page = await getPage();
  return scrapePage(page);
}

export async function renameCircuit(title: string): Promise<CircuitState> {
  const page = await getPage();
  await ensureEditor(page);

  const titleSpan = page.locator("#topnav-title-text");
  if (await titleSpan.isVisible().catch(() => false)) {
    await titleSpan.click();
    await page.waitForTimeout(300);
    const titleInput = page.locator("#topnav-title-input");
    if (await titleInput.isVisible().catch(() => false)) {
      await titleInput.fill(title);
      await titleInput.press("Enter");
      await page.waitForTimeout(400);
    }
  }

  await page.evaluate((newTitle) => {
    const ce = (window as any).circuit_editor;
    if (ce?.data) {
      if (typeof ce.data.title === "string") ce.data.title = newTitle;
      else if (ce.data.title && typeof ce.data.title.set === "function") ce.data.title.set(newTitle);
    }
  }, title).catch(() => {});

  return inspectCircuit();
}

export async function waitForCloudSave(waitMs = 6000): Promise<{ saved: boolean; waitMs: number }> {
  const page = await getPage();
  await page.waitForTimeout(Math.max(1000, waitMs));
  return { saved: true, waitMs };
}

export async function setCircuitPrivacy(
  target?: string,
  privacy: "shared" | "public" | "private" = "shared"
): Promise<{ thingId: string; url: string; privacy: string; isShared: boolean }> {
  const page = await getPage();
  let thingId = "";

  if (target) {
    const match = target.match(/things\/([a-zA-Z0-9_-]+)/);
    thingId = match ? match[1] : target.trim();
  } else {
    const url = page.url();
    const match = url.match(/things\/([a-zA-Z0-9_-]+)/);
    if (match) {
      thingId = match[1];
    }
  }

  if (!thingId) {
    throw new BridgeError(
      "Could not determine Tinkercad thing ID for privacy update",
      "Provide target thing ID or open a circuit first."
    );
  }

  const thingUrl = `https://www.tinkercad.com/things/${thingId}`;
  await page.goto(thingUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  if (privacy === "shared" || privacy === "public") {
    const changeBtn = page.getByText(/공개 여부를 공유로 변경|공개 여부를 공개로 변경|Change privacy to shared/i).first();
    if (await changeBtn.isVisible().catch(() => false)) {
      await changeBtn.click();
      await page.waitForTimeout(2000);
    }
  }

  const isShared = await page.content().then((c) =>
    c.includes("공개 여부를 비공개로 변경") || c.includes("공유됨") || c.includes("Shared") || c.includes("Public")
  );

  return {
    thingId,
    url: thingUrl,
    privacy,
    isShared
  };
}

export async function connectPinsBatch(
  wires: Array<{ from: string; to: string; color?: string }>
): Promise<{ connected: number; errors: string[] }> {
  const page = await getPage();
  await ensureEditor(page);

  const result = await page.evaluate(
    ({ wireList }) => {
      const ce = (window as any).circuit_editor;
      if (!ce || !ce.data || !ce.stateMachine) {
        return { connected: 0, errors: ["Editor not initialized"] };
      }
      const root = ce.root;
      const em = ce.stateMachine.breadboardStateMachine.editorModel;
      const devices = ce.data.devices.values();

      const resolveTerminal = (ref: string) => {
        const cleanRef = ref.split(":")[0].trim();
        const dot = cleanRef.lastIndexOf(".");
        const compKey = dot > 0 ? cleanRef.slice(0, dot).trim() : cleanRef;
        const pinKey = (dot > 0 ? cleanRef.slice(dot + 1) : cleanRef).trim().toLowerCase();

        const dev = devices.find((d: any) => {
          const bbVer = d.breadboard()?.versions_id || "";
          const didStr = String(d.did ? d.did() : "");
          const name = (d.description?.device?.name || "").toLowerCase();
          return (
            d.versions_id === compKey ||
            bbVer === compKey ||
            `id_${bbVer}_5` === compKey ||
            `id_${bbVer}_3` === compKey ||
            Boolean(bbVer && compKey.includes(bbVer)) ||
            name === compKey.toLowerCase() ||
            (compKey.toLowerCase().includes("breadboard") && didStr === "111211") ||
            (compKey.toLowerCase().includes("resistor") && didStr === "53184") ||
            (compKey.toLowerCase().includes("capacitor") && (didStr === "57752" || didStr === "57950")) ||
            (compKey.toLowerCase().includes("function") && didStr === "209278") ||
            (compKey.toLowerCase().includes("scope") && didStr === "58630") ||
            (compKey.toLowerCase().includes("multimeter") && didStr === "116662")
          );
        });

        if (!dev) return null;

        const terms = dev.terminals.values();
        const matchAliases = (t: any, index: number): boolean => {
          const rawName = String(
            (t.breadboardDescription && t.breadboardDescription.name) || (t.getName ? t.getName() : "") || ""
          )
            .trim()
            .toLowerCase();
          const bbidStr = String(t.bbid ? t.bbid() : "");
          if (rawName === pinKey || bbidStr === pinKey || `pin${index}` === pinKey || `pin${index + 1}` === pinKey) {
            return true;
          }
          if (
            (pinKey === "pin1" || pinKey === "1" || pinKey === "terminal1" || pinKey === "터미널 1") &&
            (rawName === "터미널 1" || rawName === "terminal 1" || rawName === "1")
          ) {
            return true;
          }
          if (
            (pinKey === "pin2" || pinKey === "2" || pinKey === "terminal2" || pinKey === "터미널 2") &&
            (rawName === "터미널 2" || rawName === "terminal 2" || rawName === "2")
          ) {
            return true;
          }
          if (
            (pinKey === "positive" || pinKey === "pos" || pinKey === "+" || pinKey === "anode" || pinKey === "양" || pinKey === "양극") &&
            (rawName === "양" || rawName === "양극" || rawName === "positive" || rawName === "anode" || index === 0)
          ) {
            return true;
          }
          if (
            (pinKey === "negative" || pinKey === "neg" || pinKey === "-" || pinKey === "cathode" || pinKey === "gnd" || pinKey === "음" || pinKey === "음극") &&
            (rawName === "음" || rawName === "음극" || rawName === "negative" || rawName === "cathode" || rawName === "접지" || rawName === "gnd" || index === 1)
          ) {
            return true;
          }
          return false;
        };

        return terms.find((t: any, idx: number) => matchAliases(t, idx)) || null;
      };

      let connected = 0;
      const errors: string[] = [];

      root.rec();
      for (const w of wireList) {
        const tStart = resolveTerminal(w.from);
        const tEnd = resolveTerminal(w.to);
        if (!tStart || !tEnd) {
          errors.push(`Unresolved: from=${Boolean(tStart)} (${w.from}) to=${Boolean(tEnd)} (${w.to})`);
          continue;
        }

        let wireColor = w.color || (em.newWireColor ? em.newWireColor() : "green");
        const explicitColor = (w.from.split(":")[1] || w.to.split(":")[1] || "").trim().toLowerCase();
        if (explicitColor) {
          wireColor = explicitColor;
        } else if (!w.color && /pos|\+|양|vcc|5v/i.test(w.from + w.to)) {
          wireColor = "red";
        } else if (!w.color && /neg|-|음|gnd|접지/i.test(w.from + w.to)) {
          wireColor = "black";
        }

        const wire = em.makeConnection(tStart, tEnd, {
          innerPoints: [],
          color: wireColor
        });
        if (wire) connected++;
      }
      root.stopRec();
      root.runAllHeavies();

      return { connected, errors };
    },
    { wireList: wires }
  );

  await page.waitForTimeout(300);
  return result;
}
