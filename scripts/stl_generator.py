#!/usr/bin/env python3
"""
Tinkercad STL & 3D Asset Generator
Zero-dependency Python utility to generate 3D-printable binary STL files
that can be imported directly into Autodesk Tinkercad.
"""

import sys
import os
import math
import struct
import argparse
from pathlib import Path
from typing import List, Tuple

Point = Tuple[float, float, float]
Triangle = Tuple[Point, Point, Point]

def compute_normal(p1: Point, p2: Point, p3: Point) -> Point:
    """Computes the unit normal vector for a triangular facet."""
    u = (p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2])
    v = (p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2])
    nx = u[1] * v[2] - u[2] * v[1]
    ny = u[2] * v[0] - u[0] * v[2]
    nz = u[0] * v[1] - u[1] * v[0]
    length = math.sqrt(nx * nx + ny * ny + nz * nz)
    if length > 1e-9:
        return (nx / length, ny / length, nz / length)
    return (0.0, 0.0, 1.0)

def write_binary_stl(filename: str, triangles: List[Triangle], header_text: str = "Tinkercad Studio STL Generator"):
    """Writes a list of triangles to a binary STL file."""
    header = header_text.encode('ascii')[:80].ljust(80, b'\0')
    count = len(triangles)
    
    with open(filename, 'wb') as f:
        f.write(header)
        f.write(struct.pack('<I', count))
        for t in triangles:
            n = compute_normal(t[0], t[1], t[2])
            # Normal (3 floats), Vertices (3 * 3 floats), Attribute byte count (unsigned short = 0)
            data = struct.pack(
                '<3f 3f 3f 3f H',
                n[0], n[1], n[2],
                t[0][0], t[0][1], t[0][2],
                t[1][0], t[1][1], t[1][2],
                t[2][0], t[2][1], t[2][2],
                0
            )
            f.write(data)
    print(f"Successfully generated {filename} ({count} triangles).")

def generate_box(length: float, width: float, height: float, origin: Point = (0.0, 0.0, 0.0)) -> List[Triangle]:
    """Generates an axis-aligned box (solid cube)."""
    ox, oy, oz = origin
    x1, y1, z1 = ox, oy, oz
    x2, y2, z2 = ox + length, oy + width, oz + height

    v = [
        (x1, y1, z1), (x2, y1, z1), (x2, y2, z1), (x1, y2, z1), # Bottom 0,1,2,3
        (x1, y1, z2), (x2, y1, z2), (x2, y2, z2), (x1, y2, z2)  # Top    4,5,6,7
    ]

    faces = [
        # Bottom (-Z)
        (v[0], v[2], v[1]), (v[0], v[3], v[2]),
        # Top (+Z)
        (v[4], v[5], v[6]), (v[4], v[6], v[7]),
        # Front (-Y)
        (v[0], v[1], v[5]), (v[0], v[5], v[4]),
        # Back (+Y)
        (v[2], v[3], v[7]), (v[2], v[7], v[6]),
        # Left (-X)
        (v[3], v[0], v[4]), (v[3], v[4], v[7]),
        # Right (+X)
        (v[1], v[2], v[6]), (v[1], v[6], v[5]),
    ]
    return faces

def generate_cylinder(radius: float, height: float, segments: int = 36, origin: Point = (0.0, 0.0, 0.0)) -> List[Triangle]:
    """Generates a solid cylinder along the Z-axis."""
    ox, oy, oz = origin
    triangles: List[Triangle] = []
    
    top_center = (ox, oy, oz + height)
    bot_center = (ox, oy, oz)
    
    for i in range(segments):
        theta1 = (2 * math.pi * i) / segments
        theta2 = (2 * math.pi * (i + 1)) / segments
        
        x1 = ox + radius * math.cos(theta1)
        y1 = oy + radius * math.sin(theta1)
        x2 = ox + radius * math.cos(theta2)
        y2 = oy + radius * math.sin(theta2)
        
        b1 = (x1, y1, oz)
        b2 = (x2, y2, oz)
        t1 = (x1, y1, oz + height)
        t2 = (x2, y2, oz + height)
        
        # Bottom fan
        triangles.append((bot_center, b2, b1))
        # Top fan
        triangles.append((top_center, t1, t2))
        # Side quad (2 triangles)
        triangles.append((b1, b2, t2))
        triangles.append((b1, t2, t1))
        
    return triangles

