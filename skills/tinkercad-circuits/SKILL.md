---
name: tinkercad-circuits
description: Design, wire, and program electronic circuits and microcontrollers in Autodesk Tinkercad Circuits. Generates breadboard wiring tables, circuit calculations, component specifications, and simulation-ready Arduino C++ sketches.
---

# Tinkercad Circuits & Arduino Skill

Use this skill when designing electronic schematics, breadboard layouts, or writing code for simulated microcontrollers in Autodesk Tinkercad Circuits.

## Supported Tinkercad Microcontrollers & Components

Tinkercad Circuits provides an interactive SPICE-backed electrical simulation engine with full support for:
- **Controllers**: Arduino Uno R3, ATtiny85, BBC micro:bit.
- **Sensors**: Ultrasonic Distance Sensor (HC-SR04 3-pin/4-pin), TMP36 Temperature, Photoresistor (LDR), PIR Motion, Tilt Sensor, Potentiometer, Flex Sensor, Force Sensor.
- **Actuators**: Micro Servo 9g, Hobby DC Motor, Gear Motor, L293D H-Bridge Driver, Piezo Buzzer, Relays.
- **Displays**: 16x2 Character LCD (Parallel 4-bit and I2C backpack), 7-Segment Displays, NeoPixel Rings/Strips.

---

## Standard Wiring Specification Table

Every circuit recommendation must include a structured wiring map matching Tinkercad's breadboard coordinate system:

```markdown
| Component | Component Pin | Arduino / Power Rail | Wire Color | Function / Purpose |
| :--- | :--- | :--- | :--- | :--- |
| Arduino Uno | 5V | Breadboard Red (+) Rail | Red | 5V System Power |
| Arduino Uno | GND | Breadboard Blue (-) Rail| Black | Common Ground |
| Red LED | Anode (long leg) | Arduino Pin 9 (PWM) | Yellow | Output via 220Ω Resistor |
| Red LED | Cathode (short) | Breadboard (-) Rail | Black | Return to Ground |
| HC-SR04 | VCC | Breadboard (+) Rail | Red | Power |
| HC-SR04 | GND | Breadboard (-) Rail | Black | Ground |
| HC-SR04 | TRIG | Arduino Pin 7 | Green | Trigger Pulse |
| HC-SR04 | ECHO | Arduino Pin 6 | Blue | Echo Pulse |
```

---

## Circuit Formulas & Sensor Conversions

### 1. LED Current Limiting Resistor
$$R = \frac{V_{cc} - V_{forward}}{I_{target}}$$
- Standard Red/Yellow LED: $V_f \approx 2.0\text{V}$, $I_f = 15\text{--}20\text{ mA} \implies R = \frac{5 - 2}{0.015} = 200\,\Omega \to \mathbf{220\,\Omega}$.
- Blue/White LED: $V_f \approx 3.2\text{V}$, $I_f = 20\text{ mA} \implies R = \frac{5 - 3.2}{0.02} = 90\,\Omega \to \mathbf{150\,\Omega\text{ to }220\,\Omega}$.

### 2. TMP36 Precision Centigrade Temperature Sensor
- Output: $10\text{ mV} / ^\circ\text{C}$ with a $500\text{ mV}$ offset ($0^\circ\text{C} = 0.5\text{V}$).
```cpp
int rawADC = analogRead(A0);
float voltage = rawADC * (5.0 / 1024.0);
float temperatureC = (voltage - 0.5) * 100.0;
```

### 3. Ultrasonic Distance Sensor (HC-SR04)
```cpp
long duration;
digitalWrite(TRIG_PIN, LOW);
delayMicroseconds(2);
digitalWrite(TRIG_PIN, HIGH);
delayMicroseconds(10);
digitalWrite(TRIG_PIN, LOW);

duration = pulseIn(ECHO_PIN, HIGH);
float distanceCm = (duration * 0.0343) / 2.0;
```

---

## Template: Production-Ready Non-Blocking Arduino Sketch

Always use state machines and non-blocking `millis()` timers rather than `delay()`, so interactive Tinkercad buttons and sensors remain responsive during simulation:

```cpp
/*
 * Tinkercad Circuits Project: Non-Blocking Sensor & Actuator Controller
 * Designed for Arduino Uno R3 in Tinkercad Simulator
 */

// Pin Definitions
const int PIN_BUTTON    = 2;   // Pushbutton with internal pullup
const int PIN_LED_STATE = 13;  // Built-in indicator LED
const int PIN_PWM_LED   = 9;   // PWM Output
const int PIN_SENSOR_A  = A0;  // Analog input (Pot / LDR)

// Timing & State Management
unsigned long previousMillisTelemetry = 0;
const unsigned long TELEMETRY_INTERVAL = 250; // ms

int lastButtonState = HIGH;
bool systemActive = false;

void setup() {
  Serial.begin(9600);
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  pinMode(PIN_LED_STATE, OUTPUT);
  pinMode(PIN_PWM_LED, OUTPUT);
  
  Serial.println(F("--- Tinkercad Circuit Initialized ---"));
}

void loop() {
  unsigned long currentMillis = millis();

  // 1. Debounced Pushbutton Toggle
  int reading = digitalRead(PIN_BUTTON);
  if (reading == LOW && lastButtonState == HIGH) {
    systemActive = !systemActive;
    digitalWrite(PIN_LED_STATE, systemActive ? HIGH : LOW);
    Serial.print(F("System State: "));
    Serial.println(systemActive ? F("ON") : F("OFF"));
    delay(50); // Simple debounce in simulation
  }
  lastButtonState = reading;

  // 2. Analog Sensor Mapping
  int rawValue = analogRead(PIN_SENSOR_A);
  int brightness = map(rawValue, 0, 1023, 0, 255);
  analogWrite(PIN_PWM_LED, systemActive ? brightness : 0);

  // 3. Periodic Telemetry (Non-blocking)
  if (currentMillis - previousMillisTelemetry >= TELEMETRY_INTERVAL) {
    previousMillisTelemetry = currentMillis;
    if (systemActive) {
      Serial.print(F("ADC A0: "));
      Serial.print(rawValue);
      Serial.print(F(" | PWM: "));
      Serial.println(brightness);
    }
  }
}
```
