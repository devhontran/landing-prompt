'use client'

import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import type { StoryState } from './storyState'
import { StageController, type FrameInfo } from './stageController'
import { loadGlbSpeaker } from './loadGlb'

export type { FrameInfo, AnchorScreen } from './stageController'

type Props = {
  /** Trạng thái ĐÍCH (từ timeline cuộn); cảnh tự đuổi theo bằng damping. */
  state: StoryState
  /** URL model .glb thật; null = model placeholder dựng bằng code. */
  modelUrl?: string | null
  onFrame?: (info: FrameInfo) => void
  measureModel?: boolean
  onReady?: (controller: StageController) => void
  /** false khi phần kể chuyện nằm ngoài màn hình → không tự yêu cầu frame mới. */
  isActive?: () => boolean
  /** FPS < 50 liên tục 1 giây khi đang chuyển động → báo để hạ DPR. */
  onLowFps?: () => void
  /** Bỏ damping/intro (chụp ảnh tĩnh). */
  snap?: boolean
}

/** Nhường luồng chính cho trình duyệt giữa các bước nặng (tránh một long task dài). */
const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0))

export default function SpeakerScene({ state, modelUrl, onFrame, measureModel, onReady, isActive, onLowFps, snap }: Props) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)
  const [controller, setController] = useState<StageController | null>(null)
  const readyRef = useRef(false)
  const fpsRef = useRef({ frames: 0, time: 0, reported: false })

  // Khởi tạo theo từng bước: (nạp GLB) → dựng cảnh → môi trường → biên dịch shader bất đồng bộ.
  // Model chỉ được gắn vào scene khi mọi shader đã sẵn sàng → không giật vì biên dịch giữa chừng.
  useEffect(() => {
    let alive = true
    let ctrl: StageController | null = null
    let detachEnv: (() => void) | null = null
    ;(async () => {
      let build = null
      if (modelUrl) {
        try {
          build = await loadGlbSpeaker(modelUrl, gl)
        } catch (e) {
          console.error('[speaker] Không nạp được model, dùng placeholder.', e)
        }
      }
      await yieldToMain()
      if (!alive) return
      ctrl = new StageController(build)
      ctrl.snap = !!snap
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
  }, [modelUrl, snap, gl, scene, camera, invalidate])

  useFrame(({ size }, delta) => {
    if (!controller) return
    const cam = camera as THREE.PerspectiveCamera
    const animating = controller.update(state, cam, gl, size.width, size.height, delta)
    if (onFrame) onFrame({ ...controller.project(cam, size.width, size.height, !!measureModel), drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles })
    if (!readyRef.current) {
      readyRef.current = true
      onReady?.(controller)
    }
    // DPR thích ứng: chỉ đo khi đang vẽ liên tục (delta nhỏ), cửa sổ 1 giây.
    const f = fpsRef.current
    if (onLowFps && !f.reported && delta < 0.25) {
      f.frames++
      f.time += delta
      if (f.time >= 1) {
        if (f.frames / f.time < 50) {
          f.reported = true
          onLowFps()
        }
        f.frames = 0
        f.time = 0
      }
    }
    // Còn đang đuổi theo đích → luôn vẽ tiếp; hiệu ứng liên tục (sàn, bụi) chỉ khi phần kể chuyện đang trên màn hình.
    if (!controller.settled || (animating && (isActive?.() ?? true))) invalidate()
  })

  return controller ? <primitive object={controller.root} /> : null
}
