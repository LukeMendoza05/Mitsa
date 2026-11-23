"""Refine the existing original Mitsa asset through Blender MCP; no new geometry."""
import bpy
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(r"C:\Users\Luke\OneDrive\Documents\ChatGPT\Fireworks_Inventory")
SOURCE = ROOT / "assets/source/mitsa-inventory"
scene = bpy.data.scenes["Mitsa — Inventory Organization"]
collection = next(c for c in scene.collection.children if c.name.startswith("Mitsa Inventory"))
actors = [o for o in collection.objects if "assembly_role" in o]
assert len(actors) == 9

settings = {
    "Mitsa Paper": ((0.69, 0.70, 0.71), 0.78),
    "Mitsa Tray": ((0.88, 0.90, 0.92), 0.58),
    "Mitsa Sleeve": ((0.95, 0.95, 0.94), 0.64),
    "Mitsa Paper band": ((0.42, 0.45, 0.48), 0.82),
    "Mitsa Graphite": ((0.045, 0.050, 0.060), 0.76),
}
for name, (color, roughness) in settings.items():
    material = bpy.data.materials[name]
    shader = material.node_tree.nodes["Principled BSDF"]
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = 0
    shader.inputs["Specular IOR Level"].default_value = 0.22
    material.diffuse_color = (*color, 1)

scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.32
for obj in scene.objects:
    if obj.name.startswith("Mitsa key softbox"):
        obj.data.energy = 700
        obj.data.size = 7
    elif obj.name.startswith("Mitsa fill softbox"):
        obj.data.energy = 400
        obj.data.size = 7
for obj in actors:
    obj.location = Vector(obj["assembled_position"])
    obj.rotation_euler = (0, 0, 0)
scene.view_layers.update()

active = next(o for o in collection.objects if o.type == "MESH")
selected = list(collection.objects)
with bpy.context.temp_override(scene=scene, view_layer=scene.view_layers[0], active_object=active, object=active, selected_objects=selected, selected_editable_objects=selected):
    for obj in scene.objects:
        obj.select_set(obj.name in collection.objects)
    bpy.context.view_layer.objects.active = active
    bpy.ops.export_scene.gltf(
        filepath=str(ROOT / "public/mitsa/mitsa-inventory-assembly.glb"),
        export_format="GLB", use_selection=True, use_active_scene=True,
        export_apply=True, export_extras=True, export_cameras=False, export_lights=False,
    )

# Keep the original source separately in the polish evidence; preserve this scene's identities.
bpy.data.libraries.write(str(SOURCE / "mitsa-inventory.blend"), {scene}, fake_user=True)
manifest = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8-sig"))
manifest["refinement"] = "Existing geometry preserved; matte materials and softer studio lighting clarified. Blender MCP."
manifest["glb_bytes"] = (ROOT / "public/mitsa/mitsa-inventory-assembly.glb").stat().st_size
(SOURCE / "manifest.json").write_text(json.dumps(manifest, indent=2))
result = {"scene":scene.name, "actor_groups":len(actors), "mesh_count":sum(o.type=="MESH" for o in collection.objects), "materials":settings, "glb_bytes":manifest["glb_bytes"], "geometry_changed":False}
