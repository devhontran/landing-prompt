'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { detectMode, subscribeMode, type ExperienceMode } from '@/lib/experience'

// Chunk 3D (three.js + R3F + GSAP) chỉ được tải khi thực sự render ở chế độ '3d'.
const loadStoryGL = () => import('./three/StoryGL')
const StoryGL = dynamic(loadStoryGL, { ssr: false })

export function useExperienceMode(): ExperienceMode | 'pending' {
  return useSyncExternalStore(subscribeMode, detectMode, () => 'pending' as const)
}

export function StoryStage() {
  const mode = useExperienceMode()
  const [idle, setIdle] = useState(false)

  // Tải chunk 3D ngay, nhưng chỉ khởi tạo cảnh khi trình duyệt rảnh (sau hydrate) để không chặn tương tác đầu.
  useEffect(() => {
    if (mode !== '3d') return
    loadStoryGL()
    const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200))
    const cancel = window.cancelIdleCallback ?? window.clearTimeout
    const id = ric(() => setIdle(true), { timeout: 1500 })
    return () => cancel(id)
  }, [mode])

  useEffect(() => {
    if (mode === 'pending') return
    const html = document.documentElement
    html.dataset.mode = mode
    if (mode === 'static') {
      // Máy desktop không có WebGL: gỡ nguồn "ảnh trống" để trình duyệt tải ảnh tĩnh thật.
      document.querySelectorAll('source[data-gate]').forEach((s) => s.remove())
    }
  }, [mode])

  return mode === '3d' && idle ? <StoryGL /> : null
}
