"""Original Mitsa inventory composition. Execute through Blender Lab MCP.

Dimensions and grouping are illustrative, not manufacturer specifications.
The existing Blender scenes are preserved. Only the Mitsa scene is exported.
"""
import bpy
import math
import json
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(r"C:\Users\Luke\OneDrive\Documents\ChatGPT\Fireworks_Inventory")
SOURCE = ROOT / "assets/source/mitsa-inventory"
WEB = ROOT / "public/mitsa"
SOURCE.mkdir(parents=True, exist_ok=True)
WEB.mkdir(parents=True, exist_ok=True)

scene = bpy.data.scenes.new("Mitsa — Inventory Organization")
collection = bpy.data.collections.new("Mitsa Inventory")
scene.collection.children.link(collection)

def material(name, color, roughness=0.65):
    mat = bpy.data.materials.new("Mitsa " + name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Specular IOR Level"].default_value = 0.28
    mat.diffuse_color = (*color, 1)
    return mat

paper = material("Paper", (0.84, 0.835, 0.82))
porcelain = material("Tray", (0.93, 0.935, 0.945), 0.48)
white = material("Sleeve", (0.97, 0.968, 0.958))
ink = material("Graphite", (0.055, 0.062, 0.074), 0.72)
band = material("Paper band", (0.58, 0.60, 0.63), 0.75)

root = bpy.data.objects.new("MitsaInventory", None)
collection.objects.link(root)
root["purpose"] = "Original illustrative inventory organization, authored through Blender Lab MCP"
groups = []

def group(name, position, intro_offset, intro_rotation):
    obj = bpy.data.objects.new(name, None)
    collection.objects.link(obj)
    obj.parent = root
    obj.location = position
    obj["assembly_role"] = name
    obj["intro_offset"] = intro_offset
    obj["intro_rotation"] = intro_rotation
    groups.append(obj)
    return obj

def solid(name, parts, mat, parent, bevel=0.025):
    vertices, faces = [], []
    corners = [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]
    box_faces = [(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)]
    for part in parts:
        x, y, z, w, d, h = part[:6]
        rot = part[6] if len(part) > 6 else 0
        matrix = Matrix.Rotation(rot, 4, "X")
        start = len(vertices)
        for vx, vy, vz in corners:
            v = matrix @ Vector((vx*w/2, vy*d/2, vz*h/2))
            vertices.append((v.x+x, v.y+y, v.z+z))
        faces.extend(tuple(start+i for i in f) for f in box_faces)
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = parent
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("Soft manufactured edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        modifier.affect = "EDGES"
        modifier.harden_normals = True
        normal = obj.modifiers.new("Weighted surface normals", "WEIGHTED_NORMAL")
        normal.keep_sharp = True
    return obj

carton = group("Carton", (0,0,0), (0,0,-0.1), (0,0,-0.07))
solid("Carton folded shell", [
    (0,0,0.07,4.8,3.2,0.14),
    (0,-1.57,0.39,4.8,0.075,0.65),
    (0,1.57,0.46,4.8,0.075,0.8),
    (-2.365,0,0.46,0.075,3.12,0.8),
    (2.365,0,0.46,0.075,3.12,0.8),
    (0,1.83,0.91,4.7,0.58,0.035,math.radians(18)),
    (-2.34,0,0.16,0.06,3.04,0.035),
    (2.34,0,0.16,0.06,3.04,0.035),
], paper, carton, 0.018)
solid("Carton folded seams", [(-2.28,0,0.18,0.018,3.0,0.018),(2.28,0,0.18,0.018,3.0,0.018)], band, carton, 0.004)
solid("Inventory label", [(-1.53,-1.612,0.4,0.7,0.008,0.22)], white, carton, 0.008)
solid("Inventory label marks", [(-1.68,-1.62,0.45,0.24,0.008,0.012),(-1.59,-1.62,0.4,0.42,0.008,0.012),(-1.62,-1.62,0.35,0.36,0.008,0.012)], ink, carton, 0.002)

def tray(name, position, offset, rotation):
    parent = group(name, position, offset, rotation)
    solid(name + " formed tray", [(0,0,0,2.14,2.82,0.08),(-1.045,0,0.14,0.055,2.82,0.3),(1.045,0,0.14,0.055,2.82,0.3),(0,-1.385,0.14,2.08,0.055,0.3),(0,1.385,0.14,2.08,0.055,0.3),(0,0,0.1,2.08,0.035,0.24)], porcelain, parent, 0.016)
    return parent

tray_a = tray("Tray_A", (-1.12,0,0.2), (-0.6,0.12,0.82), (0.06,0,-0.06))
tray_b = tray("Tray_B", (1.12,0,0.2), (0.7,0.1,1.42), (-0.04,0,0.07))

def pack(name, position, offset, rotation, width=1.8, depth=1.05, height=0.5):
    parent = group(name, position, offset, rotation)
    solid(name + " folded sleeve", [(0,0,height/2,width,depth,height),(0,0,height+0.008,width-0.055,depth-0.055,0.025)], white, parent, 0.035)
    solid(name + " paper band", [(0,0,height+0.024,width*0.19,depth-0.03,0.012),(0,-depth/2-0.005,height/2,width*0.19,0.014,height-0.02)], band, parent, 0.005)
    solid(name + " printed detail", [(-width*0.32,-depth/2-0.015,height*0.65,width*0.15,0.006,0.012),(-width*0.30,-depth/2-0.015,height*0.5,width*0.19,0.006,0.012)], ink, parent, 0.001)
    return parent

pack("Pack_A", (-1.12,-0.67,0.26), (-0.6,-0.25,1.65), (0.12,-0.07,-0.09))
pack("Pack_B", (-1.12,0.67,0.26), (-0.3,0.35,2.15), (-0.05,0.06,0.08))
pack("Pack_C", (1.12,-0.67,0.26), (0.65,-0.25,2.6), (0.08,0.04,0.1))
for i, x in enumerate((0.5,1.12,1.74)):
    parent = group("Unit_" + str(i+1), (x,0.68,0.26), (0.65+(i-1)*0.18,0.2+(i-1)*0.08,3.0+(i-1)*0.12), (0.05,-0.04,(i-1)*0.06))
    solid(parent.name + " sleeve", [(0,0,0.23,0.48,1.05,0.46),(0,0,0.468,0.44,1.01,0.025)], white, parent, 0.026)
    solid(parent.name + " seam", [(0,-0.532,0.23,0.025,0.012,0.43)], band, parent, 0.004)

# A separate presentation environment. It is not exported to the runtime model.
stage = bpy.data.collections.new("Mitsa Render Stage")
scene.collection.children.link(stage)
floor_mesh = bpy.data.meshes.new("Mitsa shadow catcher")
floor_mesh.from_pydata([(-30,-30,-0.035),(30,-30,-0.035),(30,30,-0.035),(-30,30,-0.035)], [], [(0,1,2,3)])
floor = bpy.data.objects.new("Mitsa shadow catcher", floor_mesh)
stage.objects.link(floor)
floor.is_shadow_catcher = True
floor.data.materials.append(white)
camera = bpy.data.objects.new("Mitsa Camera", bpy.data.cameras.new("Mitsa Camera"))
stage.objects.link(camera)
scene.camera = camera
camera.data.type = "PERSP"
camera.data.lens = 52

def area(name, location, energy, size):
    light = bpy.data.objects.new(name, bpy.data.lights.new(name,"AREA"))
    stage.objects.link(light)
    light.location = location
    light.rotation_euler = (Vector((0,0,0.5)) - light.location).to_track_quat("-Z","Y").to_euler()
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size

area("Mitsa key softbox", (-4,-6,9), 850, 7)
area("Mitsa fill softbox", (6,2,7), 600, 6)
scene.world = bpy.data.worlds.new("Mitsa neutral environment")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (1,1,1,1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.45
scene.render.engine = "CYCLES"
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x = 1600
scene.render.resolution_y = 1100
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "AgX"

def pose(intro):
    for obj in groups:
        if "assembled_position" not in obj:
            obj["assembled_position"] = list(obj.location)
        obj.location = Vector(obj["assembled_position"]) + Vector(obj["intro_offset"]) * intro
        obj.rotation_euler = tuple(v*intro for v in obj["intro_rotation"])
    camera.location = (7.5, -10.5, 8.2 + intro*1.2)
    target = Vector((0,0,0.5+intro*1.1))
    camera.rotation_euler = (target-camera.location).to_track_quat("-Z","Y").to_euler()
    scene.view_layers.update()

pose(0)
# Select only the authored inventory geometry for the GLB.
previous_scene = bpy.context.window.scene
bpy.context.window.scene = scene
for obj in scene.objects:
    obj.select_set(obj.name in collection.objects)
bpy.context.view_layer.objects.active = next(obj for obj in collection.objects if obj.type == "MESH")
bpy.ops.export_scene.gltf(filepath=str(WEB / "mitsa-inventory-assembly.glb"), export_format="GLB", use_selection=True, use_active_scene=True, export_apply=True, export_extras=True, export_cameras=False, export_lights=False)
bpy.data.libraries.write(str(SOURCE / "mitsa-inventory.blend"), {scene}, fake_user=True)
bpy.context.window.scene = previous_scene
manifest = {"authoring": "Blender Lab MCP execute_blender_code", "blender": bpy.app.version_string, "model": "mitsa-inventory-assembly.glb", "purpose": "Illustrative inventory organization, not manufacturer packaging", "groups": [{"name":obj.name,"position":list(obj.location),"intro_offset":list(obj["intro_offset"]),"intro_rotation":list(obj["intro_rotation"])} for obj in groups], "renders": [], "glb_bytes": (WEB / "mitsa-inventory-assembly.glb").stat().st_size}
(SOURCE / "manifest.json").write_text(json.dumps(manifest, indent=2))
result = {"scene": scene.name, "groups":len(groups), "objects":len(collection.objects), "glb_bytes":manifest["glb_bytes"], "source_saved":True}
