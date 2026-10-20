'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as words from './animations/words'
import * as alphabets from './animations/alphabets'
import { defaultPose } from './animations/defaultPose'
import { textToGloss } from './textToGloss'
import { createFaceLayer } from './humanLayer'
import { looksPreTranslated } from '@/lib/islVocabulary'

export type SignInstruction = [string, 'rotation', 'x' | 'y' | 'z', number, '+' | '-']

export type TokenMeta = {
  tokenIndex: number
  token: string
  isFingerspelling: boolean
  letter?: string
}

export type TaggedInstructionFrame = SignInstruction[] & {
  _meta?: TokenMeta
}

export type AvatarModelType = 'vincent' | 'turquoise' | 'human' | 'default'

export type ModelNotice = {
  type: 'info' | 'warning' | 'success'
  message: string
}

export type SignRuntime = {
  animations: TaggedInstructionFrame[]
  characters: string[]
  pending: boolean
  model?: AvatarModelType
  avatar?: THREE.Object3D
}

type BoneUserData = {
  restQuaternion?: THREE.Quaternion
  gestureRestQuaternion?: THREE.Quaternion
  restPosition?: THREE.Vector3
  restScale?: THREE.Vector3
  delta?: { x: number; y: number; z: number }
}

export type SignProgress = {
  currentSignIndex: number
  currentToken: string
  totalTokens: number
  tokens: string[]
  isFingerspelling: boolean
  letter?: string
}

export type AvatarPlayerProps = {
  phrase: string
  requestId: number
  model?: AvatarModelType
  appendToQueue?: boolean
  stopId?: number
  resetId?: number
  replayId?: number
  isPaused?: boolean
  speed?: number
  onStateChange: (state: 'loading' | 'ready' | 'signing' | 'paused' | 'error') => void
  onProgress?: (progress: SignProgress) => void
  onModelNotice?: (notice: ModelNotice | null) => void
}

const wordAnimations = words as unknown as Record<string, (runtime: SignRuntime) => void>
const alphabetAnimations = alphabets as unknown as Record<string, (runtime: SignRuntime) => void>

