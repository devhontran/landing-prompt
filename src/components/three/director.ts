/**
 * ĐẠO DIỄN CUỘN (chỉ chế độ 3D): Lenis (cuộn mượt) + GSAP ScrollTrigger + cảnh three.js.
 * - Mỗi frame: đọc vị trí các "sân khấu" DOM → chọn cảnh + pose → rig nội suy → cập nhật chú thích exploded.
 *   Trạng thái chỉ phụ thuộc vị trí cuộn (cuộn ngược cho kết quả y hệt).
 * - ScrollTrigger (scrub): tab hero thu vào logo nav, vạch thông số chạy trái → phải, parallax phòng nghe.
 * - Preloader ~2.5s: model xoay + bộ đếm 0→100%, panel trắng thu về đúng vị trí tab hero.
 * Mọi tween dùng một easing: cubic-bezier(0.7, 0, 0.3, 1).
 */
import * as THREE from 'three'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CustomEase } from 'gsap/CustomEase'
import Lenis from 'lenis'
import { layers, type FinishKey, type LayerPart } from '@/content/site'
import { clamp01 } from '@/lib/ease'
import { bus } from '../webgl/bus'
import { Rig, type Pose, type StageKey } from './rig'

gsap.registerPlugin(ScrollTrigger, CustomEase)
const EASE = CustomEase.create('likova', 'M0,0 C0.7,0 0.3,1 1,1')
const lerp = THREE.MathUtils.lerp
const PRELOAD_MIN = 2.5

type Stage = { key: StageKey; el: HTMLElement; pose: (r: DOMRect, vw: number, vh: number) => Pose }

export class Director {
  rig: Rig
  private lenis: Lenis
  private ctx: gsap.Context
  private stages: Stage[] = []
  private callouts: { part: LayerPart; label: HTMLElement; line: SVGLineElement }[] = []
  private sticky: HTMLElement | null
  private html = document.documentElement
  private loaded: boolean
  private progress = 0
  private v = new THREE.Vector3()
  private cleanup: (() => void)[] = []

  constructor(
    public gl: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    private invalidate: () => void,
    private canvasWrap: HTMLElement,
  ) {
    this.rig = new Rig(gl, scene, camera)
    this.loaded = this.html.hasAttribute('data-loaded')
    const q = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s)

    // ---- Sân khấu ----
    const add = (key: StageKey, sel: string, pose: Stage['pose']) => {
      const el = q(sel)
      if (el) this.stages.push({ key, el, pose })
    }
    const hero = q('.hero')
    add('hero', '.hero__sticky', (r, _vw, vh) => {
      const hr = hero!.getBoundingClientRect()
      const p = clamp01(-hr.top / Math.max(1, hr.height - vh))
      // Dolly-in: model lớn dần, xoay dần về chính diện. r.top < 0 khi sticky đã nhả → model trôi lên cùng trang.
      return {
        cx: lerp(0.3, 0.36, p),
        cy: lerp(0.57, 0.64, p) + Math.min(0, r.top) / vh,
        hf: lerp(0.66, 0.98, p),
        rotY: lerp(-0.6, -0.12, p),
        rotX: lerp(0.02, 0.1, p),
        explode: 0,
      }
    })
    add('statement', '.statement__stage', (r, vw, vh) => {
      const p = clamp01((vh - r.top) / (vh + r.height))
      return {
        cx: (r.left + r.width / 2) / vw,
        cy: (r.top + r.height / 2) / vh,
        hf: (r.height / vh) * 0.95,
        rotY: lerp(-0.95, 0.95, p),
        rotX: lerp(0.12, -0.12, p),
        explode: 0,
      }
    })
    const exploded = q('.exploded')
    this.sticky = q('.exploded__sticky')
    add('exploded', '.exploded__sticky', (r, vw, vh) => {
      const er = exploded!.getBoundingClientRect()
      const p = clamp01(-er.top / Math.max(1, er.height - vh))
      return {
        cx: 0.58,
        cy: (r.top + vh * 0.56) / vh,
        hf: 0.58,
        rotY: lerp(-0.9, -0.66, p),
        rotX: 0.05,
        explode: clamp01((p - 0.04) / 0.82),
      }
    })
    add('finish', '.finish__stage', (r, vw, vh) => {
      const p = clamp01((vh - r.top) / (vh + r.height))
      const h = Math.min(r.height, vh * 0.86)
      return {
        cx: (r.left + r.width / 2) / vw,
        cy: (r.top + r.height / 2) / vh,
        hf: (h / vh) * 0.92,
        rotY: lerp(-0.75, 0.25, p),
        rotX: 0.04,
        explode: 0,
      }
    })
    for (const l of layers) {
      const label = q(`[data-callout="${l.part}"]`)
      const line = q<SVGLineElement>(`[data-line="${l.part}"]`)
      if (label && line) this.callouts.push({ part: l.part, label, line })
    }

