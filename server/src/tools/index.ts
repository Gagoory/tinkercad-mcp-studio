import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResponseFormat } from "../constants.js";
import { listCatalogMatches } from "../catalog.js";
import {
  AddComponentInputSchema,
  BuildCircuitInputSchema,
  ConnectPinsInputSchema,
  DeleteComponentInputSchema,
  DeleteWireInputSchema,
  GetCircuitInputSchema,
  GetCodeInputSchema,
  ListComponentsInputSchema,
  LoginStatusInputSchema,
  MoveComponentInputSchema,
  OpenCircuitInputSchema,
  ReadSerialInputSchema,
  ScreenshotInputSchema,
  SetAttributeInputSchema,
  SetCodeInputSchema,
  StartSimulationInputSchema,
  StopSimulationInputSchema,
  type AddComponentInput,
  type BuildCircuitInput,
  type ConnectPinsInput,
  type DeleteComponentInput,
  type DeleteWireInput,
  type GetCircuitInput,
  type GetCodeInput,
  type ListComponentsInput,
  type LoginStatusInput,
  type MoveComponentInput,
  type OpenCircuitInput,
  type ReadSerialInput,
  type SetAttributeInput,
  type SetCodeInput,
  RenameCircuitInputSchema,
  SetPrivacyInputSchema,
  WaitSaveInputSchema,
  type RenameCircuitInput,
  type SetPrivacyInput,
  type WaitSaveInput
} from "../schemas/index.js";
import {
  formatCatalog,
  formatCircuit,
  formatLogin,
  maskPromptInjection,
  sanitizeCircuitState,
  sanitizeCodeBlock,
  sanitizeInline
} from "../services/format.js";
import { redactLocalPaths } from "../services/errors.js";
import {
  addComponent,
  connectPins,
  deleteComponent,
  deleteWire,
  getCode,
  inspectCircuit,
  loginStatus,
  moveComponent,
  openCircuit,
  readSerial,
  setCode,
  setComponentAttribute,
  startSimulation,
  stopSimulation,
  takeScreenshot,
  renameCircuit,
  setCircuitPrivacy,
  waitForCloudSave,
  connectPinsBatch
} from "../services/editor-bridge.js";
import { errorResult, textResult } from "./helpers.js";

