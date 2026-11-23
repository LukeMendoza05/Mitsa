"""Render the authored inventory scene through Blender Lab MCP."""
import bpy
import math
from mathutils import Vector
from pathlib import Path

ROOT = Path(r"C:\Users\Luke\OneDrive\Documents\ChatGPT\Fireworks_Inventory")
scene = bpy.data.scenes["Mitsa — Inventory Organization"]
groups = [obj for obj in scene.objects if "assembly_role" in obj]
for intro, name in [(1, "inventory-intro"), (0, "inventory-assembled")]:
    for obj in groups:
        obj.location = Vector(obj["assembled_position"]) + Vector(obj["intro_offset"])*intro
        obj.rotation_euler = tuple(v*intro for v in obj["intro_rotation"])
    camera = scene.camera
    camera.location = (7.5,-10.5,8.2+intro*1.2)
    target = Vector((0,0,0.5+intro*1.1))
    camera.rotation_euler = (target-camera.location).to_track_quat("-Z","Y").to_euler()
    scene.render.filepath = str(ROOT / "assets/source/mitsa-inventory" / (name+".png"))
    bpy.ops.render.render(scene=scene.name, write_still=True)
result = {"rendered":["inventory-intro.png","inventory-assembled.png"],"scene":scene.name}
