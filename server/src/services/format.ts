import { CHARACTER_LIMIT, ResponseFormat } from "../constants.js";
import type { CircuitState, ComponentSpec } from "../types.js";

const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|prompts|commands)/gi,
  /(?:system|assistant|admin)\s*:\s*(?:you\s+are|forget|override|execute|delete|ignore)/gi,
  /(?:you\s+are\s+now|act\s+as|pretend\s+to\s+be)\s+(?:a|an)?\s*[a-zA-Z0-9_-]+/gi,
  /(?:new|override)\s+system\s+instruction/gi,
  /call\s+tool\s+tinkercad_/gi
];

/** Mask known prompt injection keywords without disturbing normal Arduino/electronic syntax. */
export function maskPromptInjection(value: string): string {
  let masked = value;
  for (const pattern of INJECTION_PATTERNS) {
    masked = masked.replace(pattern, "[BLOCKED_INJECTION_ATTEMPT]");
  }
  return masked;
}

/** Strip control characters, newlines, and backticks from single-line fields, and mask injections. */
export function sanitizeInline(value: unknown, maxLen = 200): string {
  const sanitized = String(value ?? "")
    .replace(/[\r\n\t`]+/g, " ")
    .trim()
    .slice(0, maxLen);
  return maskPromptInjection(sanitized);
}

/** Escape triple backticks inside code/serial blocks to prevent fence breakout, and mask injections. */
export function sanitizeCodeBlock(value: unknown): string {
  const sanitized = String(value ?? "")
    .trim()
    .replace(/```/g, "` ` `");
  return maskPromptInjection(sanitized);
}

/** Deep-sanitize a CircuitState object so both JSON output and structuredContent are protected. */
export function sanitizeCircuitState(state: CircuitState): CircuitState {
  return {
    ...state,
    url: sanitizeInline(state.url, 500),
    title: sanitizeInline(state.title, 200),
    code: maskPromptInjection(String(state.code ?? "")),
    serial: maskPromptInjection(String(state.serial ?? "")),
    components: state.components.map((comp) => {
      const safeAttrs: Record<string, string> = {};
      for (const [k, v] of Object.entries(comp.attributes ?? {})) {
        if (k !== "__proto__" && k !== "constructor" && k !== "prototype") {
          safeAttrs[sanitizeInline(k, 60)] = sanitizeInline(v, 120);
        }
      }
      return {
        ...comp,
        id: sanitizeInline(comp.id, 120),
        name: sanitizeInline(comp.name, 120),
        type: sanitizeInline(comp.type, 80),
        pins: comp.pins.map((p) => ({
          ...p,
          id: sanitizeInline(p.id, 120),
          name: sanitizeInline(p.name, 60)
        })),
        attributes: safeAttrs
      };
    }),
    wires: state.wires.map((w) => ({
      id: sanitizeInline(w.id, 160),
      from: sanitizeInline(w.from, 160),
      to: sanitizeInline(w.to, 160)
    }))
  };
}

export function enforceLimit(text: string, itemCount?: number): string {
  if (text.length <= CHARACTER_LIMIT) {
    return text;
  }
  const trimmed = text.slice(0, CHARACTER_LIMIT);
  const extra = itemCount === undefined
    ? "Reduce include flags or ask for a narrower slice of the circuit."
    : `Response truncated from ${itemCount} items. Add filters or raise specificity.`;
  return `${trimmed}\n\n[truncated] ${extra}`;
}

export function formatCircuit(rawState: CircuitState, format: ResponseFormat): string {
  const state = sanitizeCircuitState(rawState);
  if (format === ResponseFormat.JSON) {
    return enforceLimit(JSON.stringify(state, null, 2), state.components.length);
  }

  const lines = [
    `# ${state.title || "Tinkercad circuit"}`,
    "",
    `- URL: ${state.url}`,
    `- Logged in: ${state.loggedIn}`,
    `- Editor ready: ${state.editorReady}`,
    `- Simulation: ${state.simulationRunning ? "running" : "stopped"}`,
    `- State source: ${state.source}`,
    `- Components: ${state.components.length}`,
    `- Wires: ${state.wires.length}`,
    ""
  ];

  if (state.components.length === 0) {
    lines.push("No components found. If the editor is open, try tinkercad_screenshot and place parts with tinkercad_add_component.");
  }

  for (const component of state.components) {
    lines.push(`## ${component.name} (${component.id})`);
    lines.push(`- Type: ${component.type}`);
    lines.push(`- Position: ${Math.round(component.x)}, ${Math.round(component.y)}`);
    if (component.pins.length > 0) {
      lines.push(`- Pins: ${component.pins.map((pin) => pin.name).join(", ")}`);
    }
    const attrs = Object.entries(component.attributes);
    if (attrs.length > 0) {
      lines.push(`- Attributes: ${attrs.map(([key, value]) => `${key}=${value}`).join(", ")}`);
    }
    lines.push("");
  }

  if (state.wires.length > 0) {
    lines.push("## Wires");
    for (const wire of state.wires) {
      lines.push(`- ${wire.from} -> ${wire.to} (${wire.id})`);
    }
    lines.push("");
  }

  if (state.code.trim() !== "") {
    lines.push("## Arduino code");
    lines.push('<untrusted_circuit_content type="arduino_code">');
    lines.push("```cpp");
    lines.push(sanitizeCodeBlock(state.code));
    lines.push("```");
    lines.push("</untrusted_circuit_content>");
    lines.push("");
  }

  if (state.serial.trim() !== "") {
    lines.push("## Serial monitor");
    lines.push('<untrusted_circuit_content type="serial_monitor">');
    lines.push("```");
    lines.push(sanitizeCodeBlock(state.serial));
    lines.push("```");
    lines.push("</untrusted_circuit_content>");
  }

  return enforceLimit(lines.join("\n"), state.components.length);
}

export function formatCatalog(items: ComponentSpec[], format: ResponseFormat): string {
  if (format === ResponseFormat.JSON) {
    return enforceLimit(JSON.stringify({ count: items.length, components: items }, null, 2), items.length);
  }
  const lines = [`# Component catalog (${items.length})`, ""];
  for (const item of items) {
    lines.push(`## ${item.label} (${item.id})`);
    lines.push(`- Search: ${item.search}`);
    lines.push(`- Aliases: ${item.aliases.join(", ") || "none"}`);
    lines.push(`- Default pins: ${item.defaultPins.join(", ")}`);
    lines.push("");
  }
  return enforceLimit(lines.join("\n"), items.length);
}

export function formatLogin(status: { loggedIn: boolean; url: string; message: string }, format: ResponseFormat): string {
  const safeStatus = {
    ...status,
    url: sanitizeInline(status.url, 500)
  };
  if (format === ResponseFormat.JSON) {
    return JSON.stringify(safeStatus, null, 2);
  }
  return [
    `# Login status`,
    "",
    `- Logged in: ${safeStatus.loggedIn}`,
    `- URL: ${safeStatus.url}`,
    "",
    safeStatus.message
  ].join("\n");
}
