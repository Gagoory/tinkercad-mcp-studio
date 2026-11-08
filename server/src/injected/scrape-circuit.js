(() => {
  const interesting = Object.getOwnPropertyNames(window)
    .filter((name) => /tinker|circuit|autodesk|editor|breadboard|arduino/i.test(name))
    .slice(0, 40);

  const has = (selector) => Boolean(document.querySelector(selector));

  const simBtn = document.querySelector("#SIMULATION_ID");
  const simBtnText = simBtn ? (simBtn.textContent || "").trim() : "";
  const isStopVisible =
    /stop simulation|시뮬레이션 중지/i.test(simBtnText) ||
    Boolean(simBtn && simBtn.classList.contains("is-active")) ||
    Boolean(
      Array.from(document.querySelectorAll("button, a, [role='button']")).find((el) =>
        /stop simulation|시뮬레이션 중지/i.test(el.textContent || "")
      )
    );
  const isStartVisible =
    !isStopVisible &&
    (Boolean(simBtn) ||
      Boolean(
        Array.from(document.querySelectorAll("button, a, [role='button']")).find((el) =>
          /start simulation|시뮬레이션 시작/i.test(el.textContent || "")
        )
      ));

  const capabilities = {
    hasBreadboardSvg: has("#breadboardTab svg"),
    hasSerialInput: has(".js-code_panel__serial__input"),
    hasSerialSend: has(".js-code_panel__serial__send"),
    hasSerialOutput: Boolean(
      document.querySelector(".js-code_panel__serial__content, .code_panel__serial__text, .code_panel__serial__out, .serial-monitor")
    ),
    hasCodeMirror: has(".CodeMirror"),
    hasAce: Boolean(window.ace) || has(".ace_editor"),
    hasMonaco: has(".monaco-editor"),
    hasCodeTextarea: Boolean(document.querySelector("#CODE_EDITOR_ID textarea, .code_panel textarea")),
    hasStartSimulation: isStartVisible,
    hasStopSimulation: isStopVisible,
    hasInspector: has(".inspector"),
    interestingGlobals: interesting
  };

  const simulationRunning = isStopVisible;

  let code = "";
  const cmHost = document.querySelector(".CodeMirror");
  if (cmHost && cmHost.CodeMirror) {
    code = cmHost.CodeMirror.getValue();
  }
  const aceEl = document.querySelector(".ace_editor");
  if (!code && aceEl && aceEl.env && aceEl.env.editor) {
    code = aceEl.env.editor.getValue();
  }
  const textarea = document.querySelector("#CODE_EDITOR_ID textarea, .code_panel textarea");
  if (!code && textarea) {
    code = textarea.value;
  }

  const serialSelectors = [
    ".code_panel__serial__content__text",
    ".js-code_panel__serial__text",
    ".code_panel__serial__text",
    ".code_panel__serial__out"
  ];
  let serial = "";
  for (const selector of serialSelectors) {
    const node = document.querySelector(selector);
    if (node && (node.textContent || "").trim().length > 0) {
      serial = (node.textContent || "").trim();
      break;
    }
  }

  const DID_TO_TYPE = {
    "132521": "arduino_uno_r3",
    "58422": "led",
    "53184": "resistor",
    "111211": "breadboard_small",
    "144786": "pushbutton",
    "45547": "potentiometer",
    "116691": "photoresistor",
    "57752": "capacitor",
    "57950": "polarized_capacitor",
    "209278": "function_generator",
    "58630": "oscilloscope",
    "111724": "power_supply",
    "116662": "multimeter",
    "58208": "inductor",
    "58320": "diode",
    "116841": "battery_9v",
    "114067": "piezo",
    "142073": "servo",
    "219295": "ultrasonic",
    "113878": "lcd_16x2",
    "58458": "slide_switch"
  };

  function normalizePinName(raw, index) {
    const s = String(raw || "").trim();
    if (!s) return "pin" + (index + 1);
    if (s === "터미널 1" || s === "Terminal 1" || s === "1") return "pin1";
    if (s === "터미널 2" || s === "Terminal 2" || s === "2") return "pin2";
    if (s === "양" || s === "Positive") return "positive";
    if (s === "음" || s === "Negative") return "negative";
    if (s === "양극" || s === "Anode") return "anode";
    if (s === "음극" || s === "Cathode") return "cathode";
    if (s === "접지") return "GND";
    return s;
  }

  const components = [];
  const wires = [];
  const svg = document.querySelector("#breadboardTab svg");
  const svgBox = svg ? svg.getBoundingClientRect() : { x: 0, y: 0, width: 0, height: 0 };

  const ce = window.circuit_editor;
  const em = ce?.stateMachine?.breadboardStateMachine?.editorModel;

  if (ce && ce.data && ce.data.devices && typeof ce.data.devices.values === "function") {
    const devValues = ce.data.devices.values();
    for (const d of devValues) {
      const didStr = String(d.did ? d.did() : "");
      const bb = d.breadboard ? d.breadboard() : null;
      const bbVerId = String((bb ? bb.versions_id : d.versions_id) || "");
      const safeVerId =
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(bbVerId)
          : bbVerId.replace(/[^a-zA-Z0-9_-]/g, "");
      const svgGroup = svg && safeVerId
        ? svg.querySelector(`[id="id_${safeVerId}_5"], [id="id_${safeVerId}_3"], [id="id_${safeVerId}_14"], [id="id_${safeVerId}_13"]`)
        : null;
      const gBox = svgGroup ? svgGroup.getBoundingClientRect() : null;

      let screenX = gBox && gBox.width > 0 ? gBox.x : 0;
      let screenY = gBox && gBox.height > 0 ? gBox.y : 0;
      const width = gBox && gBox.width > 0 ? gBox.width : 60;
      const height = gBox && gBox.height > 0 ? gBox.height : 60;

      const realPos = bb && bb.pos ? bb.pos() : { x: 0, y: 0 };
      if ((screenX === 0 && screenY === 0) && em && em.toViewCoord) {
        const vc = em.toViewCoord(realPos);
        screenX = svgBox.x + vc.x;
        screenY = svgBox.y + vc.y;
      }

      const attrs = Object.assign(Object.create(null), {
        did: didStr,
        svgId: `id_${bbVerId}_5`,
        realX: String(Math.round(realPos.x * 100) / 100),
        realY: String(Math.round(realPos.y * 100) / 100),
        angle: String(bb && bb.angle ? bb.angle() : 0)
      });

      if (d.properties && typeof d.properties.forEach === "function") {
        d.properties.forEach((propId, propObj) => {
          const p = propObj && propObj.name ? propObj : propId;
          const propName = p && p.name ? String(p.name) : "";
          if (propName && propName !== "__proto__" && propName !== "constructor" && propName !== "prototype") {
            const val = p.value !== undefined && p.value !== null ? String(p.value) : "";
            const pfx = p.prefix && p.prefix !== "none" ? String(p.prefix) : "";
            attrs[propName] = (val && pfx && p.unit && p.unit[0] !== "[") ? `${val}${pfx}` : (pfx || val);
          }
        });
      }

      const rawTerminals = d.terminals && typeof d.terminals.values === "function" ? d.terminals.values() : [];
      const maxPins = didStr === "111211" ? 24 : 36;
      const pins = rawTerminals.slice(0, maxPins).map((t, idx) => {
        const rawName = (t.breadboardDescription && t.breadboardDescription.name) || (t.getName ? t.getName() : "") || "";
        const pinName = didStr === "111211" ? (rawName || `pin${idx}`) : normalizePinName(rawName, idx);
        let px = screenX + width / 2;
        let py = screenY + height / 2;
        if (t.getBreadboardPos && em && em.toViewCoord) {
          const tp = t.getBreadboardPos();
          const vc = em.toViewCoord(tp);
          px = svgBox.x + vc.x;
          py = svgBox.y + vc.y;
        }
        return {
          id: String(t.bbid ? t.bbid() : `${d.versions_id}-pin-${idx}`),
          name: pinName,
          x: Math.round(px * 10) / 10,
          y: Math.round(py * 10) / 10
        };
      });

      const descName = d.description?.device?.name || (d.getName ? d.getName() : "") || DID_TO_TYPE[didStr] || didStr;
      components.push({
        id: d.versions_id,
        name: descName,
        type: DID_TO_TYPE[didStr] || String(descName).toLowerCase().replace(/\s+/g, "_"),
        x: Math.round(screenX * 10) / 10,
        y: Math.round(screenY * 10) / 10,
        width: Math.round(width * 10) / 10,
        height: Math.round(height * 10) / 10,
        pins,
        attributes: attrs
      });
    }

    if (ce.data.wires && typeof ce.data.wires.values === "function") {
      for (const w of ce.data.wires.values()) {
        const isInsert = w.insert && w.insert();
        if (isInsert) continue;
        const b = w.begin ? w.begin() : null;
        const e = w.end ? w.end() : null;
        const bDev = b && b.parent ? b.parent() : null;
        const eDev = e && e.parent ? e.parent() : null;
        const bName = (b && b.breadboardDescription && b.breadboardDescription.name) || (b && b.bbid ? b.bbid() : "unknown");
        const eName = (e && e.breadboardDescription && e.breadboardDescription.name) || (e && e.bbid ? e.bbid() : "unknown");
        wires.push({
          id: w.versions_id || "wire",
          from: bDev ? `${bDev.versions_id}.${bName}` : String(bName),
          to: eDev ? `${eDev.versions_id}.${eName}` : String(eName)
        });
      }
    }
  }

  return {
    url: location.href,
    title: document.title,
    editorReady: Boolean(svg || document.querySelector("#CODE_EDITOR_ID")),
    simulationRunning,
    code,
    serial,
    components,
    wires,
    capabilities
  };
})()
