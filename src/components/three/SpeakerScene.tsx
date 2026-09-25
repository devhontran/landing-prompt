'use client'

import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import type { SpeakerBuild } from './proceduralSpeaker'
import type { StoryState } from './storyState'
import { StageController, type FrameInfo } from './stageController'

export type { FrameInfo, AnchorScreen } from './stageController'

type Props = {
  state: StoryState
  /** Model thay thế (GLB) nếu đã có; null = model placeholder. */
  build?: SpeakerBuild | null
  onFrame?: (info: FrameInfo) => void
  measureModel?: boolean
  onReady?: () => void
  /** false khi phần kể chuyện nằm ngoài màn hình → dừng vòng vẽ liên tục của sàn. */
  isActive?: () => boolean
}

/** Nhường luồng chính cho trình duyệt giữa các bước nặng (tránh một long task dài). */
const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0))

export default function SpeakerScene({ state, build, onFrame, measureModel, onReady, isActive }: Props) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)
  const [controller, setController] = useState<StageController | null>(null)
  const readyRef = useRef(false)

  // Khởi tạo theo từng bước: dựng model → ánh sáng môi trường → biên dịch shader bất đồng bộ
  // (KHR_parallel_shader_compile nếu có). Model chỉ được gắn vào scene khi mọi shader đã sẵn sàng,
  // nên frame đầu và các lần chuyển sang nét bản vẽ / sàn không bị giật vì biên dịch.
  useEffect(() => {
    let alive = true
    let ctrl: StageController | null = null
    let detachEnv: (() => void) | null = null
    ;(async () => {
      await yieldToMain()
      if (!alive) return
      ctrl = new StageController(build)
      await yieldToMain()
      if (!alive) return
      detachEnv = ctrl.attachEnvironment(gl, scene)
      await yieldToMain()
      if (!alive) return
      performance.mark('stage:compile-start')
      await gl.compileAsync(ctrl.root, camera, scene).catch(() => undefined)
      performance.measure('stage:compile', 'stage:compile-start')
      if (!alive) return
      setController(ctrl)
      invalidate()
    })()
    return () => {
      alive = false
      detachEnv?.()
      ctrl?.dispose()
    }
  }, [build, gl, scene, camera, invalidate])

  useFrame(({ size }, delta) => {
    if (!controller) return
    const cam = camera as THREE.PerspectiveCamera
    const animating = controller.update(state, cam, gl, size.width, size.height, delta)
    if (onFrame) onFrame({ ...controller.project(cam, size.width, size.height, !!measureModel), drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles })
    if (!readyRef.current) {
      readyRef.current = true
      onReady?.()
    }
    if (animating && (isActive?.() ?? true)) invalidate()
  })

  return controller ? <primitive object={controller.root} /> : null
}
