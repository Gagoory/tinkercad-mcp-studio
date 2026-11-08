---
name: tinkercad-3d-design
description: Design 3D models, mechanical parts, enclosures, and assemblies in Autodesk Tinkercad. Provides exact dimensional build plans, CSG cuts, hole groupings, fastener standards (M2/M3/M4), snap-fit joints, and 3D printing preparation.
---

# Tinkercad 3D Design & Modeling Skill

Use this skill when designing 3D objects, mechanical brackets, electronic enclosures, custom adapters, or maker projects in Autodesk Tinkercad.

## Core Modeling Workflow

Every Tinkercad model is constructed through **Constructive Solid Geometry (CSG)** using primitive shapes combined with additions and subtractions (holes).

```
   [Basic Solid Shape]  ──┐
                          ├─► [Align (L)] ─► [Group (Ctrl+G)] ─► [Finished Part]
   [Hole Cutter Shape]  ──┘
```

### 1. Project Planning & Primitive Selection
Break down any complex object into basic Tinkercad primitives:
- **Box**: Enclosures, chassis, rectangular cavities, brackets.
- **Cylinder**: Standoffs, screw bosses, shafts, rounded cutouts, holes.
- **Roof / Round Roof**: Wedges, chamfers, ergonomic finger grips, bevels.
- **Tube / Torus**: O-ring seals, washers, decorative borders, cable grommets.
- **Cone / Pyramid**: Countersinks, tapers, funnels, nozzles.
- **Text / Scribble**: Custom embossed or engraved labels, custom 2D profiles.

### 2. Standard Fastener Sizing Matrix (M2, M2.5, M3, M4, M5)

When adding screw holes or nut traps in Tinkercad, use these exact hole cylinder dimensions (including FDM 3D printer shrinkage compensation):

| Fastener | Close Clearance Hole Diameter | Loose Clearance Hole Diameter | Hex Nut Across Flats (Width) | Hex Nut Pocket Depth |
| :--- | :--- | :--- | :--- | :--- |
| **M2** | $2.2\text{ mm}$ | $2.4\text{ mm}$ | $4.3\text{ mm}$ | $1.8\text{ mm}$ |
| **M2.5** | $2.7\text{ mm}$ | $2.9\text{ mm}$ | $5.3\text{ mm}$ | $2.2\text{ mm}$ |
| **M3** | $3.2\text{ mm}$ | $3.4\text{ mm}$ | $5.8\text{ mm}$ | $2.6\text{ mm}$ |
| **M4** | $4.3\text{ mm}$ | $4.5\text{ mm}$ | $7.4\text{ mm}$ | $3.4\text{ mm}$ |
| **M5** | $5.3\text{ mm}$ | $5.5\text{ mm}$ | $8.4\text{ mm}$ | $4.2\text{ mm}$ |

> [!TIP]
> To create a countersink for flat-head screws, stack an inverted **Cone (Hole)** ($90^\circ$ taper) on top of the clearance cylinder before grouping.

---

## Enclosure Design Pattern: Snap-Fit & Standoffs

### Step 1: Base Shell
1. Drag a **Box (Solid)** onto the workplane:
   - Dimensions: $X = \text{Length}$, $Y = \text{Width}$, $Z = \text{Height}$.
2. Drag a **Box (Hole)** for the inner cavity:
   - Wall thickness $T = 1.6\text{ mm}$ to $2.0\text{ mm}$.
   - Inner dimensions: $X = (\text{Length} - 2T)$, $Y = (\text{Width} - 2T)$, $Z = (\text{Height} - T + 1)$.
   - Elevate inner box by $T\text{ mm}$ above the workplane.
3. Select both, press `L` (Align), click the center dots for $X$ and $Y$, and top dot for $Z$.
4. Press `Ctrl + G` to group. You now have a hollow open-top box.

### Step 2: PCB Mounting Standoffs
1. Drag a **Cylinder (Solid)**: Diameter $6.0\text{ mm}$, Height $5.0\text{ mm}$.
2. Drag a **Cylinder (Hole)**: Diameter $2.8\text{ mm}$ (for M3 self-tapping screw) or $3.2\text{ mm}$ (for heat-set insert), Height $6.0\text{ mm}$.
3. Align concentric and group.
4. Position at PCB mounting hole coordinates inside the base shell.

### Step 3: Snap-Fit Rim (Lip & Groove)
- **Base Rim**: Extends $1.5\text{ mm}$ above the wall with a $0.8\text{ mm}$ thickness on the inner perimeter.
- **Lid Recess**: Inner groove $0.9\text{ mm}$ wide (leaving a $0.2\text{ mm}$ clearance gap for FDM printing tolerance).

---

## 3D Printing Rules of Thumb
- **Horizontal Expansion**: Holes printed vertically on FDM printers typically shrink by $0.1\text{--}0.2\text{ mm}$ due to filament pull. Always oversize holes by $+0.2\text{ mm}$.
- **Overhangs**: Keep overhangs below $45^\circ$ relative to the vertical axis.
- **Chamfers over Fillets**: Fillets on the bottom edge create overhangs and elephant's foot issues. Use a $45^\circ$ chamfer or a $0.5\text{ mm}$ bottom bevel.
- **Layer Orientation**: The Z-axis is weakest due to inter-layer adhesion. Orient brackets so tensile forces act along the X-Y print plane.