export function AvatarPlayer({
  phrase,
  requestId,
  model = 'turquoise',
  appendToQueue = false,
  stopId = 0,
  resetId = 0,
  replayId = 0,
  isPaused = false,
  speed = 1,
  onStateChange,
  onProgress,
  onModelNotice,
}: AvatarPlayerProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const runtimeRef = useRef<SignRuntime>({ animations: [], characters: [], pending: true })
  const readyRef = useRef(false)
  const pendingPhraseRef = useRef<{ phrase: string; requestId: number } | null>(null)
  const appendToQueueRef = useRef(appendToQueue)
  const speedRef = useRef(speed)
  const isPausedRef = useRef(isPaused)
  const onProgressRef = useRef(onProgress)
  const onStateChangeRef = useRef(onStateChange)
  const onModelNoticeRef = useRef(onModelNotice)
  const activeTokensRef = useRef<string[]>([])
  const lastReportedTokenIndexRef = useRef<number>(-1)

  useEffect(() => {
    appendToQueueRef.current = appendToQueue
  }, [appendToQueue])

  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  useEffect(() => {
    onModelNoticeRef.current = onModelNotice
  }, [onModelNotice])

  useEffect(() => {
    isPausedRef.current = isPaused
    if (readyRef.current && runtimeRef.current.animations.length > 0) {
      if (isPaused) {
        onStateChangeRef.current('paused')
      } else {
        onStateChangeRef.current('signing')
      }
    }
  }, [isPaused])

  useEffect(() => {
    onProgressRef.current = onProgress
  }, [onProgress])

  useEffect(() => {
    onStateChangeRef.current = onStateChange
  }, [onStateChange])

  // Process incoming phrase request
  useEffect(() => {
    if (!requestId) return
    const next = { phrase, requestId }
    if (!readyRef.current) {
      pendingPhraseRef.current = next
      onStateChangeRef.current('loading')
      return
    }
    lastReportedTokenIndexRef.current = -1
    enqueuePhrase(next.phrase, runtimeRef.current, appendToQueue, activeTokensRef)
    onStateChangeRef.current('signing')
  }, [phrase, requestId, appendToQueue])

  // Replay request
  useEffect(() => {
    if (!replayId || !readyRef.current) return
    if (activeTokensRef.current.length > 0) {
      lastReportedTokenIndexRef.current = -1
      enqueuePhrase(activeTokensRef.current.join(' '), runtimeRef.current, false, activeTokensRef)
      onStateChangeRef.current('signing')
    } else if (phrase) {
      lastReportedTokenIndexRef.current = -1
      enqueuePhrase(phrase, runtimeRef.current, false, activeTokensRef)
      onStateChangeRef.current('signing')
    }
  }, [replayId, phrase])

  // Stop request
  useEffect(() => {
    if (!stopId) return
    pendingPhraseRef.current = null
    runtimeRef.current.animations = []
    lastReportedTokenIndexRef.current = -1
    if (readyRef.current && runtimeRef.current.avatar) {
      resetAvatar(runtimeRef.current, model)
    }
    onStateChangeRef.current('ready')
    onProgressRef.current?.({
      currentSignIndex: -1,
      currentToken: '',
      totalTokens: activeTokensRef.current.length,
      tokens: activeTokensRef.current,
      isFingerspelling: false,
    })
  }, [stopId, model])

  // Reset request
  useEffect(() => {
    if (!resetId || !readyRef.current) return
    pendingPhraseRef.current = null
    runtimeRef.current.animations = []
    lastReportedTokenIndexRef.current = -1
    resetAvatar(runtimeRef.current, model)
    onStateChangeRef.current('ready')
    onProgressRef.current?.({
      currentSignIndex: -1,
      currentToken: '',
      totalTokens: 0,
      tokens: [],
      isFingerspelling: false,
    })
  }, [resetId, model])

  // Three.js Mount & Render Loop
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const runtime = runtimeRef.current
    runtime.animations = []
    runtime.characters = []
    runtime.pending = true
    runtime.avatar = undefined
    runtime.model = model
    readyRef.current = false
    lastReportedTokenIndexRef.current = -1

    pendingPhraseRef.current = requestId ? { phrase, requestId } : null
    onStateChangeRef.current('loading')

    const scene = new THREE.Scene()
    // Soft studio contrast backdrop so all titanium armor contours and seafoam gradients are clearly visible
    scene.background = new THREE.Color('#E6EDF5')

    // Centered perspective camera framing upper body and hands cleanly
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000)
    camera.position.set(0, 0.58, 2.85)

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    } catch (err) {
      console.error('[AvatarPlayer] WebGL initialization failed:', err)
      onStateChangeRef.current('error')
      return
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    mount.appendChild(renderer.domElement)

    // Balanced studio lighting tailored for clear ISL hand visibility without blowout
    const hemiLight = new THREE.HemisphereLight('#FFFFFF', '#CBD5E1', 1.3)
    scene.add(hemiLight)

    const keyLight = new THREE.DirectionalLight('#FFFFFF', 2.1)
    keyLight.position.set(2.5, 4.5, 3.5)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.width = 1024
    keyLight.shadow.mapSize.height = 1024
    keyLight.shadow.bias = -0.0001
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight('#E2E8F0', 1.0)
    fillLight.position.set(-2.5, 2.0, 2.5)
    scene.add(fillLight)

    // Dedicated seafoam rim light matching the reference swatch (#8DC1C2)
    const seafoamRim = new THREE.PointLight('#8DC1C2', 7.5, 12)
    seafoamRim.position.set(2.5, 2.0, 2.0)
    scene.add(seafoamRim)

    // Subtle purple studio rim accent
    const purpleRim = new THREE.PointLight('#6C4CE8', 5.0, 12)
    purpleRim.position.set(-2.5, 2.2, 1.8)
    scene.add(purpleRim)

    // Soft grounded shadow plane
    const shadowGeo = new THREE.PlaneGeometry(8, 8)
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.15 })
    const floor = new THREE.Mesh(shadowGeo, shadowMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.85
    floor.receiveShadow = true
    scene.add(floor)

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect()
      if (!width || !height) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(mount)
    resize()

    let disposed = false
    const loader = new GLTFLoader()
    const isVincent = model === 'vincent'
    const targetModelPath = isVincent ? '/models/vincent.glb' : '/models/ybot.glb'

    const loadAvatar = (url: string, isFallback = false) => {
      loader.load(
        url,
        (gltf) => {
          if (disposed) return
          const avatar = gltf.scene
          avatar.traverse((child) => {
            child.castShadow = true
            child.receiveShadow = true
            child.frustumCulled = false
          })
          runtime.avatar = avatar

          if (isVincent && !isFallback) {
            // Normalize scale and camera framing for Vincent
            const bbox = new THREE.Box3().setFromObject(avatar)
            const size = bbox.getSize(new THREE.Vector3())
            if (size.y > 0) {
              const targetHeight = 1.78
              const scale = targetHeight / size.y
              if (scale < 0.2 || scale > 5.0) {
                avatar.scale.setScalar(scale)
              }
            }
            const postBbox = new THREE.Box3().setFromObject(avatar)
            avatar.position.y = -postBbox.min.y - 0.85
            avatar.position.x = -postBbox.getCenter(new THREE.Vector3()).x
            avatar.position.z = 0
            scene.add(avatar)

            // Validate retargeted skeleton for Vincent
            const testArm = getAvatarBone(avatar, 'mixamorigLeftArm')
            const testHand = getAvatarBone(avatar, 'mixamorigLeftHand')
            const testFinger = getAvatarBone(avatar, 'mixamorigLeftHandIndex1')
            console.log('[AvatarPlayer] Vincent skeleton retargeting check:', {
              arm: !!testArm,
              hand: !!testHand,
              indexFinger: !!testFinger,
            })

            onModelNoticeRef.current?.({
              type: 'success',
              message: 'Vincent character (Blender Studio CC BY 4.0) active with retargeted hand and arm bones.',
            })
          } else {
            // Standard Y-Bot positioning
            avatar.position.y = -0.85
            scene.add(avatar)

            if (isFallback) {
              applyTurquoiseRobotColors(avatar)
              onModelNoticeRef.current?.({
                type: 'info',
                message: 'Vincent GLB pending Blender export (scripts/export_vincent_glb.py). Operating with Turquoise Bot fallback.',
              })
            } else if (model === 'turquoise') {
              applyTurquoiseRobotColors(avatar)
              onModelNoticeRef.current?.(null)
            } else if (model === 'human') {
              applyWarmArmorColors(avatar)
              const headBone = getAvatarBone(avatar, 'mixamorig:Head')
              if (headBone) {
                const faceLayer = createFaceLayer()
                faceLayer.scale.set(13.5, 13.5, 13.5)
                faceLayer.position.set(0, 2, 1)
                headBone.add(faceLayer)
              }
              onModelNoticeRef.current?.(null)
            } else {
              onModelNoticeRef.current?.(null)
            }
          }

          captureRestQuaternions(avatar)
          resetAvatar(runtime, model)
          readyRef.current = true

          const queuedRequest = pendingPhraseRef.current
          if (queuedRequest) {
            pendingPhraseRef.current = null
            lastReportedTokenIndexRef.current = -1
            enqueuePhrase(queuedRequest.phrase, runtime, appendToQueueRef.current, activeTokensRef)
            onStateChangeRef.current('signing')
          } else {
            onStateChangeRef.current('ready')
          }
        },
        undefined,
        (err) => {
          if (disposed) return
          if (isVincent && !isFallback) {
            console.warn('[AvatarPlayer] Vincent model not found at /models/vincent.glb, falling back to Turquoise Robot:', err)
            loadAvatar('/models/ybot.glb', true)
          } else {
            console.error('[AvatarPlayer] Failed to load model:', err)
            onStateChangeRef.current('error')
          }
        },
      )
    }

    loadAvatar(targetModelPath)

    let animationFrame = 0
    let nextFrameAt = 0
    let wasSigning = false

    const animate = (now: number) => {
      animationFrame = requestAnimationFrame(animate)

      // Handle Pause state: render current frame but freeze delta advancement
      if (isPausedRef.current) {
        renderer.render(scene, camera)
        return
      }

      const queue = runtime.animations
      if (runtime.avatar && queue.length && now >= nextFrameAt) {
        wasSigning = true
        const frame = queue[0]

        // Report active token progress to UI
        if (frame._meta && frame._meta.tokenIndex !== lastReportedTokenIndexRef.current) {
          lastReportedTokenIndexRef.current = frame._meta.tokenIndex
          onProgressRef.current?.({
            currentSignIndex: frame._meta.tokenIndex,
            currentToken: frame._meta.token,
            totalTokens: activeTokensRef.current.length,
            tokens: activeTokensRef.current,
            isFingerspelling: frame._meta.isFingerspelling,
            letter: frame._meta.letter,
          })
        }

        for (let index = 0; index < frame.length; ) {
          const [boneName, , axis, target, direction] = frame[index]
          const bone = getAvatarBone(runtime.avatar, boneName)
          if (!bone) {
            frame.splice(index, 1)
            continue
          }

          const userData = bone.userData as BoneUserData
          const delta = userData.delta ?? (userData.delta = { x: 0, y: 0, z: 0 })
          const [resolvedTarget, resolvedDirection] = resolveInstructionForModel(boneName, axis, target, direction, model)
          const value = delta[axis]
          const step = 0.05 * speedRef.current
          const inProgress = resolvedDirection === '+' ? value < resolvedTarget : value > resolvedTarget

          if (inProgress) {
            delta[axis] = resolvedDirection === '+' ? Math.min(value + step, resolvedTarget) : Math.max(value - step, resolvedTarget)
            const deltaQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(delta.x, delta.y, delta.z))
            const gestureRest = userData.gestureRestQuaternion || userData.restQuaternion
            bone.quaternion.copy(gestureRest ? gestureRest.clone().multiply(deltaQuaternion) : deltaQuaternion)
            index += 1
          } else {
            frame.splice(index, 1)
          }
        }

        if (!frame.length) {
          const finishedFrame = queue.shift()
          // Brief hold time between keyframes (crisper for fingerspelling, readable for words)
          const isFingerspell = finishedFrame?._meta?.isFingerspelling ?? false
          const baseHold = isFingerspell ? 140 : 170
          nextFrameAt = now + baseHold / speedRef.current
        }
      }

      if (wasSigning && !queue.length) {
        wasSigning = false
        lastReportedTokenIndexRef.current = -1
        onStateChangeRef.current('ready')
        onProgressRef.current?.({
          currentSignIndex: -1,
          currentToken: '',
          totalTokens: activeTokensRef.current.length,
          tokens: activeTokensRef.current,
          isFingerspelling: false,
        })
      }

      renderer.render(scene, camera)
    }

    animationFrame = requestAnimationFrame(animate)

    return () => {
      disposed = true
      readyRef.current = false
      cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      renderer.dispose()
      mount.replaceChildren()
    }
  }, [model])

  return (
    <div
      ref={mountRef}
      className="avatar-canvas"
      aria-label="Interactive 3D Indian Sign Language signing avatar"
      role="img"
    />
  )
}

