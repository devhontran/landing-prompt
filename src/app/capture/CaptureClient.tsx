'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { FinishKey } from '@/content/site'
import { BG, CAM_Z, FOV, Rig, type Pose, type StageKey } from '@/components/three/rig'

type Preset = { stage: StageKey; pose: Partial<Pose>; finish?: FinishKey; room?: boolean }
const BASE: Pose = { cx: 0.5, cy: 0.5, hf: 0.8, rotY: -0.55, rotX: 0.06, explode: 0 }

/** Ảnh tĩnh cho mobile / giảm chuyển động = cùng cảnh 3D ở các pose cố định. */
export const PRESETS: Record<string, Preset> = {
  hero: { stage: 'hero', pose: { hf: 0.78, cy: 0.53 } },
  statement: { stage: 'statement', pose: { hf: 0.9, rotY: -0.5 } },
  exploded: { stage: 'exploded', pose: { cx: 0.52, hf: 0.6, rotY: -0.85, explode: 1 } },
  'finish-graphite': { stage: 'finish', pose: {}, finish: 'graphite' },
  'finish-silver': { stage: 'finish', pose: {}, finish: 'silver' },
  'finish-walnut': { stage: 'finish', pose: {}, finish: 'walnut' },
  'material-aluminium': { stage: 'finish', pose: { hf: 4.2, cy: 0.62, rotY: -1.25, rotX: 0.2 }, finish: 'silver' },
  'material-glass': { stage: 'finish', pose: { hf: 3.6, cy: 0.35, rotY: -0.3, rotX: 0.1 } },
  'material-walnut': { stage: 'finish', pose: { hf: 4.2, cy: 0.62, rotY: -1.25, rotX: 0.2 }, finish: 'walnut' },
  room: { stage: 'finish', pose: { cx: 0.35, cy: 0.56, hf: 0.5, rotY: -0.35, rotX: 0.04 }, room: true },
}

function Shot({ preset, onReady }: { preset: Preset; onReady: () => void }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    const dispose = setupShot(gl, scene, camera, preset)
    invalidate()
    const id = setTimeout(onReady, 600)
    return () => {
      clearTimeout(id)
      dispose()
    }
  }, [gl, scene, camera, invalidate, preset, onReady])
  return null
}

function setupShot(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, preset: Preset) {
  const rig = new Rig(gl, scene, camera)
  scene.background = new THREE.Color(BG)
  rig.want(preset.stage, { ...BASE, ...preset.pose })
  if (preset.finish) rig.setFinish(preset.finish)
  rig.snap()
  const extra = preset.room ? buildRoom(rig) : []
  extra.forEach((o) => scene.add(o))
  return () => {
    extra.forEach((o) => scene.remove(o))
    rig.dispose()
  }
}

/** Phòng nghe minh hoạ: sàn + tường tối, cặp loa. [CẦN CUNG CẤP] ảnh chụp không gian thật. */
function buildRoom(rig: Rig) {
  const root = rig.tower.root
  const s = root.scale.x
  const floorY = root.position.y - 0.85 * s
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: '#0d1024', roughness: 0.6, metalness: 0.2 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = floorY
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshStandardMaterial({ color: '#0a0d20', roughness: 0.9 }))
  wall.position.set(0, floorY + 10, -2.2)
  const cam = rig.camera
  const Hv = 2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
  const pair = root.clone()
  pair.position.x += 0.3 * Hv * cam.aspect
  pair.rotation.y = 0.35
  return [floor, wall, pair]
}

export default function CaptureClient() {
  // Đọc tham số URL chỉ ở client (server trả null → không lệch hydration).
  const search = useSyncExternalStore(
    () => () => {},
    () => window.location.search,
    () => null,
  )
  const params = new URLSearchParams(search ?? '')
  const preset = PRESETS[params.get('preset') ?? 'hero'] ?? PRESETS.hero
  const w = Number(params.get('w') ?? 1200)
  const h = Number(params.get('h') ?? 1200)
  const [ready, setReady] = useState(false)
  const onReady = useCallback(() => setReady(true), [])
  if (search === null) return null

  return (
    <div style={{ width: w, height: h, background: BG }} data-capture-ready={ready || undefined}>
      <Canvas
        dpr={1}
        frameloop="always"
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ fov: FOV, near: 0.1, far: 40, position: [0, 0, CAM_Z] }}
        style={{ width: w, height: h }}
      >
        <Shot preset={preset} onReady={onReady} />
      </Canvas>
    </div>
  )
}
