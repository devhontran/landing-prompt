/**
 * ĐẠO DIỄN CUỘN (chỉ chế độ 3D): Lenis (cuộn mượt) + GSAP ScrollTrigger + cảnh 3D kể chuyện.
 *
 * Cảnh 3D (StageController + storyState) là một câu chuyện liên tục trên timeline 0–100:
 *   hero (mặt trước) → quay ra mặt sau → bản vẽ kỹ thuật (nét tự vẽ, kích thước, lưới)
 *   → tách rời, soi lần lượt củ loa → bo mạch → vỏ loa → lắp lại → chân dung trên sàn phản chiếu.
 * Mỗi "sân khấu" DOM của layout (hero, khối tuyên ngôn, section cấu tạo ghim, khung phiên bản) giữ một đoạn timeline;
 * vị trí cuộn trong sân khấu → thời điểm timeline, khung hình (fx, fy, fw, fh) lấy từ hình chữ nhật DOM
 * → model luôn khớp bố cục và TRƯỢT giữa các vị trí khi chuyển section (damping trong StageController).
 * Trạng thái chỉ phụ thuộc vị trí cuộn → cuộn ngược cho kết quả y hệt.
 * Section không có 3D (thông số, vật liệu, …): model "tan" bằng mặt quét, canvas ẩn và ngừng vẽ.
 */
import * as THREE from 'three'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CustomEase } from 'gsap/CustomEase'
import Lenis from 'lenis'
import { callouts, type FinishKey } from '@/content/site'
import { clamp01 } from '@/lib/ease'
import { bus } from '../webgl/bus'
import { StageController, type FrameInfo } from './stageController'
import { buildStateTimeline, initialState } from './storyState'

gsap.registerPlugin(ScrollTrigger, CustomEase)
const EASE = CustomEase.create('likova', 'M0,0 C0.7,0 0.3,1 1,1')
const lerp = THREE.MathUtils.lerp
const PRELOAD_MIN = 2.5

export type StageKey = 'hero' | 'statement' | 'exploded' | 'finish'
type Frame = { fx: number; fy: number; fw: number; fh: number }
type Stage = {
  key: StageKey
  el: HTMLElement
  /** Tiến độ 0..1 trong sân khấu và khung hình theo hình chữ nhật DOM. */
  pose: (r: DOMRect, vw: number, vh: number) => { p: number; frame: Frame }
  /** Đoạn timeline câu chuyện mà sân khấu này giữ. */
  t: [number, number]
}

export class Director {
  ctl: StageController
  /** Trạng thái ĐÍCH (timeline + khung DOM); StageController đuổi theo bằng damping/spring. */
  state = initialState()
  /** Sân khấu đang giữ model (null = model tan đi). */
  shown: StageKey | null = null
  /** Thời điểm hiện tại trên timeline câu chuyện (0–100). */
  t = 0
  private tl: gsap.core.Timeline
  private lenis: Lenis
  private ctx: gsap.Context
  private stages: Stage[] = []
  private labels: {
    id: string
    anchor: (typeof callouts)[number]['anchor']
    at: readonly [number, number]
    el: HTMLElement
    line: SVGLineElement
  }[] = []
  private sticky: HTMLElement | null
  private html = document.documentElement
  private loaded: boolean
  private progress = 0
  private info: FrameInfo | null = null
  private cleanup: (() => void)[] = []

  constructor(
    public gl: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private invalidate: () => void,
    private canvasWrap: HTMLElement,
  ) {
    this.ctl = new StageController()
    scene.add(this.ctl.root)
    const detachEnv = this.ctl.attachEnvironment(gl, scene)
    this.cleanup.push(detachEnv)
    this.tl = buildStateTimeline(gsap, this.state)
    this.loaded = this.html.hasAttribute('data-loaded')
    const q = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s)