function smoothstep(min: number, max: number, v: number): number {
  const t = Math.max(0, Math.min(1, (v - min) / (max - min)))
  return t * t * (3 - 2 * t)
}

function lerpColor(c1: THREE.Color, c2: THREE.Color, t: number, out: THREE.Color): THREE.Color {
  const clamped = Math.max(0, Math.min(1, t))
  out.r = c1.r + (c2.r - c1.r) * clamped
  out.g = c1.g + (c2.g - c1.g) * clamped
  out.b = c1.b + (c2.b - c1.b) * clamped
  return out
}

/**
 * Applies the signature seafoam-turquoise gradient styling directly matching the user's reference swatch (#8DC1C2).
 * Uses continuous mathematical distance falloff and smoothstep interpolation to eliminate triangle edge jaggedness,
 * providing a luminous, satin-gloss gradient that makes all arm, wrist, and finger articulations ultra-visible.
 */
function applyTurquoiseRobotColors(avatar: THREE.Object3D) {
  // Reference swatch exact matches and gradient stops:
  const seafoamHighlight = new THREE.Color('#D8F2F2') // Soft luminous aqua-white sheen
  const seafoamSheen = new THREE.Color('#A8DFDF')     // Lighter seafoam gradient stop
  const seafoamPrimary = new THREE.Color('#8DC1C2')   // Exact user reference swatch (rgb 141, 193, 194)
  const seafoamMid = new THREE.Color('#62A8A9')       // Rich seafoam midtone
  const seafoamDeep = new THREE.Color('#387778')      // Deep ocean teal contour
  const armorTitanium = new THREE.Color('#D8E0EB')    // Platinum titanium body armor (clear contrast against background)
  const armorHighlight = new THREE.Color('#EDF2F7')   // Pearl white armor highlight
  const darkContour = new THREE.Color('#222B38')      // Carbon slate panel recess
  const jointGraphite = new THREE.Color('#1A222E')    // Mechanical dark joint

  const tempColor = new THREE.Color()
  const tempColorB = new THREE.Color()

  avatar.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return
    const mesh = child as THREE.Mesh
    const positions = mesh.geometry?.attributes.position
    if (!positions) return

    if (mesh.name === 'Alpha_Surface') {
      const colors = new Float32Array(positions.count * 3)

      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i)
        const y = positions.getY(i)
        const z = positions.getZ(i)
        const absX = Math.abs(x)

        let color = armorTitanium

        // 1. HEAD & VISOR GRADIENT (y > 1.52)
        if (y > 1.52) {
          if (z > 0.02) {
            // Front visor: continuous radial gradient from luminous center to deep seafoam rim
            const visorDist = Math.hypot(x * 2.2, (y - 1.65) * 1.6, Math.max(0, z - 0.04))
            const t = smoothstep(0.04, 0.24, visorDist)
            if (t < 0.45) {
              color = lerpColor(seafoamHighlight, seafoamPrimary, t / 0.45, tempColor)
            } else {
              color = lerpColor(seafoamPrimary, seafoamDeep, (t - 0.45) / 0.55, tempColor)
            }
          } else {
            // Back/top of helmet: smooth pearl titanium with subtle seafoam crown sheen
            const domeT = smoothstep(1.52, 1.76, y)
            color = lerpColor(armorTitanium, armorHighlight, domeT, tempColor)
          }
        }
        // 2. NECK (1.44 < y <= 1.52)
        else if (y > 1.44) {
          const neckT = smoothstep(1.44, 1.52, y)
          color = lerpColor(darkContour, seafoamDeep, neckT * 0.4, tempColor)
        }
        // 3. ARMS, FOREARMS & HANDS (Crucial for ISL visibility!)
        else if (absX > 0.28) {
          if (y > 0.98) {
            // Upper arm: Titanium armor with smooth seafoam shoulder cap gradient
            const shoulderDist = Math.hypot(absX - 0.32, y - 1.34)
            const capT = smoothstep(0.06, 0.22, shoulderDist)
            color = lerpColor(seafoamPrimary, armorTitanium, capT, tempColor)
          } else if (y >= 0.65) {
            // Forearm: Continuous gradient from deep seafoam at elbow down to radiant seafoam at wrist
            const armT = smoothstep(0.65, 0.98, y)
            color = lerpColor(seafoamSheen, seafoamDeep, armT, tempColor)
          } else {
            // Hands & Fingers: Luminous seafoam gradient matching reference swatch for crystal clarity!
            const handT = smoothstep(0.40, 0.65, y)
            color = lerpColor(seafoamHighlight, seafoamPrimary, handT, tempColor)
          }
        }
        // 4. CHEST & TORSO (0.75 <= y <= 1.44)
        else {
          // Chest emblem gradient: smooth radial falloff from center (0, 1.30, 0.10)
          const coreDist = Math.hypot(x * 2.0, (y - 1.30) * 1.5, Math.max(0, z - 0.05))
          const isFront = z > 0.03

          if (isFront && coreDist < 0.28) {
            const coreT = smoothstep(0.04, 0.26, coreDist)
            if (coreT < 0.5) {
              color = lerpColor(seafoamHighlight, seafoamPrimary, coreT * 2, tempColor)
            } else {
              color = lerpColor(seafoamPrimary, armorTitanium, (coreT - 0.5) * 2, tempColor)
            }
          } else if (y >= 0.82 && y < 1.15) {
            // Waist & Ribs: smooth sine-wave contour gradient (no jagged cuts!)
            const waistT = Math.sin(((y - 0.82) / 0.33) * Math.PI)
            const spineDist = smoothstep(0.0, 0.12, absX)
            lerpColor(seafoamMid, darkContour, spineDist, tempColorB)
            color = lerpColor(armorTitanium, tempColorB, waistT * 0.75, tempColor)
          } else if (y >= 0.70 && y < 0.82) {
            // Pelvis: Titanium with smooth central seafoam accent
            const pelvisT = smoothstep(0.0, 0.16, absX)
            color = lerpColor(seafoamMid, armorTitanium, pelvisT, tempColor)
          } else {
            color = armorTitanium
          }
        }

        // 5. LEGS & LOWER BODY (y < 0.75 and absX <= 0.28)
        if (y < 0.75 && absX <= 0.28) {
          if (y >= 0.40 && y < 0.54) {
            // Knee: Soft radial seafoam highlight
            const kneeDist = Math.hypot(absX - 0.14, y - 0.47)
            const kneeT = smoothstep(0.03, 0.14, kneeDist)
            color = lerpColor(seafoamPrimary, armorTitanium, kneeT, tempColor)
          } else if (y < 0.14) {
            color = darkContour
          } else {
            color = armorTitanium
          }
        }

        colors[i * 3] = color.r
        colors[i * 3 + 1] = color.g
        colors[i * 3 + 2] = color.b
      }

      mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      mesh.material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.34,
        metalness: 0.16,
      })
    }

    if (mesh.name === 'Alpha_Joints') {
      const colors = new Float32Array(positions.count * 3)
      for (let i = 0; i < positions.count; i++) {
        colors[i * 3] = jointGraphite.r
        colors[i * 3 + 1] = jointGraphite.g
        colors[i * 3 + 2] = jointGraphite.b
      }
      mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      mesh.material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.42,
        metalness: 0.65,
      })
    }
  })
}

