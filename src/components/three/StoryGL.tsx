'use client'

/**
 * Trải nghiệm 3D trên desktop. Chỉ được import động khi chế độ = '3d',
 * nên mobile / giảm chuyển động không bao giờ tải three.js, R3F hay GSAP.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame, type RootState } from '@react-three/fiber'
import Lenis from 'lenis'
import { bus } from '../webgl/bus'
import * as THREE from 'three'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { model, specs, parts, type AnchorId } from '@/content/product'
import { isDebug } from '@/lib/experience'
import SpeakerScene, { type FrameInfo } from './SpeakerScene'
import { buildStateTimeline, initialState, MARK } from './storyState'
import type { StageController } from './stageController'

gsap.registerPlugin(ScrollTrigger)
if (typeof window !== 'undefined') (window as unknown as { __threeLoaded: boolean }).__threeLoaded = true

/** Cột chú thích (tỷ lệ theo viewport) — khớp với .spec trong globals.css. */
const COLS = {
  left: { x0: 0.06, x1: 0.25, y0: 0.44, y1: 0.93 },
  right: { x0: 0.75, x1: 0.94, y0: 0.2, y1: 0.93 },
}
const LABEL_GAP = 14

/**
 * Vòng render thủ công (priority 1): cảnh loa phối cảnh trước, sau đó các lớp 2D dùng chung canvas
 * (gallery, wordmark footer). Một canvas, một bối cảnh ánh sáng cho toàn trang.
 */
function renderFrame({ gl, scene, camera, size, invalidate }: RootState, dt: number) {
  gl.autoClear = false
  gl.clear()
  gl.render(scene, camera)
  bus.time += dt
  let animating = false
  for (const layer of bus.layers) {
    gl.clearDepth()
    animating = layer.render(gl, size.width, size.height, dt) || animating
  }
  if (animating) invalidate()
}
function RenderLoop() {
  useFrame(renderFrame, 1)
  return null
}

type LabelBox = { el: HTMLElement; line: SVGGElement | null; anchor: AnchorId; side: 'left' | 'right'; w: number; h: number }

