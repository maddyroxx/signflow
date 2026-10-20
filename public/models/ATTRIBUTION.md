# Avatar Rig Attribution & Licensing

### 1. Vincent Character Rig (Blender Studio)
- **Model Name:** Vincent (Cosmos Laundromat / Blender Open Movie Project)
- **Source:** [Blender Studio Vincent Asset](https://studio.blender.org/characters/vincent/v1/)
- **Authors:** Andy Goralczyk, Hjalti Hjalmarsson, and the Blender Studio team
- **Copyright:** © Blender Foundation | studio.blender.org
- **License:** [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
- **Usage in SignFlow:**
  - Exported to WebGL-compatible binary glTF 2.0 format (`public/models/vincent.glb`).
  - Skeleton mapped to the SignFlow Indian Sign Language animation engine (BlenRig FK & Deform bones `arm_fk_L/R`, `forearm_fk_L/R`, `hand_fk_L/R`, `fing_thumb_1..3`, `fing_ind_2..4`, `fing_mid_2..4`, `fing_ring_2..4`, `fing_lit_2..4`).
  - Procedural ISL signing animations applied at runtime in Three.js without modifying the source asset geometry.

---

### 2. Y Bot Rig (Adobe Mixamo)
- **Model Name:** Y Bot (`ybot.glb`)
- **Source:** [Adobe Mixamo](https://www.mixamo.com/)
- **License:** Royalty-free for commercial and non-commercial interactive software and applications.
- **Usage in SignFlow:**
  - **Turquoise Robot:** Uses runtime dynamic vertex shaders and mathematical gradient interpolation matching the SignFlow brand palette (`#8DC1C2`).
  - **Human Variant:** Procedural face layer (`components/avatar/humanLayer.ts`) parented to the head bone at runtime.
  - **Classic Variant:** Default neutral titanium finish.

---

### 3. Historical Notes
- `brunette.glb` (Ready Player Me, CC BY-NC 4.0) was previously deprecated in favor of open-source and customizable rigs.