function applyWarmArmorColors(avatar: THREE.Object3D) {
  const chestCream = new THREE.Color('#e2d3bc')
  const warmBeige = new THREE.Color('#d4bea1')
  const limbBeige = new THREE.Color('#c8b093')
  const lowerBeige = new THREE.Color('#bfa88c')
  const neckCream = new THREE.Color('#d9c7ae')
  const jointCharcoal = new THREE.Color('#4a4641')

  avatar.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return
    const mesh = child as THREE.Mesh
    const positions = mesh.geometry?.attributes.position
    if (!positions) return

    if (mesh.name === 'Alpha_Surface') {
      const colors = new Float32Array(positions.count * 3)
      for (let index = 0; index < positions.count; index += 1) {
        const x = positions.getX(index)
        const y = positions.getY(index)
        const z = positions.getZ(index)
        const isNeck = y > 1.48 && Math.abs(x) < 0.12 && z > -0.1
        const isChest = y >= 1.18 && Math.abs(x) <= 0.38
        const isWaistOrHip = y >= 0.78 && y < 1.18 && Math.abs(x) <= 0.36
        const isArm = Math.abs(x) > 0.34 && y > 0.82
        const isCalfOrFoot = y < 0.42
        const color = isNeck
          ? neckCream
          : isChest
            ? chestCream
            : isWaistOrHip
              ? warmBeige
              : isArm
                ? limbBeige
                : isCalfOrFoot
                  ? lowerBeige
                  : warmBeige
        colors[index * 3] = color.r
        colors[index * 3 + 1] = color.g
        colors[index * 3 + 2] = color.b
      }
      mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      mesh.material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.63,
        metalness: 0.04,
      })
    }

    if (mesh.name === 'Alpha_Joints') {
      const colors = new Float32Array(positions.count * 3)
      for (let index = 0; index < positions.count; index += 1) {
        colors[index * 3] = jointCharcoal.r
        colors[index * 3 + 1] = jointCharcoal.g
        colors[index * 3 + 2] = jointCharcoal.b
      }
      mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      mesh.material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.72,
        metalness: 0.07,
      })
    }
  })
}

