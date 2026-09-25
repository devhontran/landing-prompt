'use client'

import { useEffect, useRef } from 'react'
import { Arrow } from './Typo'

/**
 * CTA hình tròn có vòng chữ xoay. Trên desktop (con trỏ chính xác, không giảm chuyển động) nút bị "hút" nhẹ về phía con trỏ.
 */
export function MagneticCta({ href, label, ring, external }: { href: string; label: string; ring: string; external?: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    const el = ref.current!
    const mq = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)')
    if (!mq.matches) return
    const R = 180
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const d = Math.hypot(dx, dy)
      if (d < R) {
        const k = 0.32 * (1 - d / R) + 0.12
        el.style.setProperty('--mx', `${(dx * k).toFixed(1)}px`)
        el.style.setProperty('--my', `${(dy * k).toFixed(1)}px`)
        el.dataset.near = 'true'
      } else if (el.dataset.near) {
        el.style.setProperty('--mx', '0px')
        el.style.setProperty('--my', '0px')
        delete el.dataset.near
      }
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  const text = `${ring} · `.repeat(3)
  return (
    <a ref={ref} className="magnetic" href={href} rel={external ? 'noopener' : undefined}>
      <svg className="magnetic__ring" viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <path id="cta-ring" d="M100,100 m-86,0 a86,86 0 1,1 172,0 a86,86 0 1,1 -172,0" />
        </defs>
        <text>
          <textPath href="#cta-ring" textLength="540">
            {text}
          </textPath>
        </text>
      </svg>
      <span className="magnetic__core">
        <span>{label}</span>
        <Arrow />
      </span>
    </a>
  )
}
