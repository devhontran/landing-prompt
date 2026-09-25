'use client'

import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import { Director } from './director'
import { CAM_Z, FOV } from './rig'

declare global {
  interface Window {
    __scene?: Director
  }
}

function Scene({ wrap }: { wrap: React.RefObject<HTMLDivElement | null> }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const invalidate = useThree((s) => s.invalidate)
  const director = useRef<Director | null>(null)

  useEffect(() => {
    const d = new Director(gl, scene, camera, invalidate, wrap.current!)
    director.current = d
    window.__scene = d
    invalidate()
    return () => {
      d.dispose()
      director.current = null
      delete window.__scene
    }
  }, [gl, scene, camera, invalidate, wrap])

  useFrame((_, dt) => director.current?.frame(dt))
  return null
}

/** Canvas WebGL cố định toàn trang (chỉ tải ở chế độ 3D). Chỉ vẽ khi có thay đổi (frameloop demand), ẩn khi không có cảnh. */
export default function Experience() {
  const wrap = useRef<HTMLDivElement>(null)
  return (
    <div className="webgl" ref={wrap} aria-hidden="true">
      <Canvas
        frameloop="demand"
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: FOV, near: 0.1, far: 40, position: [0, 0, CAM_Z] }}
      >
        <Scene wrap={wrap} />
      </Canvas>
    </div>
  )
}