    // ---- Sân khấu ----
    const add = (key: StageKey, sel: string, t: [number, number], pose: Stage['pose']) => {
      const el = q(sel)
      if (el) this.stages.push({ key, el, t, pose })
    }
    const hero = q('.hero')
    const exploded = q('.exploded')
    this.sticky = q('.exploded__sticky')
    const through = (r: DOMRect, vh: number) => clamp01((vh - r.top) / (vh + r.height))
    // Hero: model ở phần ba bên trái (dưới tab), dolly-in và bắt đầu quay khi cuộn.
    add('hero', '.hero__sticky', [0, 12], (r, _vw, vh) => {
      const hr = hero!.getBoundingClientRect()
      const p = clamp01(-hr.top / Math.max(1, hr.height - vh))
      return { p, frame: { fx: lerp(0.3, 0.34, p), fy: 0.58 + r.top / vh, fw: 0.36, fh: lerp(0.62, 0.82, p) } }
    })
    // Tuyên ngôn: loa quay hẳn ra mặt sau (cổng thoát hơi, cổng kết nối) trong khung dưới câu tuyên ngôn.
    add('statement', '.statement__stage', [12, 26], (r, vw, vh) => ({
      p: through(r, vh),
      frame: {
        fx: (r.left + r.width / 2) / vw,
        fy: (r.top + r.height / 2) / vh,
        fw: Math.min(0.5, (r.width / vw) * 0.6),
        fh: (r.height / vh) * 0.95,
      },
    }))
    // Cấu tạo (ghim): bản vẽ kỹ thuật → tách rời, soi từng bộ phận → lắp lại.
    add('exploded', '.exploded__sticky', [26, 88], (r, _vw, vh) => {
      const er = exploded!.getBoundingClientRect()
      return { p: clamp01(-er.top / Math.max(1, er.height - vh)), frame: { fx: 0.53, fy: (r.top + vh * 0.56) / vh, fw: 0.4, fh: 0.7 } }
    })
    // Phiên bản: chân dung góc thấp trên sàn phản chiếu, màng loa "thở".
    add('finish', '.finish__stage', [88, 100], (r, vw, vh) => ({
      p: clamp01(through(r, vh) * 1.8),
      frame: {
        fx: (r.left + r.width / 2) / vw,
        fy: (r.top + r.height / 2) / vh,
        fw: (r.width / vw) * 0.7,
        fh: (Math.min(r.height, vh * 0.86) / vh) * 0.8,
      },
    }))
    for (const c of callouts) {
      const el = q(`[data-callout="${c.id}"]`)
      const line = q<SVGLineElement>(`[data-line="${c.id}"]`)
      if (el && line) this.labels.push({ id: c.id, anchor: c.anchor, at: c.at, el, line })
    }

