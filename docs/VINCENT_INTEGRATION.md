# Vincent Character Integration & Animation Retargeting Guide

## 1. Overview
SignFlow integrates the official **Vincent** character asset from Blender Studio ([studio.blender.org/characters/vincent/v1/](https://studio.blender.org/characters/vincent/v1/)), licensed under **CC BY 4.0** (© Blender Foundation).

This document outlines the architectural differences between standard Mixamo rigs and Vincent's **BlenRig** system, the exact bone mapping table used by SignFlow's procedural Indian Sign Language (ISL) animation pipeline, camera framing adjustments, and the Blender export procedure.

---

## 2. Skeleton & Bone Hierarchy Comparison

Mixamo armatures use the `mixamorig:` prefix with a standard 3-joint-per-finger scheme. Vincent uses Blender Studio's custom **BlenRig 5** system with Forward Kinematics (FK) and Deformation (`_def`) hierarchies.

### Bone Mapping Table:

| Body Part | SignFlow / Mixamo Target | Vincent (BlenRig / glTF) Candidates |
| :--- | :--- | :--- |
| **Neck** | `mixamorigNeck` | `neck_1_def`, `neck_1_fk`, `neck_fk_ctrl`, `neck_fk`, `neck`, `Neck` |
| **Head** | `mixamorigHead` | `head_def_1`, `head_fk`, `head_ik_ctrl`, `head`, `Head` |
| **Left Shoulder** | `mixamorigLeftShoulder` | `shoulder_L`, `shoulder_def_L`, `clavicle_L`, `LeftShoulder` |
| **Right Shoulder** | `mixamorigRightShoulder`| `shoulder_R`, `shoulder_def_R`, `clavicle_R`, `RightShoulder` |
| **Left Arm** | `mixamorigLeftArm` | `arm_fk_L`, `arm_def_L`, `arm_L`, `UpperArm_L`, `LeftArm` |
| **Right Arm** | `mixamorigRightArm` | `arm_fk_R`, `arm_def_R`, `arm_R`, `UpperArm_R`, `RightArm` |
| **Left Forearm** | `mixamorigLeftForeArm` | `forearm_fk_L`, `forearm_def_L`, `forearm_L`, `LeftForeArm` |
| **Right Forearm** | `mixamorigRightForeArm`| `forearm_fk_R`, `forearm_def_R`, `forearm_R`, `RightForeArm` |
| **Left Hand / Wrist**| `mixamorigLeftHand` | `hand_fk_L`, `hand_def_L`, `hand_L`, `LeftHand` |
| **Right Hand / Wrist**| `mixamorigRightHand` | `hand_fk_R`, `hand_def_R`, `hand_R`, `RightHand` |

### Hand & Articulated Finger Mapping:

*Note on BlenRig phalanx indices:*
In BlenRig, `fing_*_1` corresponds to the metacarpal palm bone, while `fing_*_2`, `fing_*_3`, and `fing_*_4` correspond to the proximal, intermediate, and distal phalanges. SignFlow maps Mixamo joints 1, 2, and 3 to BlenRig's articulating phalanges:

#### Left Hand Fingers:
- **Thumb:**
  - `mixamorigLeftHandThumb1` &rarr; `fing_thumb_1_L`, `fing_thumb_1_def_L`, `LeftHandThumb1`
  - `mixamorigLeftHandThumb2` &rarr; `fing_thumb_2_L`, `fing_thumb_2_def_L`, `LeftHandThumb2`
  - `mixamorigLeftHandThumb3` &rarr; `fing_thumb_3_L`, `fing_thumb_3_def_L`, `LeftHandThumb3`
- **Index Finger:**
  - `mixamorigLeftHandIndex1` &rarr; `fing_ind_2_L`, `fing_ind_2_def_L`, `fing_ind_1_L`, `LeftHandIndex1`
  - `mixamorigLeftHandIndex2` &rarr; `fing_ind_3_L`, `fing_ind_3_def_L`, `LeftHandIndex2`
  - `mixamorigLeftHandIndex3` &rarr; `fing_ind_4_L`, `fing_ind_4_def_L`, `LeftHandIndex3`
- **Middle Finger:**
  - `mixamorigLeftHandMiddle1` &rarr; `fing_mid_2_L`, `fing_mid_2_def_L`, `fing_mid_1_L`, `LeftHandMiddle1`
  - `mixamorigLeftHandMiddle2` &rarr; `fing_mid_3_L`, `fing_mid_3_def_L`, `LeftHandMiddle2`
  - `mixamorigLeftHandMiddle3` &rarr; `fing_mid_4_L`, `fing_mid_4_def_L`, `LeftHandMiddle3`
- **Ring Finger:**
  - `mixamorigLeftHandRing1` &rarr; `fing_ring_2_L`, `fing_ring_2_def_L`, `fing_ring_1_L`, `LeftHandRing1`
  - `mixamorigLeftHandRing2` &rarr; `fing_ring_3_L`, `fing_ring_3_def_L`, `LeftHandRing2`
  - `mixamorigLeftHandRing3` &rarr; `fing_ring_4_L`, `fing_ring_4_def_L`, `LeftHandRing3`
- **Pinky / Little Finger:**
  - `mixamorigLeftHandPinky1` &rarr; `fing_lit_2_L`, `fing_lit_2_def_L`, `fing_lit_1_L`, `LeftHandPinky1`
  - `mixamorigLeftHandPinky2` &rarr; `fing_lit_3_L`, `fing_lit_3_def_L`, `LeftHandPinky2`
  - `mixamorigLeftHandPinky3` &rarr; `fing_lit_4_L`, `fing_lit_4_def_L`, `LeftHandPinky3`

*(Symmetrical mappings are applied for the Right Hand with the `_R` / `RightHand` suffix).*

---

## 3. How to Export `vincent.blend` to `vincent.glb`

Because WebGL in the browser cannot read proprietary binary `.blend` files with internal C-struct memory layouts, Vincent must be exported to the open glTF 2.0 binary standard (`.glb`).

### Automated CLI Export:
If Blender is installed on your workstation, run:
```bash
blender -b vincent.blend -P scripts/export_vincent_glb.py
```
This automatically outputs `public/models/vincent.glb` with all correct settings.

### Manual Blender GUI Export:
1. Open `vincent.blend` in Blender 2.83, 3.x, or 4.x.
2. In the Outliner, select the character meshes (Vincent body, shirt, pants, hair, eyes) and the character Armature.
3. Go to **File > Export > glTF 2.0 (.glb/.gltf)**.
4. Set the following export options in the right-hand panel:
   - **Format:** `glTF Binary (.glb)`
   - **Include:** Check `Selected Objects` (or leave default if character is active)
   - **Transform:** `+Y Up` (enabled by default)
   - **Data > Armature:** Check `Export Deformation Bones Only` (or leave unchecked to include FK controls)
   - **Data > Skinning:** Check `Skinning` (enabled by default)
   - **Animation:** Uncheck `Animations` (SignFlow generates all ISL signs dynamically in code)
5. Save the exported file to:
   `public/models/vincent.glb`

---

## 4. Browser-Side Fallback Strategy

SignFlow enforces zero-downtime reliability:
- When a user selects **👦 Vincent (Blender Studio)** in the UI, `AvatarPlayer.tsx` requests `/models/vincent.glb`.
- If `/models/vincent.glb` is not present or pending the export step, SignFlow **automatically falls back** to the high-contrast Turquoise Robot avatar without crashing or interrupting playback.
- A non-intrusive status indicator informs the user of Vincent's export status, while preserving full access to:
  - 140+ ISL signs
  - A–Z fingerspelling
  - Real-time Web Speech recognition
  - Hybrid Gemini / Offline translation pipeline
