---
name: tinkercad-stl-generator
description: Generate custom 3D binary STL mesh files and OpenSCAD scripts that can be imported directly into Autodesk Tinkercad. Covers procedural shape generation, gears, brackets, enclosures, and Tinkercad import guidelines.
---

# Tinkercad STL & Asset Generator Skill

Use this skill when a user requires complex mathematical curves, parametric gears, custom mechanical brackets, or intricate 3D shapes that are difficult to model by hand in Tinkercad's web interface.

## Tinkercad Import Specifications

Autodesk Tinkercad allows users to import external 3D files directly into the editor:
- **Supported Formats**: `.stl`, `.obj`, `.svg` (2D vector extrusion).
- **File Size Limit**: Up to **25 MB** for 3D meshes, up to **4 MB** for SVG profiles.
- **Mesh Complexity**: Tinkercad caps imported meshes at approximately **300,000 triangles**.
- **Workplane Extents**: Default grid is $200\text{ mm} \times 200\text{ mm}$ (adjustable up to $1000\text{ mm} \times 1000\text{ mm}$ in Edit Grid settings).

---

## 1. Using the Built-In STL Generator Script

The plugin includes a zero-dependency Python script located at `scripts/stl_generator.py`.

### Generating a Custom Spur Gear:
```bash
python ~/.gemini/config/plugins/tinkercad/scripts/stl_generator.py \
  --type gear \
  --teeth 20 \
  --radius 30 \
  --height 8 \
  --bore 3.0 \
  --output custom_gear.stl
```

### Generating a Base Housing Box:
```bash
python ~/.gemini/config/plugins/tinkercad/scripts/stl_generator.py \
  --type box \
  --length 80 \
  --width 50 \
  --height 25 \
  --output housing_box.stl
```

---

## 2. Generating Parametric OpenSCAD Code for Tinkercad

For advanced mechanical components (involute gears, metric screw threads, Voronoi patterns), provide an OpenSCAD script that the user can render and export as STL:

### Example: Parametric Threaded Bolt & Nut Trap
```openscad
// Parametric M3 Standoff / Nut Trap for Tinkercad Import
$fn = 60;

module nut_trap_standoff(height = 15, outer_dia = 9, nut_width = 5.8, nut_depth = 3.0, screw_dia = 3.2) {
    difference() {
        // Outer cylindrical boss
        cylinder(h = height, r = outer_dia / 2);
        
        // M3 screw clearance hole through entire height
        translate([0, 0, -1])
            cylinder(h = height + 2, r = screw_dia / 2);
            
        // Hexagonal nut pocket at bottom
        translate([0, 0, -0.1])
            cylinder(h = nut_depth + 0.1, r = (nut_width / 2) / cos(30), $fn = 6);
    }
}

nut_trap_standoff();
```

---

## 3. Importing into Tinkercad

Instruct the user:
1. In your Tinkercad 3D Design editor, click the **Import** button in the top-right toolbar.
2. Drag and drop the generated `.stl` or click **Choose a file**.
3. In the Import dialog:
   - Ensure **Scale** is set to `100%`.
   - Verify dimensions match the intended millimeter dimensions.
   - Choose **Import to: Artboard**.
4. Click **Import**. The geometry will appear on your Tinkercad workplane as a single editable solid or hole!
