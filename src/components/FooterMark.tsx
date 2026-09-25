'use client'

import { useEffect, useRef } from 'react'
import { useExperienceMode } from './StoryStage'

/**
 * Wordmark cuối trang. Chế độ 3D: chữ được vẽ lại trên canvas WebGL dùng chung (webgl/footerLayer.ts);
 * thẻ DOM vẫn giữ bố cục và là phương án dự phòng.
 */
export function FooterMark({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const mode = useExperienceMode()

  useEffect(() => {
    if (mode !== '3d') return
    const el = ref.current!
    let disposed = false
    let cleanup: (() => void) | null = null
    Promise.all([import('./webgl/footerLayer'), import('./webgl/bus'), import('gsap'), import('gsap/ScrollTrigger'), document.fonts.ready]).then(
      ([{ FooterLayer }, { bus, addLayer }, { gsap }, { ScrollTrigger }]) => {
        if (disposed) return
        gsap.registerPlugin(ScrollTrigger)
        const layer = new FooterLayer(el)
        layer.pointer = bus.pointer
        const remove = addLayer(layer)
        el.dataset.gl = 'true'
        const st = ScrollTrigger.create({
          trigger: el.closest('footer') ?? el,
          start: 'top 75%',
          end: 'bottom bottom',
          scrub: true,
          onUpdate: (s) => {
            layer.reveal = s.progress
            bus.invalidate()
          },
        })
        layer.reveal = st.progress
        const ro = new ResizeObserver(() => {
          layer.build()
          bus.invalidate()
        })
        ro.observe(el)
        cleanup = () => {
          st.kill()
          ro.disconnect()
          remove()
          layer.dispose()
          delete el.dataset.gl
        }
      },
    )
    return () => {
      disposed = true
      cleanup?.()
    }
  }, [mode])

  return (
    <p ref={ref} className="site-footer__mark" aria-hidden="true">
      {text}
    </p>
  )
}
