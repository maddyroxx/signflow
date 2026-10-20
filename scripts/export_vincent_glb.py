"""
Blender Python script to export Vincent from vincent.blend to browser-compatible glTF/GLB format for SignFlow.

Usage:
    blender -b vincent.blend -P scripts/export_vincent_glb.py

Requirements:
    - Blender 2.83+ or 3.x / 4.x
    - The vincent.blend file from Blender Studio (https://studio.blender.org/characters/vincent/v1/)
"""

import sys
import os

try:
    import bpy
except ImportError:
    print("ERROR: This script must be run inside Blender: blender -b vincent.blend -P scripts/export_vincent_glb.py")
    sys.exit(1)

def export_vincent():
    output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "models"))
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "vincent.glb")

    print(f"[SignFlow] Starting Vincent export from {bpy.data.filepath} to {output_path}...")

    # Deselect all objects first
    bpy.ops.object.select_all(action='DESELECT')

    # Find the main armature
    armatures = [ob for ob in bpy.data.objects if ob.type == 'ARMATURE']
    if not armatures:
        print("ERROR: No armature found in the blend file!")
        sys.exit(1)

    main_armature = armatures[0]
    print(f"[SignFlow] Found armature: {main_armature.name}")

    # Ensure armature is visible and in Rest or Pose mode with no animation override
    main_armature.hide_viewport = False
    main_armature.hide_set(False)

    # Gather mesh objects parented or rigged to the character
    mesh_objects = [ob for ob in bpy.data.objects if ob.type == 'MESH' and not ob.name.startswith(('WGT', 'gizmo', 'lattice'))]
    print(f"[SignFlow] Found {len(mesh_objects)} character meshes to export:")
    for mesh in mesh_objects:
        print(f"  - {mesh.name}")
        mesh.hide_viewport = False
        mesh.hide_set(False)
        mesh.select_set(True)

    main_armature.select_set(True)
    bpy.context.view_layer.objects.active = main_armature

    # Export glTF 2.0 binary (.glb)
    print(f"[SignFlow] Exporting to {output_path} with glTF 2.0...")
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_skins=True,
        export_armature_object=True,
        export_def_bones=False, # Keep FK/deform bones accessible
        export_all_influences=False,
        export_materials='EXPORT',
        export_image_format='AUTO',
        export_colors=True,
        export_animations=False, # SignFlow generates procedural ISL signing at runtime
    )

    if os.path.exists(output_path):
        size_mb = os.path.getsize(output_path) / (1024 * 1024)
        print(f"[SignFlow] SUCCESS: Vincent exported successfully to {output_path} ({size_mb:.2f} MB)")
    else:
        print("[SignFlow] ERROR: glTF exporter finished but file was not created.")
        sys.exit(1)

if __name__ == "__main__":
    export_vincent()
