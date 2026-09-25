'use client'

import { useEffect } from 'react'

/**
 * Hiện nội dung khi cuộn tới: `[data-reveal]` → .is-in (dòng chữ trượt lên khỏi mặt nạ, stagger 0.1s),
 * `.reveal` → .is-visible (fade). Chỉ bắt đầu sau preloader. Đã hiện thì giữ nguyên (cuộn ngược không nháy).
 */
export function RevealObserver() {
  useEffect(() => {
    const html = document.documentElement
    let io: IntersectionObserver | null = null
    const start = () => {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue
            e.target.classList.add(e.target.hasAttribute('data-reveal') ? 'is-in' : 'is-visible')
            io!.unobserve(e.target)
          }
        },
        { rootMargin: '0px 0px -8% 0px' },
      )
      document.querySelectorAll('[data-reveal], .reveal').forEach((el) => io!.observe(el))
    }
    if (html.hasAttribute('data-loaded')) {
      start()
      return () => io?.disconnect()
    }
    const mo = new MutationObserver(() => {
      if (!html.hasAttribute('data-loaded')) return
      mo.disconnect()
      start()
    })
    mo.observe(html, { attributes: true, attributeFilter: ['data-loaded'] })
    return () => {
      mo.disconnect()
      io?.disconnect()
    }
  }, [])
  return null
}
