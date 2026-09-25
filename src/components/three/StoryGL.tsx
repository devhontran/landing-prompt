'use client'

/**
 * Trải nghiệm 3D trên desktop. Chỉ được import động khi chế độ = '3d',
 * nên mobile / giảm chuyển động không bao giờ tải three.js, R3F hay GSAP.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { model, specs, parts, type AnchorId } from '@/content/product'
import { isDebug } from '@/lib/experience'
import SpeakerScene, { type FrameInfo } from './SpeakerScene'
import { buildStateTimeline, initialState, MARK } from './storyState'
import { loadGlbSpeaker } from './loadGlb'
import type { SpeakerBuild } from './proceduralSpeaker'

gsap.registerPlugin(ScrollTrigger)
if (typeof window !== 'undefined') (window as unknown as { __threeLoaded: boolean }).__threeLoaded = true

/** Cột chú thích (tỷ lệ theo viewport) — khớp với .spec trong globals.css. */
const COLS = {
  left: { x0: 0.06, x1: 0.25, y0: 0.44, y1: 0.93 },
  right: { x0: 0.75, x1: 0.94, y0: 0.2, y1: 0.93 },
}
const LABEL_GAP = 14

type LabelBox = { el: HTMLElement; line: SVGGElement | null; anchor: AnchorId; side: 'left' | 'right'; w: number; h: number }

export default function StoryGL() {
  const stageRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const state = useMemo(() => initialState(), [])
  const invalidateRef = useRef<() => void>(() => {})
  const activeRef = useRef(true)
  const labelsRef = useRef<LabelBox[]>([])
  const partLinesRef = useRef<{ g: SVGGElement; anchor: AnchorId; text: HTMLElement }[]>([])
  const [ready, setReady] = useState(false)
  const [build, setBuild] = useState<SpeakerBuild | null>(null)
  const [debug] = useState(isDebug)
  const debugRef = useRef<{ frame?: FrameInfo; fps?: number }>({})

  // Model thật (nếu đã cấu hình); lỗi → giữ model placeholder và báo trên console.
  useEffect(() => {
    if (!model.url) return
    let alive = true
    loadGlbSpeaker(model.url)
      .then((b) => alive && setBuild(b))
      .catch((e) => console.error('[speaker] Không nạp được model, dùng placeholder.', e))
    return () => {
      alive = false
    }
  }, [])

  // Timeline cuộn.
  useEffect(() => {
    const stage = stageRef.current
    const story = stage?.closest<HTMLElement>('.story')
    if (!stage || !story) return
    document.documentElement.classList.add('is-3d-ready')

    const ctx = gsap.context(() => {
      const tl = buildStateTimeline(gsap, state)
      const q = (sel: string) => story.querySelector<HTMLElement>(sel)
      const text = (id: string) => q(`[data-chapter="${id}"] .chapter__text`)
      const IN = { opacity: 1, y: 0, duration: 2.2, ease: 'power2.out' }
      const OUT = { opacity: 0, y: -20, duration: 2.2, ease: 'power2.in' }
      const show = (el: Element | null, tIn: number, tOut?: number) => {
        if (!el) return
        tl.fromTo(el, { opacity: 0, y: 20 }, IN, tIn)
        if (tOut !== undefined) tl.to(el, OUT, tOut)
      }

      // Hero: hiện sẵn, mờ đi khi bắt đầu xoay.
      tl.to(text('hero'), { ...OUT }, 6.5)
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
      show(text('final'), MARK.final - 1)
      const cta = q('[data-chapter="final"] .cta-group')
      if (cta) tl.fromTo(cta, { autoAlpha: 0 }, { autoAlpha: 1, duration: 2 }, MARK.final)

      tl.eventCallback('onUpdate', () => invalidateRef.current())
      const st = ScrollTrigger.create({
        trigger: story,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.6,
        animation: tl,
        onToggle: (self) => {
          activeRef.current = self.isActive
          invalidateRef.current()
        },
        onRefresh: () => {
          measureLabels()
          invalidateRef.current()
        },
      })
      activeRef.current = st.isActive || st.progress === 0

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
        window.scrollTo({ top: y, behavior: smooth ? 'smooth' : 'auto' })
        const heading = story.querySelector<HTMLElement>(`#${id} h1, #${id} h2, #${id} h3`)
        heading?.focus({ preventScroll: true })
        return true
      }
      const onClick = (e: MouseEvent) => {
        const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]')
        if (!a) return
        const id = a.getAttribute('href')!.slice(1)
        if (scrollToMark(id, true)) {
          e.preventDefault()
          history.replaceState(null, '', `#${id}`)
        }
      }
      document.addEventListener('click', onClick)
      if (location.hash) requestAnimationFrame(() => scrollToMark(location.hash.slice(1), false))

      if (debug) Object.assign(window, { __story: { state, tl, st, debug: debugRef.current } })
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
    if (state.explode > 0.05 || state.sShell < 0.95) {
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
      <div className="story__canvas">
        <Canvas
          frameloop="demand"
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          camera={{ fov: 26, near: 0.1, far: 100, position: [0, 0, 10] }}
          onCreated={({ invalidate }) => {
            invalidateRef.current = () => invalidate()
          }}
          aria-hidden="true"
        >
          <SpeakerScene
            state={state}
            build={build}
            onFrame={onFrame}
            measureModel={debug}
            isActive={() => activeRef.current}
            onReady={() => setReady(true)}
          />
        </Canvas>
      </div>
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