export function registerTools(server: McpServer): void {
  server.registerTool(
    "tinkercad_login_status",
    {
      title: "Tinkercad login status",
      description: `Check whether the persistent Chrome profile is signed in to Tinkercad.

Use this first on a new machine. If it reports not logged in, complete Autodesk sign-in in the opened Chrome window, then call this tool again.

Args:
  - response_format ('markdown' | 'json'): Output format

Returns:
  loggedIn, current URL, and the next action to take.`,
      inputSchema: LoginStatusInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: LoginStatusInput) => {
      try {
        const status = await loginStatus();
        return textResult(formatLogin(status, params.response_format), { ...status });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "tinkercad_open_circuit",
    {
      title: "Open Tinkercad circuit",
      description: `Open an existing Circuits design or start from the Circuits dashboard.

Args:
  - target (string): Full tinkercad.com URL, a thing id, or 'new'
  - response_format ('markdown' | 'json')

Returns:
  Circuit snapshot after the editor is ready.

Examples:
  - target="new"
  - target="https://www.tinkercad.com/things/abc123/editel"
  - target="abc123"

Error Handling:
  - Login wall: sign in in Chrome, then retry
  - Non-Tinkercad URLs are rejected`,
      inputSchema: OpenCircuitInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: OpenCircuitInput) => {
      try {
        const state = await openCircuit(params.target);
        return textResult(formatCircuit(state, params.response_format), { ...sanitizeCircuitState(state) });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "tinkercad_get_circuit",
    {
      title: "Inspect open circuit",
      description: `Read the currently open Circuits editor: components, pins, wires, code, serial, and simulation flag.

Call this after every build step so later tools use real component ids.

Args:
  - include_code (boolean, default true)
  - include_serial (boolean, default true)
  - include_pins (boolean, default true)
  - response_format ('markdown' | 'json')

Returns:
  Structured circuit state. Component ids from this tool are required by move/delete/wire tools.`,
      inputSchema: GetCircuitInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: GetCircuitInput) => {
      try {
        const state = await inspectCircuit();
        if (!params.include_code) {
          state.code = "";
        }
        if (!params.include_serial) {
          state.serial = "";
        }
        if (!params.include_pins) {
          state.components = state.components.map((component) => ({ ...component, pins: [] }));
        }
        return textResult(formatCircuit(state, params.response_format), { ...sanitizeCircuitState(state) });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "tinkercad_screenshot",
    {
      title: "Screenshot Circuits editor",
      description: `Capture the visible Circuits editor as a PNG.

Use when SVG scrape is incomplete and you need to see placement, wiring, or LED state.

Returns:
  An image plus the temp file path.`,
      inputSchema: ScreenshotInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async () => {
      try {
        const shot = await takeScreenshot();
        return {
          content: [
            { type: "image", data: shot.base64, mimeType: "image/png" },
            { type: "text", text: `Screenshot saved to ${redactLocalPaths(shot.path)}` }
          ]
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "tinkercad_list_components",
    {
      title: "List known Circuits components",
      description: `List the local catalog of Tinkercad Circuits parts this server knows how to search for.

This does not scrape Autodesk. It is the allowed vocabulary for tinkercad_add_component and tinkercad_build_circuit.

Args:
  - query (string, optional): Filter by id, label, or alias
  - response_format ('markdown' | 'json')`,
      inputSchema: ListComponentsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params: ListComponentsInput) => {
      const items = listCatalogMatches(params.query);
      if (items.length === 0) {
        return textResult(
          `No catalog matches for '${sanitizeInline(params.query, 80)}'. Try led, resistor, arduino_uno_r3, breadboard_small, or call this tool with no query.`
        );
      }
      return textResult(formatCatalog(items, params.response_format), {
        count: items.length,
        components: items
      });
    }
  );

  server.registerTool(
    "tinkercad_add_component",
    {
      title: "Add Circuits component",
      description: `Search the Circuits parts panel and drop a component onto the canvas.

Args:
  - component (string): Catalog id or search text (led, resistor, Arduino Uno R3)
  - x (number): Canvas X in pixels (default 320)
  - y (number): Canvas Y in pixels (default 240)
  - response_format

Returns:
  Updated circuit snapshot. Prefer ids from the returned components list for later wiring.

Error Handling:
  - Unknown part: call tinkercad_list_components
  - Editor closed: call tinkercad_open_circuit first`,
      inputSchema: AddComponentInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: AddComponentInput) => {
      try {
        const state = await addComponent(params.component, params.x, params.y);
        return textResult(formatCircuit(state, params.response_format), { ...sanitizeCircuitState(state) });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "tinkercad_move_component",
    {
      title: "Move Circuits component",
      description: `Drag an existing component to a new canvas position.

Args:
  - component_id (string): Id from tinkercad_get_circuit
  - x, y (number)
  - response_format`,
      inputSchema: MoveComponentInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: MoveComponentInput) => {
      try {
        const state = await moveComponent(params.component_id, params.x, params.y);
        return textResult(formatCircuit(state, params.response_format), { ...sanitizeCircuitState(state) });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "tinkercad_delete_component",
    {
      title: "Delete Circuits component",
      description: `Select a component and delete it from the open circuit.

Args:
  - component_id (string)
  - response_format

This removes the part and its attached wires.`,
      inputSchema: DeleteComponentInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: DeleteComponentInput) => {
      try {
        const state = await deleteComponent(params.component_id);
        return textResult(formatCircuit(state, params.response_format), { ...sanitizeCircuitState(state) });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "tinkercad_connect_pins",
    {
      title: "Wire two pins",
      description: `Click-to-wire two pins on the open circuit.

Args:
  - from (string): componentId.pinName (example: uno.D13)
  - to (string): componentId.pinName (example: led1.anode)
  - response_format

Call tinkercad_get_circuit first so pin names match what the editor actually exposed.`,
      inputSchema: ConnectPinsInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: ConnectPinsInput) => {
      try {
        const state = await connectPins(params.from, params.to);
        return textResult(formatCircuit(state, params.response_format), { ...sanitizeCircuitState(state) });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "tinkercad_delete_wire",
    {
      title: "Delete a wire",
      description: `Select a wire by id and delete it.

Args:
  - wire_id (string): Id from tinkercad_get_circuit
  - response_format`,
      inputSchema: DeleteWireInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: DeleteWireInput) => {
      try {
        const state = await deleteWire(params.wire_id);
        return textResult(formatCircuit(state, params.response_format), { ...sanitizeCircuitState(state) });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "tinkercad_set_component_attribute",
    {
      title: "Set component attribute",
      description: `Change an inspector field on a selected component (resistance, color, value).

Args:
  - component_id (string)
  - name (string): Field label, e.g. resistance or color
  - value (string): e.g. 220 or red
  - response_format`,
      inputSchema: SetAttributeInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: SetAttributeInput) => {
      try {
        const state = await setComponentAttribute(params.component_id, params.name, params.value);
        return textResult(formatCircuit(state, params.response_format), { ...sanitizeCircuitState(state) });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "tinkercad_get_code",
    {
      title: "Read Arduino code",
      description: `Open the Code panel, switch to Text mode, and return the sketch.

Args:
  - response_format`,
      inputSchema: GetCodeInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: GetCodeInput) => {
      try {
        const code = await getCode();
        const payload = { code: maskPromptInjection(code) };
        const text = params.response_format === ResponseFormat.JSON
          ? JSON.stringify(payload, null, 2)
          : `# Arduino sketch\n\n<untrusted_circuit_content type="arduino_code">\n\`\`\`cpp\n${sanitizeCodeBlock(code)}\n\`\`\`\n</untrusted_circuit_content>`;
        return textResult(text, payload);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "tinkercad_set_code",
    {
      title: "Write Arduino code",
      description: `Replace the entire Text-mode Arduino sketch.

Args:
  - code (string): Full sketch, including setup() and loop()

Switching from Blocks to Text is done automatically when the dropdown is present.`,
      inputSchema: SetCodeInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: SetCodeInput) => {
      try {
        await setCode(params.code);
        return textResult("Arduino sketch written to the Code panel.");
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "tinkercad_start_simulation",
    {
      title: "Start Circuits simulation",
      description: `Press Start Simulation in the open editor.

After starting, wait and call tinkercad_read_serial or tinkercad_screenshot to observe results.`,
      inputSchema: StartSimulationInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async () => {
      try {
        await startSimulation();
        return textResult("Simulation started.");
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "tinkercad_stop_simulation",
    {
      title: "Stop Circuits simulation",
      description: `Press Stop Simulation in the open editor.`,
      inputSchema: StopSimulationInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async () => {
      try {
        await stopSimulation();
        return textResult("Simulation stopped.");
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "tinkercad_read_serial",
    {
      title: "Read serial monitor",
      description: `Read text currently shown in the Circuits serial monitor.

Args:
  - wait_ms (number, default 1500): Delay before reading so the sketch can print
  - response_format

The Code panel is opened if needed. Empty output usually means the sketch never called Serial.begin / Serial.println, or simulation is stopped.`,
      inputSchema: ReadSerialInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: ReadSerialInput) => {
      try {
        const serial = await readSerial(params.wait_ms);
        const payload = { serial: maskPromptInjection(serial), empty: serial.trim() === "" };
        const text = params.response_format === ResponseFormat.JSON
          ? JSON.stringify(payload, null, 2)
          : serial.trim() === ""
            ? "Serial monitor is empty. Start the simulation and confirm the sketch calls Serial.println."
            : `# Serial monitor\n\n<untrusted_circuit_content type="serial_monitor">\n\`\`\`\n${sanitizeCodeBlock(serial)}\n\`\`\`\n</untrusted_circuit_content>`;
        return textResult(text, payload);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "tinkercad_rename_circuit",
    {
      title: "Rename circuit project",
      description: `Rename the title of the currently open Tinkercad Circuits project.

Args:
  - title (string): Project title (e.g. '[실험1] RC 직렬회로')
  - response_format ('markdown' | 'json')

Returns:
  Updated circuit snapshot with the new title.`,
      inputSchema: RenameCircuitInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: RenameCircuitInput) => {
      try {
        const state = await renameCircuit(params.title);
        return textResult(formatCircuit(state, params.response_format), {
          ...sanitizeCircuitState(state)
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "tinkercad_set_privacy",
    {
      title: "Set circuit privacy and shareability",
      description: `Change the privacy of a Tinkercad Circuits project to shared, public, or private, allowing external access or copying across accounts.

Args:
  - target (string, optional): Thing ID or URL. If omitted, uses current circuit.
  - privacy ('shared' | 'public' | 'private'): Default 'shared'
  - response_format ('markdown' | 'json')

Returns:
  Canonical URL and sharing status.`,
      inputSchema: SetPrivacyInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: SetPrivacyInput) => {
      try {
        const res = await setCircuitPrivacy(params.target, params.privacy);
        const md = `# Tinkercad Project Privacy Updated\n\n- Project URL: [${res.url}](${res.url})\n- Thing ID: \`${res.thingId}\`\n- Privacy: **${res.privacy}**\n- Shared: **${res.isShared}**\n\nUsers with this link can view and copy this circuit to their account using '[복사하여 팅커링]'.`;
        return textResult(params.response_format === ResponseFormat.JSON ? JSON.stringify(res, null, 2) : md, { ...res });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "tinkercad_wait_save",
    {
      title: "Wait for cloud auto-save sync",
      description: `Wait for Tinkercad's debounced cloud auto-save to sync with Autodesk servers, ensuring changes persist before closing the browser.

Args:
  - wait_ms (number): Milliseconds to wait (default 6000)
  - response_format ('markdown' | 'json')

Returns:
  Save confirmation status.`,
      inputSchema: WaitSaveInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: WaitSaveInput) => {
      try {
        const res = await waitForCloudSave(params.wait_ms);
        return textResult(`Cloud auto-save wait completed (${res.waitMs} ms). Changes synced to Autodesk servers.`, { ...res });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "tinkercad_build_circuit",
    {
      title: "Build circuit from netlist",
      description: `Place components, set attributes, wire pins, and optionally write Arduino code in one call.

This is a convenience workflow over the primitive tools. Prefer primitives when you need to recover from a single failed step.

Args:
  - start_new (boolean): Open a new circuit first
  - components: [{ ref, type, x?, y?, attributes? }]
  - wires: [{ from, to }] using ref.pin (example: uno.D13 -> led1.anode)
  - code (string, optional)
  - response_format

Example:
  components: [
    { "ref": "uno", "type": "arduino_uno_r3", "x": 220, "y": 220 },
    { "ref": "led1", "type": "led", "x": 520, "y": 220, "attributes": { "color": "red" } },
    { "ref": "r1", "type": "resistor", "x": 520, "y": 340, "attributes": { "resistance": "220" } }
  ]
  wires: [
    { "from": "uno.D13", "to": "led1.anode" },
    { "from": "led1.cathode", "to": "r1.pin1" },
    { "from": "r1.pin2", "to": "uno.GND" }
  ]`,
      inputSchema: BuildCircuitInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: BuildCircuitInput) => {
      try {
        if (params.start_new) {
          await openCircuit("new");
        }
        const refToId = new Map<string, string>();
        let index = 0;
        for (const item of params.components) {
          const x = item.x ?? 240 + (index % 3) * 180;
          const y = item.y ?? 200 + Math.floor(index / 3) * 160;
          const before = await inspectCircuit();
          const after = await addComponent(item.type, x, y);
          const added = after.components.find((component) => {
            return !before.components.some((existing) => existing.id === component.id);
          }) ?? after.components[after.components.length - 1];
          if (added) {
            refToId.set(item.ref, added.id);
            if (item.attributes) {
              for (const [name, value] of Object.entries(item.attributes)) {
                await setComponentAttribute(added.id, name, value);
              }
            }
          }
          index += 1;
        }

        if (params.title) {
          await renameCircuit(params.title);
        }

        const resolveRef = (pinRef: string): string => {
          const dot = pinRef.lastIndexOf(".");
          if (dot <= 0) {
            return pinRef;
          }
          const ref = pinRef.slice(0, dot);
          const pin = pinRef.slice(dot + 1);
          const id = refToId.get(ref) ?? ref;
          return `${id}.${pin}`;
        };

        if (params.wires.length > 0) {
          const batchWires = params.wires.map(w => ({
            from: resolveRef(w.from),
            to: resolveRef(w.to),
            color: (w as any).color
          }));
          await connectPinsBatch(batchWires);
        }

        if (params.code) {
          await setCode(params.code);
        }

        if (params.wait_for_save) {
          await waitForCloudSave(5000);
        }

        if (params.privacy) {
          await setCircuitPrivacy(undefined, params.privacy);
        }

        const state = await inspectCircuit();
        return textResult(formatCircuit(state, params.response_format), {
          refs: Object.fromEntries(refToId),
          ...sanitizeCircuitState(state)
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