def generate_spur_gear(teeth: int = 16, radius: float = 25.0, tooth_height: float = 4.0, thickness: float = 6.0, bore_radius: float = 2.5) -> List[Triangle]:
    """Generates a spur gear with an axial bore hole."""
    triangles: List[Triangle] = []
    points_top: List[Point] = []
    points_bot: List[Point] = []
    
    # Generate 2D profile with teeth
    num_pts = teeth * 4
    for i in range(num_pts):
        angle = (2 * math.pi * i) / num_pts
        phase = i % 4
        # Root circle vs Tip circle
        r = radius + tooth_height if (phase == 1 or phase == 2) else radius
        x = r * math.cos(angle)
        y = r * math.sin(angle)
        points_bot.append((x, y, 0.0))
        points_top.append((x, y, thickness))

    # Outer wall faces
    for i in range(num_pts):
        next_i = (i + 1) % num_pts
        b1, b2 = points_bot[i], points_bot[next_i]
        t1, t2 = points_top[i], points_top[next_i]
        triangles.append((b1, b2, t2))
        triangles.append((b1, t2, t1))

    # Top & Bottom faces with bore hole
    bore_pts_top: List[Point] = []
    bore_pts_bot: List[Point] = []
    for i in range(num_pts):
        angle = (2 * math.pi * i) / num_pts
        bx = bore_radius * math.cos(angle)
        by = bore_radius * math.sin(angle)
        bore_pts_bot.append((bx, by, 0.0))
        bore_pts_top.append((bx, by, thickness))

    # Annular disc triangulation
    for i in range(num_pts):
        next_i = (i + 1) % num_pts
        # Bottom cap
        triangles.append((points_bot[i], points_bot[next_i], bore_pts_bot[i]))
        triangles.append((points_bot[next_i], bore_pts_bot[next_i], bore_pts_bot[i]))
        # Top cap
        triangles.append((points_top[i], bore_pts_top[i], points_top[next_i]))
        triangles.append((points_top[next_i], bore_pts_top[i], bore_pts_top[next_i]))
        # Inner bore wall
        triangles.append((bore_pts_bot[i], bore_pts_top[i], bore_pts_top[next_i]))
        triangles.append((bore_pts_bot[i], bore_pts_top[next_i], bore_pts_bot[next_i]))

    return triangles

def main():
    parser = argparse.ArgumentParser(description="Tinkercad 3D STL Generator")
    parser.add_argument("--type", choices=["box", "cylinder", "gear"], default="box", help="Type of shape to generate")
    parser.add_argument("--output", default="model.stl", help="Output .stl file path")
    parser.add_argument("--length", type=float, default=50.0, help="Length / X dimension in mm")
    parser.add_argument("--width", type=float, default=30.0, help="Width / Y dimension in mm")
    parser.add_argument("--height", type=float, default=20.0, help="Height / Z dimension in mm")
    parser.add_argument("--radius", type=float, default=20.0, help="Radius in mm (for cylinder/gear)")
    parser.add_argument("--teeth", type=int, default=16, help="Number of teeth (for gear)")
    parser.add_argument("--bore", type=float, default=2.5, help="Center bore radius in mm (for gear)")

    args = parser.parse_args()

    out_path = Path(args.output).resolve()
    if out_path.suffix.lower() != ".stl":
        raise ValueError("Refusing to write non-STL file: --output must end with .stl")
    if ".." in Path(args.output).parts:
        raise ValueError("Refusing path traversal in --output")

    for dim_name, dim_val in [("length", args.length), ("width", args.width), ("height", args.height), ("radius", args.radius), ("bore", args.bore)]:
        if not (0.1 <= dim_val <= 2000.0):
            raise ValueError(f"--{dim_name} must be between 0.1 mm and 2000.0 mm")
    if not (3 <= args.teeth <= 500):
        raise ValueError("--teeth must be between 3 and 500")

    if args.type == "box":
        tris = generate_box(args.length, args.width, args.height)
    elif args.type == "cylinder":
        tris = generate_cylinder(args.radius, args.height)
    elif args.type == "gear":
        tris = generate_spur_gear(teeth=args.teeth, radius=args.radius, thickness=args.height, bore_radius=args.bore)
    else:
        tris = []

    write_binary_stl(str(out_path), tris)

if __name__ == "__main__":
    main()