/**
 * Comprehensive bone alias dictionary mapping Mixamo bone names used by SignFlow's
 * sign-language animations to Blender Studio's Vincent (BlenRig) and standard glTF conventions.
 */
const BONE_ALIASES: Record<string, string[]> = {
  // Spine, Neck & Head
  mixamorigNeck: ['neck_1_def', 'neck_1_fk', 'neck_fk_ctrl', 'neck_fk', 'neck', 'Neck', 'DEF-neck'],
  mixamorigHead: ['head_def_1', 'head_fk', 'head_ik_ctrl', 'head', 'Head', 'DEF-head'],

  // Shoulders & Arms
  mixamorigLeftShoulder: ['shoulder_L', 'shoulder_def_L', 'clavicle_L', 'LeftShoulder', 'DEF-shoulder.L'],
  mixamorigRightShoulder: ['shoulder_R', 'shoulder_def_R', 'clavicle_R', 'RightShoulder', 'DEF-shoulder.R'],
  mixamorigLeftArm: ['arm_fk_L', 'arm_def_L', 'arm_L', 'UpperArm_L', 'LeftArm', 'DEF-upper_arm.L'],
  mixamorigRightArm: ['arm_fk_R', 'arm_def_R', 'arm_R', 'UpperArm_R', 'RightArm', 'DEF-upper_arm.R'],
  mixamorigLeftForeArm: ['forearm_fk_L', 'forearm_def_L', 'forearm_L', 'forearm_no_twist_def_L', 'LeftForeArm', 'DEF-forearm.L'],
  mixamorigRightForeArm: ['forearm_fk_R', 'forearm_def_R', 'forearm_R', 'forearm_no_twist_def_R', 'RightForeArm', 'DEF-forearm.R'],
  mixamorigLeftHand: ['hand_fk_L', 'hand_def_L', 'hand_L', 'LeftHand', 'DEF-hand.L'],
  mixamorigRightHand: ['hand_fk_R', 'hand_def_R', 'hand_R', 'RightHand', 'DEF-hand.R'],

  // Left Hand - Thumb
  mixamorigLeftHandThumb1: ['fing_thumb_1_L', 'fing_thumb_1_def_L', 'thumb_01_L', 'LeftHandThumb1', 'DEF-thumb.01.L'],
  mixamorigLeftHandThumb2: ['fing_thumb_2_L', 'fing_thumb_2_def_L', 'thumb_02_L', 'LeftHandThumb2', 'DEF-thumb.02.L'],
  mixamorigLeftHandThumb3: ['fing_thumb_3_L', 'fing_thumb_3_def_L', 'thumb_03_L', 'LeftHandThumb3', 'DEF-thumb.03.L'],

  // Right Hand - Thumb
  mixamorigRightHandThumb1: ['fing_thumb_1_R', 'fing_thumb_1_def_R', 'thumb_01_R', 'RightHandThumb1', 'DEF-thumb.01.R'],
  mixamorigRightHandThumb2: ['fing_thumb_2_R', 'fing_thumb_2_def_R', 'thumb_02_R', 'RightHandThumb2', 'DEF-thumb.02.R'],
  mixamorigRightHandThumb3: ['fing_thumb_3_R', 'fing_thumb_3_def_R', 'thumb_03_R', 'RightHandThumb3', 'DEF-thumb.03.R'],

  // Left Hand - Index Finger (BlenRig fing_ind_2=proximal, fing_ind_3=inter, fing_ind_4=distal)
  mixamorigLeftHandIndex1: ['fing_ind_2_L', 'fing_ind_2_def_L', 'fing_ind_1_L', 'f_index.01.L', 'LeftHandIndex1', 'DEF-f_index.01.L'],
  mixamorigLeftHandIndex2: ['fing_ind_3_L', 'fing_ind_3_def_L', 'f_index.02.L', 'LeftHandIndex2', 'DEF-f_index.02.L'],
  mixamorigLeftHandIndex3: ['fing_ind_4_L', 'fing_ind_4_def_L', 'f_index.03.L', 'LeftHandIndex3', 'DEF-f_index.03.L'],

  // Right Hand - Index Finger
  mixamorigRightHandIndex1: ['fing_ind_2_R', 'fing_ind_2_def_R', 'fing_ind_1_R', 'f_index.01.R', 'RightHandIndex1', 'DEF-f_index.01.R'],
  mixamorigRightHandIndex2: ['fing_ind_3_R', 'fing_ind_3_def_R', 'f_index.02.R', 'RightHandIndex2', 'DEF-f_index.02.R'],
  mixamorigRightHandIndex3: ['fing_ind_4_R', 'fing_ind_4_def_R', 'f_index.03.R', 'RightHandIndex3', 'DEF-f_index.03.R'],

  // Left Hand - Middle Finger
  mixamorigLeftHandMiddle1: ['fing_mid_2_L', 'fing_mid_2_def_L', 'fing_mid_1_L', 'f_middle.01.L', 'LeftHandMiddle1', 'DEF-f_middle.01.L'],
  mixamorigLeftHandMiddle2: ['fing_mid_3_L', 'fing_mid_3_def_L', 'f_middle.02.L', 'LeftHandMiddle2', 'DEF-f_middle.02.L'],
  mixamorigLeftHandMiddle3: ['fing_mid_4_L', 'fing_mid_4_def_L', 'f_middle.03.L', 'LeftHandMiddle3', 'DEF-f_middle.03.L'],

  // Right Hand - Middle Finger
  mixamorigRightHandMiddle1: ['fing_mid_2_R', 'fing_mid_2_def_R', 'fing_mid_1_R', 'f_middle.01.R', 'RightHandMiddle1', 'DEF-f_middle.01.R'],
  mixamorigRightHandMiddle2: ['fing_mid_3_R', 'fing_mid_3_def_R', 'f_middle.02.R', 'RightHandMiddle2', 'DEF-f_middle.02.R'],
  mixamorigRightHandMiddle3: ['fing_mid_4_R', 'fing_mid_4_def_R', 'f_middle.03.R', 'RightHandMiddle3', 'DEF-f_middle.03.R'],

  // Left Hand - Ring Finger
  mixamorigLeftHandRing1: ['fing_ring_2_L', 'fing_ring_2_def_L', 'fing_ring_1_L', 'f_ring.01.L', 'LeftHandRing1', 'DEF-f_ring.01.L'],
  mixamorigLeftHandRing2: ['fing_ring_3_L', 'fing_ring_3_def_L', 'f_ring.02.L', 'LeftHandRing2', 'DEF-f_ring.02.L'],
  mixamorigLeftHandRing3: ['fing_ring_4_L', 'fing_ring_4_def_L', 'f_ring.03.L', 'LeftHandRing3', 'DEF-f_ring.03.L'],

  // Right Hand - Ring Finger
  mixamorigRightHandRing1: ['fing_ring_2_R', 'fing_ring_2_def_R', 'fing_ring_1_R', 'f_ring.01.R', 'RightHandRing1', 'DEF-f_ring.01.R'],
  mixamorigRightHandRing2: ['fing_ring_3_R', 'fing_ring_3_def_R', 'f_ring.02.R', 'RightHandRing2', 'DEF-f_ring.02.R'],
  mixamorigRightHandRing3: ['fing_ring_4_R', 'fing_ring_4_def_R', 'f_ring.03.R', 'RightHandRing3', 'DEF-f_ring.03.R'],

  // Left Hand - Pinky / Little Finger
  mixamorigLeftHandPinky1: ['fing_lit_2_L', 'fing_lit_2_def_L', 'fing_lit_1_L', 'f_pinky.01.L', 'LeftHandPinky1', 'DEF-f_pinky.01.L'],
  mixamorigLeftHandPinky2: ['fing_lit_3_L', 'fing_lit_3_def_L', 'f_pinky.02.L', 'LeftHandPinky2', 'DEF-f_pinky.02.L'],
  mixamorigLeftHandPinky3: ['fing_lit_4_L', 'fing_lit_4_def_L', 'f_pinky.03.L', 'LeftHandPinky3', 'DEF-f_pinky.03.L'],

  // Right Hand - Pinky / Little Finger
  mixamorigRightHandPinky1: ['fing_lit_2_R', 'fing_lit_2_def_R', 'fing_lit_1_R', 'f_pinky.01.R', 'RightHandPinky1', 'DEF-f_pinky.01.R'],
  mixamorigRightHandPinky2: ['fing_lit_3_R', 'fing_lit_3_def_R', 'f_pinky.02.R', 'RightHandPinky2', 'DEF-f_pinky.02.R'],
  mixamorigRightHandPinky3: ['fing_lit_4_R', 'fing_lit_4_def_R', 'f_pinky.03.R', 'RightHandPinky3', 'DEF-f_pinky.03.R'],
}