    // ---- Cuộn mượt ----
    this.lenis = new Lenis({ autoRaf: false, anchors: true, lerp: 0.1 })
    const raf = (time: number) => this.lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)
    this.lenis.on('scroll', () => {
      ScrollTrigger.update()
      this.invalidate()
    })
    this.cleanup.push(() => gsap.ticker.remove(raf))
    bus.invalidate = invalidate
    bus.scrollTo = (target, opts) => this.lenis.scrollTo(target, { immediate: opts?.immediate })

    // ---- Phiên bản, con trỏ, resize ----
    const onFinish = (e: Event) => {
      this.ctl.setFinish((e as CustomEvent<FinishKey>).detail)
      this.invalidate()
    }
    window.addEventListener('speaker:finish', onFinish)
    this.cleanup.push(() => window.removeEventListener('speaker:finish', onFinish))
    // Parallax con trỏ rất nhẹ (±3°): gợi chiều sâu, camera vẫn do cuộn quyết định.
    const onMove = (e: PointerEvent) => {
      this.ctl.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1)
      if (this.shown) this.invalidate()
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    this.cleanup.push(() => window.removeEventListener('pointermove', onMove))
    const onResize = () => this.invalidate()
    window.addEventListener('resize', onResize)
    this.cleanup.push(() => window.removeEventListener('resize', onResize))

    // ---- ScrollTrigger (DOM) ----
    this.ctx = gsap.context(() => this.scrollEffects(hero))

    // ---- Preloader: intro của cảnh (nét tự vẽ → mặt quét "in" vật liệu) chạy trong lúc đếm ----
    if (this.loaded) {
      this.target()
      this.ctl.snap = true
      this.ctl.update(this.state, camera, gl, window.innerWidth, window.innerHeight, 0)
      this.ctl.snap = false
    } else {
      this.lenis.stop()
      Object.assign(this.state, { fx: 0.66, fy: 0.44, fw: 0.34, fh: 0.5 })
      this.html.dataset.scene = 'ready'
      const done = () => (this.progress = 1)
      gl.compileAsync(this.ctl.root, camera, scene).then(done, done)
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

  /** Sân khấu gần tâm màn hình nhất → thời điểm timeline + khung; quá xa mọi sân khấu → model tan đi. */
  private target() {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const mid = vh / 2
    let best: Stage | null = null
    let bestD = Infinity
    let bestR: DOMRect | null = null
    for (const st of this.stages) {
      const r = st.el.getBoundingClientRect()
      const d = r.top > mid ? r.top - mid : r.bottom < mid ? mid - r.bottom : 0
      if (d < bestD) {
        best = st
        bestD = d
        bestR = r
      }
    }
    if (!best || !bestR) return
    const { p, frame } = best.pose(bestR, vw, vh)
    this.t = lerp(best.t[0], best.t[1], p)
    this.tl.time(this.t)
    Object.assign(this.state, frame)
    const away = bestD > vh * 0.55
    this.state.away = away ? 1 : 0
    this.shown = away ? null : best.key
  }

  /** Gọi mỗi frame trước khi vẽ. */
  frame(dt: number) {
    const ctl = this.ctl
    // Khi panel đang thu về tab, model đã trượt sang vị trí hero (damping).
    if (!this.loaded) this.preloader()
    if (this.loaded || this.html.dataset.leaving) this.target()
    const W = window.innerWidth
    const H = window.innerHeight
    let moving = ctl.update(this.state, this.camera, this.gl, W, H, dt)
    this.info = ctl.project(this.camera, W, H, false)
    if (this.loaded) this.updateCallouts()
    // Canvas ẩn (và ngừng vẽ) khi model đã tan hẳn.
    const vis = !(this.state.away === 1 && ctl.render.away > 0.995)
    this.canvasWrap.style.visibility = vis ? 'visible' : 'hidden'
    if (!this.loaded || !ctl.settled) moving = true
    // Khi đã ẩn: vẽ nốt cho tới lúc damping hội tụ (trạng thái tất định), sau đó dừng hẳn.
    if (moving && (vis || !ctl.settled)) this.invalidate()
  }

  private preloader() {
    // Tính từ lúc bắt đầu tải trang → preloader tổng cộng ~2.5s.
    const elapsed = performance.now() / 1000
    // Đếm theo thời gian, dừng ở 90% cho tới khi shader biên dịch xong.
    const shown = Math.min(elapsed / PRELOAD_MIN, this.progress === 1 ? 1 : 0.9)
    const count = document.querySelector('.preloader__count')
    if (count) count.textContent = `${String(Math.round(shown * 100)).padStart(3, '0')}%`
    // Rời preloader khi đủ thời gian VÀ intro của model (nét tự vẽ → quét vật liệu) đã xong.
    if (shown >= 1 && this.ctl.settled && !this.html.dataset.leaving) this.leavePreloader()
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

  /** Chú thích: nhãn ở cột phải, xếp theo độ cao điểm neo; vạch 1px nối từ điểm neo tới nhãn. Hiện theo đoạn timeline. */
  private updateCallouts() {
    if (!this.sticky || !this.labels.length || !this.info) return
    const on = this.shown === 'exploded' && this.ctl.render.away < 0.05
    const sr = this.sticky.getBoundingClientRect()
    const labelW = this.labels[0].el.offsetWidth || 240
    const lx = sr.width - 20 - labelW
    const t = this.t
    const items = this.labels.map((c) => {
      const a = this.info!.anchors[c.anchor]
      const [t0, t1] = c.at
      const o = on ? Math.min(clamp01((t - t0) / 1.5), clamp01((t1 - t) / 1.5)) : 0
      return { c, ax: a.x - sr.left, ay: a.y - sr.top, y: 0, o }
    })
    const vis = items.filter((i) => i.o > 0).sort((a, b) => a.ay - b.ay)
    let prev = -Infinity
    for (const it of vis) {
      it.y = Math.max(it.ay, prev + 44, 140)
      prev = it.y
    }
    for (const it of items) {
      const { el, line } = it.c
      el.style.opacity = String(it.o)
      line.style.opacity = String(it.o)
      if (it.o <= 0) continue
      el.style.transform = `translate3d(${lx}px, ${it.y - 12}px, 0)`
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

  /** Kiểm thử: cảnh đã đứng yên (damping/spring hội tụ, intro xong)? */
  settled() {
    return this.loaded && this.ctl.settled
  }

  /** Kiểm thử: khung bao model trên màn hình (px), null khi model đã tan. */
  modelRect() {
    if (!this.shown) return null
    return this.ctl.project(this.camera, window.innerWidth, window.innerHeight, true).modelRect
  }

  dispose() {
    this.ctx.revert()
    this.lenis.destroy()
    this.cleanup.forEach((f) => f())
    this.scene.remove(this.ctl.root)
    this.ctl.dispose()
    delete this.html.dataset.scene
    delete this.html.dataset.tab
  }
}
