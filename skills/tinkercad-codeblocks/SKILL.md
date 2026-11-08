---
name: tinkercad-codeblocks
description: Algorithmic and computational 3D modeling using Autodesk Tinkercad Codeblocks. Generates visual block-by-block instructions, mathematical spirals, parametric gears, arrays, lattices, and generative 3D models.
---

# Tinkercad Codeblocks Skill

Use this skill when creating procedural, algorithmic, or parametric 3D models using Autodesk Tinkercad's **Codeblocks** computational design environment.

## Codeblocks Anatomy & Categories

Tinkercad Codeblocks operates on a sequential stack of visual programming blocks:

1. **Shapes** (Blue):
   - `Create New Object [name]`
   - `Add [Box / Cylinder / Sphere / Torus / Cone / Star]`
   - Properties: Dimensions (W, L, H), Radius, Tube Radius, Steps, Color / Hole.
2. **Modify** (Purple):
   - `Move [X, Y, Z]` (Translates current object)
   - `Rotate around [X / Y / Z] axis by [Degrees]`
   - `Scale [X, Y, Z]`
   - `Create Group` (Executes CSG union and cuts all active holes)
3. **Control** (Orange):
   - `Repeat [N] times`
   - `Count with [variable] from [Start] to [End] by [Step]`
4. **Math & Variables** (Green):
   - `Create Variable [var]`, `Set [var] to [value]`, `Change [var] by [delta]`
   - `[A] + [B]`, `[A] * [B]`, `sin(A)`, `cos(A)`, `Random between [min] and [max]`

---

## Parametric Recipe 1: Spiral Staircase with Central Column

### Visual Block Stack:
```
1. [Shapes] Create New Object [Staircase]
2. [Shapes] Add [Cylinder] (Radius: 5, Height: 120, Steps: 32)
3. [Modify] Move [X: 0, Y: 0, Z: 60]
4. [Control] Count with [stepNum] from [0] to [24] by [1]
     ┌─ [Shapes] Add [Box] (Width: 8, Length: 35, Height: 4)
     ├─ [Modify] Move [X: 17.5, Y: 0, Z: 0]
     ├─ [Modify] Rotate around [Z] axis by [stepNum * 15] degrees
     └─ [Modify] Move [X: 0, Y: 0, Z: (stepNum * 4.5) + 2]
5. [Modify] Create Group
```

**Parameters & Explanation**:
- **Central Post**: Cylinder $10\text{ mm}$ diameter, $120\text{ mm}$ high.
- **Treads**: 25 steps, each step rotates $15^\circ$ around the Z-axis and rises by $4.5\text{ mm}$ in elevation.
- **Output**: A complete self-supporting spiral staircase ready for 3D printing.

---

## Parametric Recipe 2: Precision Spur Gear / Sprocket

### Visual Block Stack:
```
1. [Shapes] Create New Object [SpurGear]
2. [Data]   Set [numTeeth] to [16]
3. [Shapes] Add [Cylinder] (Radius: 25, Height: 8, Steps: 40)
4. [Control] Count with [i] from [1] to [numTeeth] by [1]
     ┌─ [Shapes] Add [Box] (Width: 6, Length: 8, Height: 8)
     ├─ [Modify] Move [X: 25, Y: 0, Z: 0]
     └─ [Modify] Rotate around [Z] axis by [i * (360 / numTeeth)] degrees
5. [Shapes] Add [Cylinder (Hole)] (Radius: 2.5, Height: 12, Steps: 24) (Center Bore)
6. [Modify] Create Group
```

**Parameters & Explanation**:
- **Pitch Radius**: $25\text{ mm}$.
- **Tooth Count**: 16 teeth evenly arrayed via `360 / numTeeth` ($22.5^\circ$ spacing).
- **Center Hole**: $5\text{ mm}$ shaft bore for standard NEMA 17 stepper or micro DC motor.

---

## Parametric Recipe 3: Twisted Generative Vase / Planter

```
1. [Shapes] Create New Object [TwistedVase]
2. [Data]   Set [levels] to [30]
3. [Control] Count with [h] from [0] to [levels] by [1]
     ┌─ [Shapes] Add [Polygon / Star] (Radius: 20 + (h * 0.4), Height: 2)
     ├─ [Modify] Rotate around [Z] axis by [h * 4] degrees
     └─ [Modify] Move [X: 0, Y: 0, Z: h * 2]
4. [Modify] Create Group
```

---

## Codeblocks Exporting & Tinkercad Integration
- Once generated in Codeblocks, click **Share / Export** -> **Part**.
- The generated parametric shape will automatically appear in your Tinkercad **"Your Creations"** shape library, allowing you to drag and drop it into regular Tinkercad 3D Design projects as an editable building block!
