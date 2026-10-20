import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('Vincent Asset: vincent.blend integrity', () => {
  const blendPath = path.resolve(process.cwd(), 'vincent.blend')
  assert.ok(fs.existsSync(blendPath), 'vincent.blend must exist in workspace')
  const stats = fs.statSync(blendPath)
  assert.ok(stats.size > 15 * 1024 * 1024, `vincent.blend should be > 15MB (got ${stats.size} bytes)`)
})

test('Vincent Export Script: scripts/export_vincent_glb.py exists and valid', () => {
  const scriptPath = path.resolve(process.cwd(), 'scripts/export_vincent_glb.py')
  assert.ok(fs.existsSync(scriptPath), 'export_vincent_glb.py must exist')
  const content = fs.readFileSync(scriptPath, 'utf8')
  assert.ok(content.includes('bpy.ops.export_scene.gltf'), 'Must invoke glTF 2.0 exporter')
  assert.ok(content.includes("export_format='GLB'"), 'Must export GLB format')
  assert.ok(content.includes('export_skins=True'), 'Must preserve skeletal skinning')
  assert.ok(content.includes('export_yup=True'), 'Must use Y-up coordinates for WebGL')
})

test('Vincent Attribution: public/models/ATTRIBUTION.md includes CC BY 4.0 license', () => {
  const attrPath = path.resolve(process.cwd(), 'public/models/ATTRIBUTION.md')
  assert.ok(fs.existsSync(attrPath), 'ATTRIBUTION.md must exist')
  const content = fs.readFileSync(attrPath, 'utf8')
  assert.ok(content.includes('Creative Commons Attribution 4.0 International'), 'Must cite CC BY 4.0')
  assert.ok(content.includes('Blender Studio'), 'Must cite Blender Studio')
  assert.ok(content.includes('studio.blender.org'), 'Must link to studio.blender.org')
})

test('Avatar Retargeting: BONE_ALIASES covers all signing joints', () => {
  const playerPath = path.resolve(process.cwd(), 'components/avatar/AvatarPlayer.tsx')
  const content = fs.readFileSync(playerPath, 'utf8')

  const requiredMixamoBones = [
    'mixamorigNeck',
    'mixamorigHead',
    'mixamorigLeftArm',
    'mixamorigRightArm',
    'mixamorigLeftForeArm',
    'mixamorigRightForeArm',
    'mixamorigLeftHand',
    'mixamorigRightHand',
    // Thumb
    'mixamorigLeftHandThumb1',
    'mixamorigLeftHandThumb2',
    'mixamorigLeftHandThumb3',
    'mixamorigRightHandThumb1',
    'mixamorigRightHandThumb2',
    'mixamorigRightHandThumb3',
    // Index
    'mixamorigLeftHandIndex1',
    'mixamorigLeftHandIndex2',
    'mixamorigLeftHandIndex3',
    'mixamorigRightHandIndex1',
    'mixamorigRightHandIndex2',
    'mixamorigRightHandIndex3',
    // Middle
    'mixamorigLeftHandMiddle1',
    'mixamorigLeftHandMiddle2',
    'mixamorigLeftHandMiddle3',
    'mixamorigRightHandMiddle1',
    'mixamorigRightHandMiddle2',
    'mixamorigRightHandMiddle3',
    // Ring
    'mixamorigLeftHandRing1',
    'mixamorigLeftHandRing2',
    'mixamorigLeftHandRing3',
    'mixamorigRightHandRing1',
    'mixamorigRightHandRing2',
    'mixamorigRightHandRing3',
    // Pinky
    'mixamorigLeftHandPinky1',
    'mixamorigLeftHandPinky2',
    'mixamorigLeftHandPinky3',
    'mixamorigRightHandPinky1',
    'mixamorigRightHandPinky2',
    'mixamorigRightHandPinky3',
  ]

  for (const bone of requiredMixamoBones) {
    assert.ok(content.includes(bone), `AvatarPlayer.tsx must define alias for ${bone}`)
  }

  // Verify BlenRig key names are present
  assert.ok(content.includes('fing_ind_2_L'), 'Index phalanx 1 maps to fing_ind_2_L')
  assert.ok(content.includes('fing_mid_2_L'), 'Middle phalanx 1 maps to fing_mid_2_L')
  assert.ok(content.includes('fing_ring_2_L'), 'Ring phalanx 1 maps to fing_ring_2_L')
  assert.ok(content.includes('fing_lit_2_L'), 'Pinky phalanx 1 maps to fing_lit_2_L')
  assert.ok(content.includes('fing_thumb_1_L'), 'Thumb phalanx 1 maps to fing_thumb_1_L')
  assert.ok(content.includes('arm_fk_L'), 'Left arm maps to arm_fk_L')
  assert.ok(content.includes('forearm_fk_L'), 'Left forearm maps to forearm_fk_L')
  assert.ok(content.includes('hand_fk_L'), 'Left hand maps to hand_fk_L')
})
