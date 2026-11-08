---
name: tinkercad-web-circuit-builder
description: Automate Autodesk Tinkercad Circuits in the browser via MCP tools. Opens Tinkercad, places components (Arduino, breadboards, sensors, actuators), routes color-coded wires, injects Arduino C++ code, and runs the simulation with serial monitoring.
---

# Tinkercad Web Circuit Builder Skill

This skill allows the agent to directly navigate to **Autodesk Tinkercad Circuits** (`https://www.tinkercad.com/circuits`), automatically place components onto the canvas or breadboard, connect wiring, upload Arduino C++ sketches, and run interactive simulations.

---

## 1. Architecture & One-Time Authentication

Tinkercad requires user authentication (Autodesk or Google Account). The browser automation engine uses a **persistent Chrome profile** managed by Playwright in `~/.gemini/config/plugins/tinkercad/server/.browser-profile/`.

### One-Time Login Setup
To authenticate your session:
1. Open PowerShell / Terminal and run:
   ```bash
   cd ~/.gemini/config/plugins/tinkercad/server
   npm start
   ```
2. A real Google Chrome window will open.
3. Sign in to your Tinkercad / Autodesk account.
4. Once you see your Tinkercad dashboard, you can close Chrome. The login session cookies are saved permanently in `.browser-profile/`.
5. Verify login anytime using the MCP tool `tinkercad_login_status`.

---

## 2. MCP Tools Overview

When the `tinkercad-circuits` MCP server is active, the following tools are available:

| Tool Name | Purpose | Key Parameters |
| :--- | :--- | :--- |
| `tinkercad_login_status` | Verify if session is authenticated | `response_format: 'markdown'` |
| `tinkercad_open_circuit` | Open existing circuit or create new | `target: 'new'` or URL / thing ID |
| `tinkercad_build_circuit` | **All-in-one circuit builder** | `start_new`, `components`, `wires`, `code` |
| `tinkercad_add_component` | Place a single part | `component`, `x`, `y` |
| `tinkercad_set_component_attribute` | Set resistance, color, etc. | `component_id`, `name`, `value` |
| `tinkercad_connect_pins` | Click-to-wire two pins | `from: 'uno.D13'`, `to: 'led1.anode'` |
| `tinkercad_delete_wire` | Remove a connection | `wire_id` |
| `tinkercad_set_code` | Inject Arduino C++ code | `code: '...'` |
| `tinkercad_get_code` | Read currently loaded sketch | `response_format` |
| `tinkercad_start_simulation` | Start the simulator engine | *(None)* |
| `tinkercad_stop_simulation` | Stop running simulation | *(None)* |
| `tinkercad_read_serial` | Read Serial Monitor output | `wait_seconds: 2` |
| `tinkercad_screenshot` | Capture current canvas screenshot| *(None)* |
| `tinkercad_get_circuit` | Inspect all components & pins | `include_code`, `include_pins` |

---

## 3. High-Level Automated Workflow (`tinkercad_build_circuit`)

The most efficient way to build an entire circuit on the web is the `tinkercad_build_circuit` convenience tool:

### Example: Automated Arduino Blink & Sensor Circuit
```json
{
  "start_new": true,
  "components": [
    { "ref": "uno", "type": "arduino_uno_r3", "x": 240, "y": 240 },
    { "ref": "bb", "type": "breadboard_small", "x": 580, "y": 240 },
    { "ref": "led1", "type": "led", "x": 580, "y": 140, "attributes": { "color": "red" } },
    { "ref": "r1", "type": "resistor", "x": 580, "y": 200, "attributes": { "resistance": "220" } }
  ],
  "wires": [
    { "from": "uno.5V", "to": "bb.power_plus_top" },
    { "from": "uno.GND", "to": "bb.power_minus_top" },
    { "from": "uno.D13", "to": "led1.anode" },
    { "from": "led1.cathode", "to": "r1.pin1" },
    { "from": "r1.pin2", "to": "uno.GND" }
  ],
  "code": "void setup() {\n  pinMode(13, OUTPUT);\n  Serial.begin(9600);\n  Serial.println(\"Circuit Online\");\n}\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}"
}
```

---

## 4. Component Catalog & Pin Naming Conventions

### Standard Component Catalog Types:
- **Controllers**: `arduino_uno_r3`, `attiny85`, `microbit`
- **Breadboards**: `breadboard_small`, `breadboard_mini`, `breadboard_large`
- **Passives & Discrete**: `resistor`, `capacitor`, `diode`, `transistor_npn`, `transistor_pnp`
- **Indicators & Displays**: `led`, `rgb_led`, `lcd_16x2`, `neopixel_ring_12`, `7segment`
- **Sensors**: `ultrasonic_distance_sensor`, `pir_sensor`, `tmp36`, `photoresistor`, `potentiometer`, `tilt_sensor`
- **Actuators**: `servo_micro`, `dc_motor`, `piezo`

### Standard Pin Naming Syntax:
- **Arduino**: `uno.5V`, `uno.3V3`, `uno.GND`, `uno.VIN`, `uno.A0` to `uno.A5`, `uno.D0` to `uno.D13`.
- **LED**: `led1.anode`, `led1.cathode`.
- **Resistor**: `r1.pin1`, `r1.pin2`.
- **Ultrasonic**: `sensor.vcc`, `sensor.trig`, `sensor.echo`, `sensor.gnd`.
- **Potentiometer**: `pot.terminal1`, `pot.wiper`, `pot.terminal2`.

---

## 5. Testing & Verification Loop

After the circuit is built:
1. Call `tinkercad_start_simulation` to begin electrical simulation.
2. Call `tinkercad_read_serial` (`wait_seconds: 3`) to verify telemetry from `Serial.print`.
3. Call `tinkercad_screenshot` to confirm LED illumination, servo rotation, or display contents.
4. Call `tinkercad_stop_simulation` when testing is complete.
