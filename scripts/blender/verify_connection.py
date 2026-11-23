"""Executed inside Blender via execute_blender_code; creates verification artifacts only."""
import bpy
import bmesh
from pathlib import Path
from mathutils import Vector

output = Path(r"C:\Users\Luke\OneDrive\Documents\ChatGPT\Fireworks_Inventory\.tools\blender-preflight")
output.mkdir(parents=True, exist_ok=True)
scene = bpy.data.scenes.new("Mitsa MCP Verification")
mesh = bpy.data.meshes.new("Mitsa MCP Test Mesh")
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1)
bm.to_mesh(mesh)
bm.free()
obj = bpy.data.objects.new("Mitsa MCP Test Object", mesh)
scene.collection.objects.link(obj)
bevel = obj.modifiers.new("Verification bevel", "BEVEL")
bevel.width = 0.08
bevel.segments = 3
material = bpy.data.materials.new("Mitsa MCP Test Material")
material.diffuse_color = (0.7, 0.72, 0.75, 1)
obj.data.materials.append(material)
camera = bpy.data.objects.new("Mitsa MCP Test Camera", bpy.data.cameras.new("Mitsa MCP Test Camera"))
scene.collection.objects.link(camera)
camera.location = (3, -4, 3)
camera.rotation_euler = (Vector((0, 0, 0)) - camera.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = camera
light = bpy.data.objects.new("Mitsa MCP Test Light", bpy.data.lights.new("Mitsa MCP Test Light", "AREA"))
scene.collection.objects.link(light)
light.location = (2, -3, 4)
light.data.energy = 400
light.data.size = 4
scene.world = bpy.data.worlds.new("Mitsa MCP Test World")
scene.world.color = (0.7, 0.7, 0.7)
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = scene.render.resolution_y = 128
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(output / "render.png")
bpy.ops.render.render(scene=scene.name, write_still=True)
with bpy.context.temp_override(scene=scene):
    bpy.ops.export_scene.gltf(filepath=str(output / "verification.glb"), export_format="GLB", export_apply=True)
result = {"inspection": "passed", "modeling": len(mesh.vertices) == 8, "render_bytes": (output / "render.png").stat().st_size, "export_bytes": (output / "verification.glb").stat().st_size, "verification_only": True}
