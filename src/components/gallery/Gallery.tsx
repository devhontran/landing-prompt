'use client'

import { getImageProps } from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { galleryImages } from '@/content/media'
import { useExperienceMode } from '../StoryStage'
import { COPIES, PATTERN, STEP, wrapX } from './layout'

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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tilesRef = useRef<HTMLLIElement[]>([])
  const engine = useRef({ target: 0, current: 0, nudge: (d: number) => void d })
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
    const canvas = canvasRef.current!
    const tiles = tilesRef.current.slice(0, items.length * COPIES)
    const firstImgs = tiles.slice(0, items.length).map((li) => li.querySelector('img')!)
    let H = 1
    let raf = 0
    let running = false
    let visible = false
    let last = 0
    let prev = 0
    let vel = 0
    let disposed = false
    let glLayer: import('./galleryGL').GalleryGL | null = null
    const e = engine.current
    const dragging = { on: false, x: 0, t: 0, v: 0, id: -1, moved: 0 }

    const layout = () => {
      H = vp.clientHeight
      tiles.forEach((li, k) => {
        const s = PATTERN[k % PATTERN.length]
        li.style.width = `${s.w * H}px`
        li.style.height = `${s.h * H}px`
      })
      glLayer?.resize(vp.clientWidth, H)
    }

    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - (last || t)) / 1000) || 1 / 60
      last = t
      e.current += (e.target - e.current) * (1 - Math.exp(-dt * 10))
      const inst = (e.current - prev) / dt
      prev = e.current
      vel += (inst - vel) * 0.2
      const rects = tiles.map((li, k) => {
        const s = PATTERN[k % PATTERN.length]
        const x = wrapX(s.x, Math.floor(k / PATTERN.length), e.current) * H
        const y = s.y * H
        li.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
        return { x, y, w: s.w * H, h: s.h * H, imageIndex: k % items.length }
      })
      const shaderVel = Math.max(-1, Math.min(1, vel * 0.45))
      glLayer?.render(rects, shaderVel)
      const settled = !dragging.on && Math.abs(e.target - e.current) < 1e-4 && Math.abs(vel) < 0.002
      if (settled || !visible) {
        running = false
        last = 0
        vel = 0
        glLayer?.render(rects, 0)
        return
      }
      raf = requestAnimationFrame(frame)
    }
    const kick = () => {
      if (running || !visible) return
      running = true
      raf = requestAnimationFrame(frame)
    }
    e.nudge = (d: number) => {
      e.target += d
      kick()
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        if (visible) {
          firstImgs.forEach((img) => (img.loading = 'eager'))
          kick()
        }
      },
      { rootMargin: '400px 0px' },
    )
    io.observe(vp)

    import('./galleryGL')
      .then(({ GalleryGL }) => {
        if (disposed) return
        try {
          glLayer = new GalleryGL(canvas, firstImgs, tiles.length)
          layout()
          glLayer.loadTextures(() => {
            vp.dataset.glReady = 'true'
            kick()
            if (!running) frame(performance.now())
          })
        } catch {
          setGlFailed(true)
        }
      })
      .catch(() => setGlFailed(true))

    const onDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return
      dragging.on = true
      dragging.x = ev.clientX
      dragging.t = ev.timeStamp
      dragging.v = 0
      dragging.moved = 0
      dragging.id = ev.pointerId
      vp.setPointerCapture(ev.pointerId)
      vp.dataset.dragging = 'true'
      kick()
    }
    const onMove = (ev: PointerEvent) => {
      if (!dragging.on || ev.pointerId !== dragging.id) return
      const dx = ev.clientX - dragging.x
      const dt = Math.max(1, ev.timeStamp - dragging.t) / 1000
      dragging.v = dragging.v * 0.6 + (dx / H / dt) * 0.4
      dragging.x = ev.clientX
      dragging.t = ev.timeStamp
      dragging.moved += Math.abs(dx)
      e.target += dx / H
      kick()
    }
    const onUp = (ev: PointerEvent) => {
      if (!dragging.on || ev.pointerId !== dragging.id) return
      dragging.on = false
      delete vp.dataset.dragging
      // Quán tính: tiếp tục trượt theo vận tốc lúc thả.
      if (ev.timeStamp - dragging.t < 80) e.target += Math.max(-2, Math.min(2, dragging.v * 0.3))
      kick()
    }
    vp.addEventListener('pointerdown', onDown)
    vp.addEventListener('pointermove', onMove)
    vp.addEventListener('pointerup', onUp)
    vp.addEventListener('pointercancel', onUp)
    const ro = new ResizeObserver(() => {
      layout()
      frame(performance.now())
    })
    ro.observe(vp)
    layout()
    frame(performance.now())

    if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __gallery: e })

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      vp.removeEventListener('pointerdown', onDown)
      vp.removeEventListener('pointermove', onMove)
      vp.removeEventListener('pointerup', onUp)
      vp.removeEventListener('pointercancel', onUp)
      glLayer?.dispose()
      tiles.forEach((li) => {
        li.style.transform = ''
        li.style.width = ''
        li.style.height = ''
      })
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
          {gl ? 'Kéo để xem tiếp — hoặc dùng phím ← →.' : 'Vuốt ngang để xem tiếp.'}
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
        {gl && <canvas ref={canvasRef} className="gallery__canvas" aria-hidden="true" />}
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
