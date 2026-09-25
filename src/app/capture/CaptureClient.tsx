'use client'

import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { gsap } from 'gsap'
import SpeakerScene from '@/components/three/SpeakerScene'
import { buildStateTimeline, initialState, type StoryState } from '@/components/three/storyState'

type Preset = { t?: number; set?: Partial<StoryState> }
const CENTER = { fx: 0.5, fy: 0.5, fw: 0.8, fh: 0.8 }

/** Ảnh cảnh = trạng thái timeline tại mốc tương ứng; ảnh gallery = các góc nhìn riêng. */
export const PRESETS: Record<string, Preset> = {
  hero: { t: 0 },
  back: { t: 26 },
  blueprint: { t: 44 },
  driver: { t: 63 },
  pcb: { t: 75 },
  enclosure: { t: 86 },
  final: { t: 100, set: { fy: 0.46 } },
  'view-1': { set: { rotY: 0, pitch: 0.04 } },
  'view-2': { set: { rotY: -0.62, pitch: 0.14 } },
  'view-3': { t: 57, set: { radius: 2.1 } },
  'view-4': { set: { rotY: Math.PI - 0.35, pitch: 0.12 } },
  'view-5': { set: { rotY: -0.35, pitch: 0.95, focusY: 1.05, focusZ: -0.22, radius: 0.55 } },
  'view-6': { set: { rotY: -0.25, pitch: 0.06, focusY: -0.2, focusZ: 0.6, radius: 0.62 } },
  'view-7': { t: 100, set: { fy: 0.48, fh: 0.7 } },
  'view-8': { set: { rotY: 0.55, pitch: -0.12, focusY: 0.1 } },
}

export default function CaptureClient() {
  const [params] = useState(() => new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search))
  const name = params.get('preset') ?? 'hero'
  const w = Number(params.get('w') ?? 1200)
  const h = Number(params.get('h') ?? 1200)
  const state = useMemo(() => {
    const s = initialState()
    const p = PRESETS[name] ?? {}
    if (p.t !== undefined) {
      const tl = buildStateTimeline(gsap, s)
      tl.time(p.t)
    }
    Object.assign(s, CENTER, p.set)
    return s
  }, [name])
  const [frames, setFrames] = useState(0)

  return (
    <div style={{ width: w, height: h, background: '#0a0a0b' }} data-capture-ready={frames > 3 || undefined}>
      <Canvas
        dpr={1}
        frameloop="always"
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        camera={{ fov: 26, near: 0.1, far: 100, position: [0, 0, 10] }}
        style={{ width: w, height: h }}
      >
        <SpeakerScene state={state} snap onFrame={() => frames < 5 && setFrames((f) => f + 1)} />
      </Canvas>
    </div>
  )
}
