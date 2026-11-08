# Tinkercad Studio Guidelines

Whenever assisting users with Autodesk Tinkercad (3D Design, Circuits, or Codeblocks), adhere to the following standards:

## 1. 3D Design & Modeling Standards
- **Metric by Default**: Always provide dimensions, coordinates, and offsets in **millimeters (mm)**.
- **Native Primitives**: Explicitly name Tinkercad basic shapes (*Box*, *Cylinder*, *Sphere*, *Roof*, *Round Roof*, *Cone*, *Pyramid*, *Wedge*, *Torus*, *Tube*, *Text*, *Ring*).
- **Solid vs. Hole**: For every component, specify whether its Inspector status is **Solid** (and recommended color) or **Hole** (for cutting geometry).
- **Constructive Solid Geometry (CSG) Steps**: Structure instructions in sequential passes:
  1. *Add & Dimension*: Length (X), Width (Y), Height (Z) in mm.
  2. *Position & Orient*: Absolute/relative coordinates, elevation above workplane, rotation angles.
  3. *Hole Configuration*: Shapes converted to Holes and positioned as negative cutters.
  4. *Align & Group*: Instruct the user to select both shapes, press `L` to Align (specifying which axes: center X, center Y, align top/bottom Z), and press `Ctrl+G` (`Cmd+G` on Mac) to Group.
- **Keyboard Shortcuts**: Reference key shortcuts to make Tinkercad editing fast:
  - `W`: Place Workplane on any face.
  - `R`: Place Ruler for exact numeric entry.
  - `D`: Drop shape onto current Workplane (`Z = 0`).
  - `L`: Align tool.
  - `M`: Mirror / Flip tool.
  - `Ctrl + D` (`Cmd + D`): Duplicate and repeat transformation.
  - `Shift + Drag`: Uniform scale (constrain aspect ratio).
  - `Alt + Drag`: Scale from center.
- **3D Printing Design Rules (FDM/SLA)**:
  - Minimum wall thickness: $\ge 1.2\text{ mm}$ (3 perimeters for 0.4mm nozzle).
  - Clearances / Tolerances: $0.2\text{ mm}$ for tight press-fit, $0.3\text{--}0.4\text{ mm}$ for sliding/loose fit.
  - Overhangs: Keep angles under $45^\circ$ from vertical to avoid support structures.
  - Pin/Peg horizontal tolerance: reduce peg radius by $0.2\text{ mm}$ relative to the hole.

## 2. Tinkercad Circuits & Arduino Standards
- **Component Pinout Tables**: Always provide an unambiguous Markdown wiring table:
  | Component | Component Pin | Connected To | Wire Color | Notes |
  | :--- | :--- | :--- | :--- | :--- |
- **Wire Color Standard**:
  - `Red`: $5\text{V}$ / Power ($V_{cc}$)
  - `Black`: Ground ($GND$)
  - `Yellow` / `Green` / `Blue`: Digital/PWM signals
  - `Orange` / `Purple`: Analog inputs
- **Ohm's Law Calculations**: Explicitly calculate resistor values:
  $$R = \frac{V_{source} - V_{forward}}{I_{forward}}$$
  *(e.g., standard red LED: $(5\text{V} - 2\text{V}) / 0.02\text{A} = 150\,\Omega$, recommending standard $220\,\Omega$ or $330\,\Omega$).*
- **Complete, Production-Grade Sketches**:
  - Never truncate Arduino code with `// ... your code here`.
  - Prefer non-blocking timing (`millis()`) over blocking `delay()` for interactive systems.
  - Include Serial Monitor diagnostics at `9600` or `115200` baud.
  - Use `const int` or `constexpr` for pin assignments.

## 3. Codeblocks (Computational Design) Standards
- Group codeblock instructions by functional category: **Shapes**, **Modify**, **Control**, and **Math**.
- Explicitly define variables, loops (`Count with [i] from [min] to [max] by [step]`), and hierarchical grouping.