function getAvatarBone(avatar: THREE.Object3D, boneName: string): THREE.Object3D | undefined {
  const compact = boneName.replace(/^mixamorig:?/, '')
  const aliasList = BONE_ALIASES[boneName] || BONE_ALIASES[`mixamorig${compact}`] || []
  const candidates = [
    boneName,
    `mixamorig:${compact}`,
    `mixamorig${compact}`,
    compact,
    ...aliasList,
  ]

  for (const candidate of candidates) {
    const bone = avatar.getObjectByName(candidate)
    if (bone) return bone
  }

  // Fallback: search through all Bone objects in the hierarchy
  const lowerCandidates = candidates.map((c) => c.toLowerCase())
  let resolved: THREE.Object3D | undefined
  avatar.traverse((child) => {
    if (resolved || child.type !== 'Bone') return
    const normalized = child.name.split('|').pop()?.replace(/^mixamorig:?/, '') || child.name
    const childLower = normalized.toLowerCase()
    if (lowerCandidates.includes(childLower)) {
      resolved = child
    }
  })
  return resolved
}

function captureRestQuaternions(avatar: THREE.Object3D) {
  avatar.traverse((child) => {
    if (child.type !== 'Bone') return
    const userData = child.userData as BoneUserData
    userData.restQuaternion = child.quaternion.clone()
    userData.gestureRestQuaternion = userData.restQuaternion.clone()
    userData.restPosition = child.position.clone()
    userData.restScale = child.scale.clone()
  })
}