export default function StoryGL() {
  const stageRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const state = useMemo(() => initialState(), [])
  const invalidateRef = useRef<() => void>(() => {})
  const labelsRef = useRef<LabelBox[]>([])
  const partLinesRef = useRef<{ g: SVGGElement; anchor: AnchorId; text: HTMLElement }[]>([])
  const [ready, setReady] = useState(false)
  const [debug] = useState(isDebug)
  const debugRef = useRef<{ frame?: FrameInfo; fps?: number; dpr?: number }>({})
  const controllerRef = useRef<StageController | null>(null)
  // DPR thích ứng: tối đa 2; hạ xuống 1.5 khi FPS < 50 kéo dài 1 giây.
  const [dpr, setDpr] = useState(() => Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio, 2))
  const [hidden, setHidden] = useState(false)

  // Dừng hẳn vòng render khi tab bị ẩn.
  useEffect(() => {
    const onVis = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Parallax con trỏ (được damping trong StageController).
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      controllerRef.current?.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1)
      bus.pointer.x = e.clientX
      bus.pointer.y = e.clientY
      invalidateRef.current()
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  // Timeline cuộn.
  useEffect(() => {
    const stage = stageRef.current
    const story = stage?.closest<HTMLElement>('.story')
    if (!stage || !story) return
    document.documentElement.classList.add('is-3d-ready')

    // Cuộn mượt toàn trang (chỉ chế độ 3D): Lenis chạy trên ticker của GSAP để ScrollTrigger, canvas và DOM cùng nhịp.
    const lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 })
    lenis.on('scroll', () => {
      ScrollTrigger.update()
      bus.invalidate()
    })
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    bus.scrollTo = (target, opts) =>
      lenis.scrollTo(target, { immediate: !!opts?.immediate, duration: 1.8, easing: (t: number) => 1 - Math.pow(1 - t, 4) })

    const ctx = gsap.context(() => {
      const tl = buildStateTimeline(gsap, state)
      const q = (sel: string) => story.querySelector<HTMLElement>(sel)
      const text = (id: string) => q(`[data-chapter="${id}"] .chapter__text`)
      const OUT = { opacity: 0, y: -24, duration: 2.2, ease: 'power2.in' }
      /** Chữ vào theo từng cảnh: mỗi dòng tiêu đề trồi lên sau mặt nạ, phần còn lại hiện dần theo thứ tự. */
      const show = (el: HTMLElement | null, tIn: number, tOut?: number) => {
        if (!el) return
        tl.fromTo(el, { opacity: 0, y: 0 }, { opacity: 1, duration: 0.4 }, tIn)
        const lines = el.querySelectorAll('.line__inner')
        if (lines.length) tl.fromTo(lines, { yPercent: 140 }, { yPercent: 0, duration: 2.2, ease: 'power3.out', stagger: 0.3 }, tIn)
        const heading = el.querySelector('h1, h2, h3')
        const rest = [...el.children].filter((c) => c !== heading)
        tl.fromTo(rest, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1.8, ease: 'power2.out', stagger: 0.35 }, tIn + 0.6)
        if (tOut !== undefined) tl.to(el, OUT, tOut)
      }

      // Hero: hiện sẵn, mờ đi khi bắt đầu xoay.
      tl.to(story.querySelectorAll('[data-chapter="hero"] .chapter__text, .hero__scroll'), { ...OUT, stagger: 0.3 }, 5.5)
      show(text('back'), 12, 25)
      show(text('blueprint'), 34, 51)
      const specEls = gsap.utils.toArray<HTMLElement>('[data-spec]', story)
      specEls.forEach((el, i) => {
        const line = svgRef.current?.querySelector(`[data-line="${el.dataset.spec}"]`)
        tl.fromTo([el, line].filter(Boolean), { opacity: 0 }, { opacity: 1, duration: 1.6 }, 37 + i * 1.1)
        tl.to([el, line].filter(Boolean), { opacity: 0, duration: 1.6 }, 51.5)
      })
      const partTimes: Record<string, [number, number]> = { driver: [59, 67], pcb: [70, 78], enclosure: [81.5, 88] }
      for (const p of parts) {
        const [a, b] = partTimes[p.id]
        const line = svgRef.current?.querySelector(`[data-line="part-${p.id}"]`)
        show(text(p.id), a, b)
        if (line) {
          tl.fromTo(line, { opacity: 0 }, { opacity: 1, duration: 2 }, a + 1)
          tl.to(line, { opacity: 0, duration: 1.5 }, b)
        }
      }
      show(text('final'), MARK.final - 1.5)
      show(q('[data-chapter="final"] .final__cta'), MARK.final - 0.5)
      const cta = q('[data-chapter="final"] .cta-group')
      if (cta) tl.fromTo(cta, { autoAlpha: 0 }, { autoAlpha: 1, duration: 2 }, MARK.final)

      tl.eventCallback('onUpdate', () => invalidateRef.current())
      const st = ScrollTrigger.create({
        trigger: story,
        start: 'top top',
        end: 'bottom bottom',
        // Timeline bám thẳng vị trí cuộn (tất định); độ mượt do damping/spring trong cảnh 3D đảm nhiệm.
        scrub: true,
        animation: tl,
        refreshPriority: 2,
        onUpdate: (self) => updateProgress(self.progress),
        onRefresh: () => {
          measureLabels()
          invalidateRef.current()
        },
      })

      // Sau câu chuyện: loa "tan" xuống bằng mặt quét khi gallery tiến vào, rồi được "in" lại ở phần đặt hàng.
      const gallerySec = document.querySelector('.gallery')
      if (gallerySec)
        gsap.fromTo(
          state,
          { away: 0 },
          { away: 1, ease: 'none', scrollTrigger: { trigger: gallerySec, start: 'top bottom', end: 'top 25%', scrub: true, onUpdate: () => invalidateRef.current() } },
        )
      const buySec = document.querySelector('.buy__stage')
      if (buySec) {
        const btl = gsap.timeline({
          scrollTrigger: { trigger: buySec, start: 'top 80%', end: 'bottom top', scrub: true, onUpdate: () => invalidateRef.current() },
        })
        btl.fromTo(state, { buy: 0 }, { buy: 1, duration: 3, ease: 'none' }).to(state, { buy: 1, duration: 3 }).to(state, { buy: 0, duration: 2, ease: 'none' })
        // Hai nửa tên sản phẩm "mở" ra hai bên khi loa được in lại ở giữa.
        const wl = buySec.querySelector('.buy__word--l')
        const wr = buySec.querySelector('.buy__word--r')
        if (wl) btl.fromTo(wl, { xPercent: 35, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 3, ease: 'power2.out' }, 0)
        if (wr) btl.fromTo(wr, { xPercent: -35, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 3, ease: 'power2.out' }, 0)
      }

      // Thanh tiến độ chương (chỉ ghi DOM khi chương thay đổi).
      const bar = document.querySelector<HTMLElement>('.story-progress')
      const fill = bar?.querySelector<HTMLElement>('.story-progress__fill')
      const pct = bar?.querySelector<HTMLElement>('.story-progress__pct')
      const chapterStarts = [MARK.hero, 10, 27, 52, 88]
      let lastIdx = -1
      function updateProgress(p: number) {
        if (fill) fill.style.transform = `scaleX(${p.toFixed(4)})`
        if (pct) pct.textContent = String(Math.round(p * 100)).padStart(3, '0')
        const t = p * 100
        let idx = 0
        chapterStarts.forEach((c, i) => t >= c && (idx = i))
        if (bar && idx !== lastIdx) {
          lastIdx = idx
          bar.dataset.active = String(idx)
        }
      }
      updateProgress(st.progress)

      // Điều hướng neo (#thiet-ke ...) → cuộn đến đúng mốc của timeline.
      const markFor: Record<string, number> = {
        'gioi-thieu': MARK.hero,
        'thiet-ke': MARK.back,
        'thong-so': 40,
        'cau-tao': MARK.driver,
        'hoan-thien': MARK.end,
      }
      const scrollToMark = (id: string, smooth: boolean) => {
        const t = markFor[id]
        if (t === undefined) return false
        const y = st.start + ((st.end - st.start) * t) / tl.duration()
        bus.scrollTo(y, { immediate: !smooth })
        const heading = story.querySelector<HTMLElement>(`#${id} h1, #${id} h2, #${id} h3`)
        heading?.focus({ preventScroll: true })
        return true
      }
      const onClick = (e: MouseEvent) => {
        const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]')
        if (!a) return
        const id = a.getAttribute('href')!.slice(1)
        if (a.classList.contains('skip-link')) return
        if (scrollToMark(id, true)) {
          e.preventDefault()
          history.replaceState(null, '', `#${id}`)
          return
        }
        // Các neo còn lại (thư viện, đặt hàng, lên đầu trang): cuộn mượt bằng Lenis rồi chuyển focus.
        const target = document.getElementById(id)
        if (!target) return
        e.preventDefault()
        bus.scrollTo(target)
        history.replaceState(null, '', `#${id}`)
        target.querySelector<HTMLElement>('h1, h2, h3')?.focus({ preventScroll: true })
      }
      document.addEventListener('click', onClick)
      if (location.hash) requestAnimationFrame(() => scrollToMark(location.hash.slice(1), false))

      if (debug)
        Object.assign(window, {
          __story: {
            state,
            tl,
            st,
            debug: debugRef.current,
            render: () => controllerRef.current?.render,
            settled: () => !!controllerRef.current?.settled,
            controller: () => controllerRef.current,
          },
        })
      return () => document.removeEventListener('click', onClick)
    }, story)

    // Kích thước nhãn (không đổi khi cuộn) — đo lại khi resize.
    function measureLabels() {
      const svg = svgRef.current
      labelsRef.current = gsap.utils.toArray<HTMLElement>('[data-spec]', story).map((el) => ({
        el,
        line: svg?.querySelector<SVGGElement>(`[data-line="${el.dataset.spec}"]`) ?? null,
        anchor: el.dataset.anchor as AnchorId,
        side: el.dataset.side as 'left' | 'right',
        w: el.offsetWidth,
        h: el.offsetHeight,
      }))
      partLinesRef.current = parts
        .map((p) => ({
          g: svg?.querySelector<SVGGElement>(`[data-line="part-${p.id}"]`) as SVGGElement,
          anchor: p.anchor,
          text: story!.querySelector<HTMLElement>(`[data-chapter="${p.id}"] .chapter__text`) as HTMLElement,
        }))
        .filter((x) => x.g && x.text)
    }
    measureLabels()

    return () => {
      ctx.revert()
      gsap.ticker.remove(tick)
      lenis.destroy()
      document.documentElement.classList.remove('is-3d-ready')
    }
  }, [state, debug])

  // FPS (chỉ ở chế độ debug).
  useEffect(() => {
    if (!debug) return
    let frames = 0
    let last = performance.now()
    let raf = 0
    const el = document.createElement('output')
    el.className = 'fps-meter'
    document.body.appendChild(el)
    const loop = (t: number) => {
      frames++
      if (t - last >= 1000) {
        debugRef.current.fps = Math.round((frames * 1000) / (t - last))
        el.textContent = `${debugRef.current.fps} fps`
        frames = 0
        last = t
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      el.remove()
    }
  }, [debug])

  const onFrame = (info: FrameInfo) => {
    if (debug) debugRef.current.frame = info
    layoutCallouts(info)
  }

  function layoutCallouts(info: FrameInfo) {
    const { width: W, height: H, anchors } = info
    // Chú thích thông số (cảnh bản vẽ).
    if (state.lines > 0.05 && state.dims + state.grid > 0.05) {
      for (const side of ['left', 'right'] as const) {
        const col = COLS[side]
        const items = labelsRef.current.filter((l) => l.side === side).sort((a, b) => anchors[a.anchor].y - anchors[b.anchor].y)
        const minY = col.y0 * H
        const maxY = col.y1 * H
        const tops = items.map((l) => Math.min(Math.max(anchors[l.anchor].y - l.h / 2, minY), maxY - l.h))
        for (let i = 1; i < items.length; i++) tops[i] = Math.max(tops[i], tops[i - 1] + items[i - 1].h + LABEL_GAP)
        for (let i = items.length - 1; i >= 0; i--) {
          const limit = i === items.length - 1 ? maxY - items[i].h : tops[i + 1] - items[i].h - LABEL_GAP
          tops[i] = Math.min(tops[i], limit)
        }
        items.forEach((l, i) => {
          const x = side === 'left' ? col.x1 * W - l.w : col.x0 * W
          l.el.style.transform = `translate3d(${x.toFixed(1)}px, ${tops[i].toFixed(1)}px, 0)`
          if (!l.line) return
          const a = anchors[l.anchor]
          const ly = tops[i] + Math.min(l.h / 2, 18)
          const lx = side === 'left' ? col.x1 * W + 10 : col.x0 * W - 10
          const ex = lx + (side === 'left' ? 24 : -24)
          l.line.querySelector('polyline')!.setAttribute('points', `${lx},${ly} ${ex},${ly} ${a.x},${a.y}`)
          const c = l.line.querySelector('circle')!
          c.setAttribute('cx', String(a.x))
          c.setAttribute('cy', String(a.y))
        })
      }
    }
    // Đường dẫn từ khối chữ tới bộ phận đang giới thiệu (cảnh cấu tạo).
    if (state.explode > 0.05 || state.rShell < 0.95) {
      for (const p of partLinesRef.current) {
        const a = anchors[p.anchor]
        const heading = p.text.querySelector<HTMLElement>('h3') ?? p.text
        const x = p.text.offsetLeft + p.text.offsetWidth + 20
        const y = p.text.offsetTop + heading.offsetTop + heading.offsetHeight / 2
        p.g.querySelector('polyline')!.setAttribute('points', `${x},${y} ${x + 28},${y} ${a.x},${a.y}`)
        const c = p.g.querySelector('circle')!
        c.setAttribute('cx', String(a.x))
        c.setAttribute('cy', String(a.y))
      }
    }
  }

  return (
    <div ref={stageRef} className="story__stage" data-ready={ready || undefined}>
      {createPortal(
        <div className="webgl" data-ready={ready || undefined} aria-hidden="true">
          <Canvas
            frameloop={hidden ? 'never' : 'demand'}
            dpr={dpr}
            flat={false}
            gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
            camera={{ fov: 26, near: 0.1, far: 100, position: [0, 0, 10] }}
            onCreated={({ gl, invalidate }) => {
              // Đặt tường minh: sRGB + ACES (không dựa vào mặc định).
              gl.outputColorSpace = THREE.SRGBColorSpace
              gl.toneMapping = THREE.ACESFilmicToneMapping
              gl.toneMappingExposure = 1
              gl.setClearColor(0x0b0b0c, 1)
              invalidateRef.current = () => invalidate()
              bus.invalidate = () => invalidate()
            }}
          >
            <SpeakerScene
              state={state}
              modelUrl={model.url}
              onFrame={onFrame}
              measureModel={debug}
              onReady={(c) => {
                controllerRef.current = c
                setReady(true)
              }}
              onLowFps={() => {
                setDpr((d) => Math.min(d, 1.5))
                if (debug) debugRef.current.dpr = 1.5
              }}
            />
            <RenderLoop />
          </Canvas>
        </div>,
        document.body,
      )}
      <svg ref={svgRef} className="story__lines" aria-hidden="true">
        {specs.map((s) => (
          <g key={s.id} data-line={s.id} style={{ opacity: 0 }}>
            <polyline points="0,0 0,0" />
            <circle r="3.5" />
          </g>
        ))}
        {parts.map((p) => (
          <g key={p.id} data-line={`part-${p.id}`} style={{ opacity: 0 }}>
            <polyline points="0,0 0,0" />
            <circle r="3.5" />
          </g>
        ))}
      </svg>
    </div>
  )
}