    // ---- Cuộn mượt ----
    this.lenis = new Lenis({ autoRaf: false, anchors: true, lerp: 0.1 })
    const raf = (t: number) => this.lenis.raf(t * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)
    this.lenis.on('scroll', () => {
      ScrollTrigger.update()
      this.invalidate()
    })
    this.cleanup.push(() => gsap.ticker.remove(raf))
    bus.invalidate = invalidate
    bus.scrollTo = (target, opts) => this.lenis.scrollTo(target, { immediate: opts?.immediate })

    // ---- Phiên bản ----
    const onFinish = (e: Event) => {
      this.rig.setFinish((e as CustomEvent<FinishKey>).detail)
      this.invalidate()
    }
    window.addEventListener('speaker:finish', onFinish)
    this.cleanup.push(() => window.removeEventListener('speaker:finish', onFinish))
    const onResize = () => this.invalidate()
    window.addEventListener('resize', onResize)
    this.cleanup.push(() => window.removeEventListener('resize', onResize))

    // ---- ScrollTrigger ----
    this.ctx = gsap.context(() => this.scrollEffects(hero))

    // ---- Preloader ----
    if (this.loaded) {
      this.rig.want(this.pick())
      this.rig.snap()
    } else {
      this.lenis.stop()
      this.rig.want('preload', { cx: 0.68, cy: 0.44, hf: 0.6, rotY: -0.5, rotX: 0.06, explode: 0 })
      this.html.dataset.scene = 'ready'
      // Biên dịch shader trước để frame đầu không khựng.
      const done = () => (this.progress = 1)
      gl.compileAsync(scene, camera).then(done, done)
    }
    this.html.dataset.tab = 'hero'
  }

  private scrollEffects(hero: HTMLElement | null) {
    const tab = hero?.querySelector<HTMLElement>('.hero__tab')
    const wm = tab?.querySelector<HTMLElement>('.wordmark')
    const logo = document.querySelector<HTMLElement>('.nav__logo')
    if (hero && tab && wm && logo) {
      // Tab trắng thu nhỏ, bay vào vị trí logo trên nav (FLIP tính lại khi đổi kích thước).
      const s = () => parseFloat(getComputedStyle(logo).fontSize) / parseFloat(getComputedStyle(wm).fontSize)
      const navH = () => (logo.offsetParent ? (logo.offsetParent as HTMLElement).offsetHeight : 50)
      gsap.set(tab, { transformOrigin: '0 0' })
      gsap
        .timeline({
          scrollTrigger: {
            trigger: hero,
            start: 'top top',
            end: () => `+=${window.innerHeight * 0.55}`,
            scrub: true,
            invalidateOnRefresh: true,
            onUpdate: (st) => (this.html.dataset.tab = st.progress > 0.9 ? 'docked' : 'hero'),
          },
        })
        .to(tab, {
          scale: s,
          x: () => logo.getBoundingClientRect().left - wm.offsetLeft * s(),
          y: () => logo.getBoundingClientRect().top - navH() - wm.offsetTop * s(),
          ease: EASE,
          duration: 1,
        })
        .to(tab, { opacity: 0, ease: EASE, duration: 0.2 }, 0.8)
    }
    // Vạch thông số chạy trái → phải theo cuộn.
    gsap.utils.toArray<HTMLElement>('.spec-row').forEach((row) => {
      gsap.fromTo(
        row.querySelector('.spec-row__line'),
        { scaleX: 0 },
        { scaleX: 1, ease: EASE, scrollTrigger: { trigger: row, start: 'top 85%', end: 'top top', scrub: true } },
      )
    })
    // Parallax phòng nghe.
    const room = document.querySelector<HTMLElement>('.room__frame[data-parallax]')
    if (room) {
      gsap.fromTo(
        room.querySelector('.media'),
        { yPercent: -7 },
        { yPercent: 7, ease: 'none', scrollTrigger: { trigger: room, start: 'top bottom', end: 'bottom top', scrub: true } },
      )
    }
  }

  /** Cảnh cần hiển thị = sân khấu chiếm nhiều nhất dải giữa màn hình (30%–70%). */
  private pick(): StageKey | null {
    const vw = window.innerWidth
    const vh = window.innerHeight
    let best: Stage | null = null
    let bestOverlap = 0
    let bestRect: DOMRect | null = null
    for (const st of this.stages) {
      const r = st.el.getBoundingClientRect()
      const overlap = Math.min(r.bottom, vh * 0.7) - Math.max(r.top, vh * 0.3)
      if (overlap > bestOverlap) {
        best = st
        bestOverlap = overlap
        bestRect = r
      }
    }
    if (best && bestRect) Object.assign(this.rig.target, best.pose(bestRect, vw, vh))
    return best?.key ?? null
  }

  /** Gọi mỗi frame trước khi vẽ. */
  frame(dt: number) {
    const rig = this.rig
    if (!this.loaded) this.preloader()
    else rig.want(this.pick())
    // Cảnh đang hiển thị khác cảnh mục tiêu: vẫn cập nhật pose cho cảnh đang hiển thị để nó bám DOM khi quét ẩn.
    let moving = rig.update(dt)
    if (this.loaded) this.updateCallouts()
    const vis = rig.visible
    this.canvasWrap.style.visibility = vis ? 'visible' : 'hidden'
    if (!this.loaded) moving = true
    if (moving) this.invalidate()
  }

  private preloader() {
    // Tính từ lúc bắt đầu tải trang → preloader tổng cộng ~2.5s.
    const elapsed = performance.now() / 1000
    // Đếm theo thời gian, dừng ở 90% cho tới khi shader biên dịch xong.
    const shown = Math.min(elapsed / PRELOAD_MIN, this.progress === 1 ? 1 : 0.9)
    const count = document.querySelector('.preloader__count')
    if (count) count.textContent = `${String(Math.round(shown * 100)).padStart(3, '0')}%`
    if (shown >= 1 && !this.html.dataset.leaving) this.leavePreloader()
  }

  /** Panel trắng thu về đúng vị trí tab hero, nền navy tan ra, model trượt về vị trí hero. */
  private leavePreloader() {
    this.html.dataset.leaving = 'true'
    const panel = document.querySelector<HTMLElement>('.preloader__panel')
    const bg = document.querySelector<HTMLElement>('.preloader__bg')
    const tab = document.querySelector<HTMLElement>('.hero__tab')
    const finish = () => {
      this.loaded = true
      this.html.dataset.loaded = 'true'
      delete this.html.dataset.leaving
      this.lenis.start()
      ScrollTrigger.refresh()
      this.invalidate()
    }
    // Model chuyển sang pose hero ngay (damp mượt, không cần quét).
    const heroStage = this.stages.find((s) => s.key === 'hero')
    if (heroStage && window.scrollY < 10) {
      Object.assign(this.rig.target, heroStage.pose(heroStage.el.getBoundingClientRect(), window.innerWidth, window.innerHeight))
      this.rig.shown = this.rig.wanted = 'hero'
    }
    if (!panel || !tab || window.scrollY > 10) return finish()
    // Chỉ dùng transform + clip-path (không đổi layout → không CLS): panel trượt tới tab, cắt còn cao bằng tab,
    // góc khuyết khép lại; wordmark trượt lên giữa tab.
    const t = tab.getBoundingClientRect()
    const p = panel.getBoundingClientRect()
    const wm = panel.querySelector('.wordmark')
    const W = t.width
    const H = t.height
    const n = 60
    gsap.set(panel, {
      clipPath: `polygon(0px 0px, ${p.width - n}px 0px, ${p.width - n}px ${n}px, ${p.width}px ${n}px, ${p.width}px ${p.height}px, 0px ${p.height}px)`,
    })
    gsap
      .timeline({ onComplete: finish })
      .to('.preloader__count', { opacity: 0, duration: 0.5, ease: EASE })
      .to(
        panel,
        {
          x: t.left - p.left,
          y: t.top - p.top,
          clipPath: `polygon(0px 0px, ${W}px 0px, ${W}px 0px, ${W}px 0px, ${W}px ${H}px, 0px ${H}px)`,
          duration: 1,
          ease: EASE,
        },
        0,
      )
      .to(wm, { y: (H - p.height) / 2, duration: 1, ease: EASE }, 0)
      .to(bg, { opacity: 0, duration: 1, ease: EASE }, 0.2)
  }

  /** Chú thích exploded: nhãn ở cột phải, xếp theo độ cao của bộ phận; vạch 1px nối từ bộ phận tới nhãn. */
  private updateCallouts() {
    if (!this.sticky || !this.callouts.length) return
    const rig = this.rig
    const active = rig.shown === 'exploded' && rig.reveal > 0.95
    const sr = this.sticky.getBoundingClientRect()
    const W = sr.width
    const vh = window.innerHeight
    const labelW = this.callouts[0].label.offsetWidth || 240
    const lx = W - 20 - labelW
    const items = this.callouts.map((c) => {
      rig.tower.anchorWorld(c.part, this.v).project(rig.camera)
      const ax = (this.v.x * 0.5 + 0.5) * window.innerWidth - sr.left
      const ay = (-this.v.y * 0.5 + 0.5) * vh - sr.top
      return { c, ax, ay, y: ay, o: active ? clamp01(rig.step(c.part) * 1.6 - 0.1) : 0 }
    })
    // Tránh chồng nhãn: sắp theo y, giãn tối thiểu 44px.
    const sorted = [...items].sort((a, b) => a.ay - b.ay)
    let prev = -Infinity
    for (const it of sorted) {
      it.y = Math.max(it.ay, prev + 44, 140)
      prev = it.y
    }
    for (const it of items) {
      const { label, line } = it.c
      label.style.opacity = String(it.o)
      label.style.transform = `translate3d(${lx}px, ${it.y - 12}px, 0)`
      line.style.opacity = String(it.o)
      line.setAttribute('x1', it.ax.toFixed(1))
      line.setAttribute('y1', it.ay.toFixed(1))
      line.setAttribute('x2', (lx - 8).toFixed(1))
      line.setAttribute('y2', it.y.toFixed(1))
    }
  }

  /** Kiểm thử: cuộn tức thì. */
  scrollTo(y: number) {
    this.lenis.scrollTo(y, { immediate: true, force: true })
  }

  /** Kiểm thử: đã đứng yên (cảnh đúng, quét xong, damping hội tụ)? */
  settled() {
    const r = this.rig
    return this.loaded && r.shown === r.wanted && (r.shown === null || r.reveal >= 1) && !r.update(0)
  }

  /** Kiểm thử: hình chữ nhật (px) bao model trên màn hình, null nếu đang ẩn. */
  modelRect() {
    const r = this.rig
    if (!r.visible) return null
    const box = new THREE.Box3().setFromObject(r.tower.root)
    const W = window.innerWidth
    const H = window.innerHeight
    let [l, t, rr, b] = [Infinity, Infinity, -Infinity, -Infinity]
    for (let i = 0; i < 8; i++) {
      this.v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(r.camera)
      const x = (this.v.x * 0.5 + 0.5) * W
      const y = (-this.v.y * 0.5 + 0.5) * H
      l = Math.min(l, x)
      rr = Math.max(rr, x)
      t = Math.min(t, y)
      b = Math.max(b, y)
    }
    return { left: l, top: t, right: rr, bottom: b }
  }

  dispose() {
    this.ctx.revert()
    this.lenis.destroy()
    this.cleanup.forEach((f) => f())
    this.rig.dispose()
    delete this.html.dataset.scene
    delete this.html.dataset.tab
  }
}