function resetAvatar(runtime: SignRuntime, model: AvatarModelType = 'turquoise') {
  const avatar = runtime.avatar
  if (!avatar) return

  runtime.animations = []
  runtime.characters = []
  avatar.traverse((child) => {
    if (child.type !== 'Bone') return
    const userData = child.userData as BoneUserData
    if (userData.gestureRestQuaternion) child.quaternion.copy(userData.gestureRestQuaternion)
    if (userData.restPosition) child.position.copy(userData.restPosition)
    if (userData.restScale) child.scale.copy(userData.restScale)
    userData.delta = { x: 0, y: 0, z: 0 }
  })

  defaultPose(runtime)
  for (const frame of runtime.animations) {
    for (const [boneName, , axis, target, direction] of frame) {
      const bone = getAvatarBone(avatar, boneName)
      if (!bone) continue
      const userData = bone.userData as BoneUserData
      const delta = userData.delta ?? (userData.delta = { x: 0, y: 0, z: 0 })
      const [resolvedTarget] = resolveInstructionForModel(boneName, axis, target, direction, model)
      delta[axis] = resolvedTarget
      const deltaQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(delta.x, delta.y, delta.z))
      const gestureRest = userData.gestureRestQuaternion || userData.restQuaternion
      bone.quaternion.copy(gestureRest ? gestureRest.clone().multiply(deltaQuaternion) : deltaQuaternion)
    }
  }
  runtime.animations = []
  runtime.characters = []
}

