'use client'

import { getImageProps } from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { galleryImages } from '@/content/media'
import { useExperienceMode } from '../StoryStage'
import { COPIES, STEP } from './layout'

/** Quãng trượt ngang (đơn vị chiều cao vùng xem) khi cuộn qua section được ghim. */
const TRAVEL = 2.2

const items = galleryImages.map((g) => ({
  ...g,
  img: getImageProps({ src: g.src, alt: g.alt, sizes: '(min-width: 1024px) 40vw, 80vw', quality: 80, loading: 'lazy' }).props,
}))

/**
 * Gallery góc nhìn sản phẩm.
 * - Desktop 3D: grid ngẫu hứng lặp vô hạn, kéo bằng chuột (có quán tính), shader phản hồi theo vận tốc kéo.
 * - Mobile / giảm chuyển động: dải cuộn ngang gốc của trình duyệt (scroll-snap), không hiệu ứng.
 * Luôn có nút Trước/Sau và phím mũi tên cho bàn phím.
 */
export function Gallery() {
  const mode = useExperienceMode()
  const gl = mode === '3d'
  const viewportRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const tilesRef = useRef<HTMLLIElement[]>([])
  const engine = useRef({ nudge: (d: number) => void d })
  const [glFailed, setGlFailed] = useState(false)

  const step = useCallback(
    (dir: 1 | -1) => {
      if (gl) {
        engine.current.nudge(-dir * STEP)
        return
      }
      const vp = viewportRef.current
      if (!vp) return
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      vp.scrollBy({ left: dir * vp.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' })
    },
    [gl],
  )

  useEffect(() => {
    if (!gl) return
    const vp = viewportRef.current!
    const section = vp.closest<HTMLElement>('.gallery')!
    const tiles = tilesRef.current.slice(0, items.length * COPIES)
    const firstImgs = tiles.slice(0, items.length).map((li) => li.querySelector('img')!)
    let disposed = false
    let cleanup: (() => void) | null = null

    // Bắt đầu tải ảnh khi section sắp vào màn hình.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        firstImgs.forEach((img) => (img.loading = 'eager'))
        io.disconnect()
      },
      { rootMargin: '100% 0px' },
    )
    io.observe(section)

    Promise.all([import('./galleryGL'), import('gsap'), import('gsap/ScrollTrigger'), import('../webgl/bus')])
      .then(([{ GalleryLayer }, { gsap }, { ScrollTrigger }, { bus, addLayer }]) => {
        if (disposed) return
        gsap.registerPlugin(ScrollTrigger)
        const layer = new GalleryLayer(vp, tiles, firstImgs)
        layer.pointer = bus.pointer
        layer.onTexturesReady = () => {
          vp.dataset.glReady = 'true'
          bus.invalidate()
        }
        const removeLayer = addLayer(layer)
        engine.current.nudge = (d: number) => {
          layer.target += d
          bus.invalidate()
        }

        // Ghim section: cuộn dọc đẩy ảnh trượt ngang; tiêu đề trôi chậm hơn (parallax). Ô hiện bằng mặt quét khi section tiến vào.
        const heading = section.querySelector('.gallery__head .t-display')
        const trig: { pin?: { progress: number }; reveal?: { progress: number } } = {}
        const ctx = gsap.context(() => {
          trig.pin = ScrollTrigger.create({
            trigger: section,
            start: 'top top',
            end: '+=160%',
            pin: true,
            scrub: true,
            refreshPriority: 1,
            onUpdate: (st) => {
              layer.scroll = -st.progress * TRAVEL
              bus.invalidate()
            },
          })
          trig.reveal = ScrollTrigger.create({
            trigger: section,
            start: 'top 85%',
            end: 'top 5%',
            scrub: true,
            onUpdate: (st) => {
              layer.reveal = st.progress
              bus.invalidate()
            },
          })
          if (heading)
            gsap.fromTo(heading, { xPercent: 0 }, { xPercent: -10, ease: 'none', scrollTrigger: { trigger: section, start: 'top top', end: '+=160%', scrub: true } })
        })
        ScrollTrigger.refresh()
        layer.scroll = -(trig.pin?.progress ?? 0) * TRAVEL
        layer.current = layer.scroll
        layer.reveal = trig.reveal?.progress ?? 0

        // Kéo bằng chuột, có quán tính khi thả.
        const dragging = { on: false, x: 0, t: 0, v: 0, id: -1 }
        const onDown = (ev: PointerEvent) => {
          if (ev.button !== 0) return
          dragging.on = true
          dragging.x = ev.clientX
          dragging.t = ev.timeStamp
          dragging.v = 0
          dragging.id = ev.pointerId
          vp.setPointerCapture(ev.pointerId)
          vp.dataset.dragging = 'true'
        }
        const onMove = (ev: PointerEvent) => {
          if (!dragging.on || ev.pointerId !== dragging.id) return
          const H = vp.clientHeight
          const dx = ev.clientX - dragging.x
          const dt = Math.max(1, ev.timeStamp - dragging.t) / 1000
          dragging.v = dragging.v * 0.6 + (dx / H / dt) * 0.4
          dragging.x = ev.clientX
          dragging.t = ev.timeStamp
          layer.target += dx / H
          bus.invalidate()
        }
        const onUp = (ev: PointerEvent) => {
          if (!dragging.on || ev.pointerId !== dragging.id) return
          dragging.on = false
          delete vp.dataset.dragging
          if (ev.timeStamp - dragging.t < 80) layer.target += Math.max(-2, Math.min(2, dragging.v * 0.3))
          bus.invalidate()
        }
        vp.addEventListener('pointerdown', onDown)
        vp.addEventListener('pointermove', onMove)
        vp.addEventListener('pointerup', onUp)
        vp.addEventListener('pointercancel', onUp)
        const ro = new ResizeObserver(() => {
          layer.layout()
          bus.invalidate()
        })
        ro.observe(vp)
        if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __gallery: layer })

        cleanup = () => {
          ctx.revert()
          removeLayer()
          layer.dispose()
          ro.disconnect()
          vp.removeEventListener('pointerdown', onDown)
          vp.removeEventListener('pointermove', onMove)
          vp.removeEventListener('pointerup', onUp)
          vp.removeEventListener('pointercancel', onUp)
          delete vp.dataset.glReady
        }
      })
      .catch(() => setGlFailed(true))

    return () => {
      disposed = true
      io.disconnect()
      cleanup?.()
    }
  }, [gl])

  // Con trỏ "Kéo": bám theo chuột bằng lerp, chỉ chạy vòng rAF khi đang hover.
  useEffect(() => {
    if (!gl) return
    const vp = viewportRef.current!
    const cur = cursorRef.current!
    const p = { x: 0, y: 0, tx: 0, ty: 0 }
    let raf = 0
    const loop = () => {
      p.x += (p.tx - p.x) * 0.2
      p.y += (p.ty - p.y) * 0.2
      cur.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`
      raf = Math.abs(p.tx - p.x) + Math.abs(p.ty - p.y) > 0.3 ? requestAnimationFrame(loop) : 0
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const r = vp.getBoundingClientRect()
      p.tx = e.clientX - r.left
      p.ty = e.clientY - r.top
      if (!vp.dataset.cursor) {
        p.x = p.tx
        p.y = p.ty
        vp.dataset.cursor = 'true'
      }
      if (!raf) raf = requestAnimationFrame(loop)
    }
    const onLeave = () => delete vp.dataset.cursor
    vp.addEventListener('pointermove', onMove)
    vp.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      vp.removeEventListener('pointermove', onMove)
      vp.removeEventListener('pointerleave', onLeave)
    }
  }, [gl])

  const onKeyDown = (ev: React.KeyboardEvent) => {
    if (ev.key === 'ArrowRight') {
      ev.preventDefault()
      step(1)
    } else if (ev.key === 'ArrowLeft') {
      ev.preventDefault()
      step(-1)
    }
  }

  const copies = gl ? COPIES : 1
  return (
    <>
      <div className="gallery__controls">
        <p className="gallery__hint" id="gallery-hint">
          {gl ? 'Kéo để xem tiếp · phím ← →' : 'Vuốt ngang để xem tiếp'}
        </p>
        <div className="gallery__buttons">
          <button type="button" className="icon-button" onClick={() => step(-1)} aria-label="Ảnh trước">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <button type="button" className="icon-button" onClick={() => step(1)} aria-label="Ảnh tiếp theo">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
      <div
        ref={viewportRef}
        className={`gallery__viewport${gl ? ' is-gl' : ''}${glFailed ? ' gl-failed' : ''}`}
        tabIndex={0}
        role="region"
        aria-roledescription="thư viện ảnh"
        aria-label="Các góc nhìn sản phẩm"
        aria-describedby="gallery-hint"
        onKeyDown={onKeyDown}
      >
        {gl && (
          <div ref={cursorRef} className="drag-cursor" aria-hidden="true">
            Kéo
          </div>
        )}
        <ul className="gallery__track">
          {Array.from({ length: copies }, (_, c) =>
            items.map((it, i) => {
              const k = c * items.length + i
              const dup = c > 0
              return (
                <li
                  key={k}
                  className="tile"
                  aria-hidden={dup || undefined}
                  ref={(el) => {
                    if (el) tilesRef.current[k] = el
                  }}
                >
                  <figure>
                    {!dup && (
                      // Ảnh đã được tối ưu qua getImageProps; cần thẻ <img> thật để làm nguồn texture WebGL.
                      // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                      <img {...it.img} draggable={false} />
                    )}
                    <figcaption>
                      <span className="tile__index">{String(i + 1).padStart(2, '0')}</span> {it.caption}
                      {it.placeholder && !dup && <span className="badge">Placeholder</span>}
                    </figcaption>
                  </figure>
                </li>
              )
            }),
          )}
        </ul>
      </div>
    </>
  )
}
