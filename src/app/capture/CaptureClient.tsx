'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { gsap } from 'gsap'
import type { FinishKey } from '@/content/site'
import { StageController } from '@/components/three/stageController'
import { buildStateTimeline, initialState, type StoryState } from '@/components/three/storyState'

const BG = '#070b20'
type Preset = { t: number; set?: Partial<StoryState>; finish?: FinishKey }
const CENTER = { fx: 0.5, fy: 0.5, fw: 0.72, fh: 0.8 }
const CORNER = { rotY: -0.8, pitch: 0.3, focusX: 0.55, focusY: 0.85, focusZ: 0.45, radius: 0.55, floor: 0, dust: 0 }

/** Ảnh tĩnh (mobile / giảm chuyển động / vật liệu / OG) = cùng cảnh 3D tại các mốc của câu chuyện. */
export const PRESETS: Record<string, Preset> = {
  hero: { t: 0 },
  statement: { t: 24 },
  exploded: { t: 63, set: { fh: 0.72 } },
  'finish-graphite': { t: 100, finish: 'graphite' },
  'finish-silver': { t: 100, finish: 'silver' },
  'finish-walnut': { t: 100, finish: 'walnut' },
  'material-aluminium': { t: 0, set: { rotY: -0.35, pitch: 0.95, focusY: 1.05, focusZ: -0.22, radius: 0.55, dust: 0 } },
  'material-shell': { t: 0, set: CORNER },
  'material-walnut': { t: 0, set: CORNER, finish: 'walnut' },
  room: { t: 100, set: { fx: 0.42, fy: 0.5, fw: 0.3, fh: 0.62 } },
}

function Shot({ preset, onReady }: { preset: Preset; onReady: () => void }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    const dispose = setupShot(gl, scene, camera, size.width, size.height, preset)
    invalidate()
    const id = setTimeout(onReady, 800)
    return () => {
      clearTimeout(id)
      dispose()
    }
  }, [gl, scene, camera, size, invalidate, preset, onReady])
  return null
}

function setupShot(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, W: number, H: number, preset: Preset) {
  const ctl = new StageController()
  scene.background = new THREE.Color(BG)
  const detach = ctl.attachEnvironment(gl, scene)
  scene.add(ctl.root)
  const state = initialState()
  buildStateTimeline(gsap, state).time(preset.t)
  Object.assign(state, CENTER, preset.set)
  if (preset.finish) ctl.setFinish(preset.finish)
  ctl.snap = true
  ctl.update(state, camera, gl, W, H, 1 / 60)
  return () => {
    scene.remove(ctl.root)
    detach()
    ctl.dispose()
  }
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
        camera={{ fov: 26, near: 0.1, far: 100, position: [0, 0, 10] }}
        style={{ width: w, height: h }}
      >
        <Shot preset={preset} onReady={onReady} />
      </Canvas>
    </div>
  )
}