function resolveInstructionForModel(
  _boneName: string,
  _axis: 'x' | 'y' | 'z',
  target: number,
  direction: '+' | '-',
  _model: AvatarModelType,
): [number, '+' | '-'] {
  return [target, direction]
}

function enqueuePhrase(
  input: string,
  runtime: SignRuntime,
  append = false,
  activeTokensRef?: { current: string[] },
) {
  if (!append) {
    if (runtime.avatar) resetAvatar(runtime, runtime.model ?? 'turquoise')
    runtime.animations = []
  }

  const tokens = looksPreTranslated(input)
    ? input.trim().toUpperCase().split(/\s+/).filter(Boolean)
    : (textToGloss(input) as { tokens: string[] }).tokens

  if (activeTokensRef) {
    activeTokensRef.current = append ? [...activeTokensRef.current, ...tokens] : tokens
  }

  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
    const token = tokens[tokenIndex]
    const word = token.toUpperCase()
    const wordAnimation = wordAnimations[word]

    if (wordAnimation) {
      const tempRuntime: SignRuntime = { animations: [], characters: [], pending: true }
      wordAnimation(tempRuntime)
      for (const frame of tempRuntime.animations) {
        const tagged: TaggedInstructionFrame = [...frame]
        tagged._meta = {
          tokenIndex,
          token,
          isFingerspelling: false,
        }
        runtime.animations.push(tagged)
      }
      continue
    }

    // Fallback: Fingerspell letter by letter
    for (const letter of word) {
      const letterAnim = alphabetAnimations[letter]
      if (letterAnim) {
        const tempRuntime: SignRuntime = { animations: [], characters: [], pending: true }
        letterAnim(tempRuntime)
        for (const frame of tempRuntime.animations) {
          const tagged: TaggedInstructionFrame = [...frame]
          tagged._meta = {
            tokenIndex,
            token,
            isFingerspelling: true,
            letter,
          }
          runtime.animations.push(tagged)
        }
      }
    }
  }
}
