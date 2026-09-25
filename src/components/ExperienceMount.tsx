'use client'

import dynamic from 'next/dynamic'
import { useEffect, useSyncExternalStore } from 'react'
import { detectMode, subscribeMode, type ExperienceMode } from '@/lib/experience'

// three.js / GSAP / Lenis chỉ được tải khi thật sự ở chế độ 3D (mobile không tải).
const Experience = dynamic(() => import('./three/Experience'), { ssr: false })

const getServer = (): ExperienceMode | null => null

/** Quyết định chế độ ở client; nếu rơi về tĩnh (không WebGL2, máy yếu...) thì mở cổng ảnh tĩnh. */
export function ExperienceMount() {
  const mode = useSyncExternalStore(subscribeMode, detectMode, getServer)

  useEffect(() => {
    if (!mode) return
    const html = document.documentElement
    if (mode === 'static') {
      html.dataset.mode = 'static'
      html.dataset.loaded = 'true'
      // Bỏ nguồn GIF chặn ảnh để <picture> tải ảnh thật.
      document.querySelectorAll('source[data-gate]').forEach((s) => s.remove())
    }
  }, [mode])

  return mode === '3d' ? <Experience /> : null
}
