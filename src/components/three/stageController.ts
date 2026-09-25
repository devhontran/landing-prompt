/**
 * Điều khiển cảnh 3D theo kiểu imperative (đúng pattern của R3F): mọi thay đổi trên object three.js
 * nằm ở đây, component React chỉ gọi `update()` trong useFrame.
 *
 * - `target` (từ timeline cuộn) → `render` bằng damping mũ (lerp theo thời gian) hoặc spring (explode).
 * - Không cấp phát object trong vòng render: mọi Vector/Color tạm được tạo sẵn.
 */
import * as THREE from 'three'
import type { AnchorId } from '@/content/product'
import { buildProceduralSpeaker, type SpeakerBuild } from './proceduralSpeaker'
import { PartRig } from './partRig'
import { createAtmosphere, createBackdrop, createReflectiveFloor, createStudioEnvironment } from './effects'
import { initialState, type StoryState } from './storyState'

export type AnchorScreen = Record<AnchorId, { x: number; y: number; visible: boolean }>
export type FrameInfo = {
  anchors: AnchorScreen
  width: number
  height: number
  /** Khung bao thực tế của model trên màn hình (px CSS) – dùng cho kiểm tra chồng lấn. */
  modelRect: { left: number; top: number; right: number; bottom: number } | null
  /** Thống kê của frame trước (debug). */
  drawCalls?: number
  triangles?: number
}

type Key = keyof StoryState
const KEYS = Object.keys(initialState()) as Key[]
/** Tốc độ đuổi theo (1/s): camera chậm và điện ảnh, vật liệu/nét nhanh hơn. */
const LAMBDA: Partial<Record<Key, number>> = {
  rotY: 3.2, pitch: 3.2, focusX: 3.2, focusY: 3.2, focusZ: 3.2, radius: 3.2, fx: 3.2, fy: 3.2, fw: 3.2, fh: 3.2,
}
const DEFAULT_LAMBDA = 6
/** Spring cho exploded: hơi thiếu cản (ζ≈0.7) → các khối tách ra có chút nảy cơ khí. */
const SPRING = { k: 70, c: 11.5 }
const INTRO_SECONDS = 2.6

const v = new THREE.Vector3()
const tmp = new THREE.Vector3()
const focusW = new THREE.Vector3()
const euler = new THREE.Euler()

export class StageController {
  readonly speaker: SpeakerBuild
  readonly root = new THREE.Group()
  /** Trạng thái đang hiển thị (đã damping). */
  readonly render: StoryState = initialState()
  private explodeVel = 0
  private pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  private rigs: Record<'driver' | 'pcb' | 'shell' | 'back', PartRig>
  private explodables: { obj: THREE.Object3D; base: THREE.Vector3; dir: THREE.Vector3 }[] = []
  private floor: ReturnType<typeof createReflectiveFloor>
  private backdrop = createBackdrop()
  private atmosphere = createAtmosphere()
  private shared = { uPulse: { value: 0 }, uPulseCenter: { value: new THREE.Vector3(0, -0.2, 0) } }
  private time = 0
  private intro = 0
  private ownsSpeaker: boolean
  /** true: bỏ qua damping và intro (dùng cho trang chụp ảnh tĩnh). */
  snap = false
  settled = false
  /** Debug/quay video: bước thời gian cố định thay cho delta thật. */
  fixedDelta: number | null = null

  constructor(external?: SpeakerBuild | null) {
    performance.mark('stage:build-start')
    this.ownsSpeaker = !external
    this.speaker = external ?? buildProceduralSpeaker()
    const p = this.speaker.parts
    this.rigs = {
      driver: PartRig.of(p.driver, this.shared),
      pcb: PartRig.of(p.pcb, this.shared),
      shell: PartRig.of(p.enclosure, this.shared),
      back: PartRig.of(p.backPanel, this.shared),
    }
    this.speaker.root.traverse((o) => {
      const e = o.userData.explode
      if (e) this.explodables.push({ obj: o, base: o.position.clone(), dir: Array.isArray(e) ? new THREE.Vector3(...e) : (e as THREE.Vector3).clone() })
    })
    // Sàn & bóng tiếp xúc theo hộp bao thật của model (đúng cho cả .glb).
    const box = new THREE.Box3()
    Object.values(p).forEach((part) => box.expandByObject(part))
    const size = box.getSize(new THREE.Vector3())
    this.floor = createReflectiveFloor({ w: size.x * 0.84, d: size.z * 0.84 })
    this.floor.mesh.position.y = box.min.y
    // Một đèn chính trùng hướng softbox để tạo khối rõ; phần còn lại do môi trường studio đảm nhiệm.
    const key = new THREE.DirectionalLight(0xfff4e6, 1.1)
    key.position.set(-3, 5, 3.5)
    this.root.add(this.backdrop.mesh, this.speaker.root, this.floor.mesh, this.atmosphere.group, key)
    performance.measure('stage:build', 'stage:build-start')
  }

  /** Môi trường studio → PMREM 128 px (một lần). */
  attachEnvironment(gl: THREE.WebGLRenderer, scene: THREE.Scene) {
    performance.mark('stage:env-start')
    const pmrem = new THREE.PMREMGenerator(gl)
    const studio = createStudioEnvironment()
    const env = pmrem.fromScene(studio.scene, 0, 0.1, 100, { size: 128 }).texture
    studio.dispose()
    scene.environment = env
    scene.environmentIntensity = 1
    pmrem.dispose()
    performance.measure('stage:env', 'stage:env-start')
    return () => {
      env.dispose()
      scene.environment = null
    }
  }

  /** Con trỏ chuẩn hoá -1..1 (parallax nhẹ: gợi chiều sâu, mời khám phá). */
  setPointer(x: number, y: number) {
    this.pointer.tx = x
    this.pointer.ty = y
  }

  /** Áp trạng thái vào cảnh. Trả về true nếu cần vẽ tiếp frame sau. */
  update(target: StoryState, cam: THREE.PerspectiveCamera, gl: THREE.WebGLRenderer, W: number, H: number, delta: number) {
    const dt = this.fixedDelta ?? Math.min(delta, 1 / 20)
    const s = this.render
    this.time += dt
    let moving = false
    if (this.snap) {
      Object.assign(s, target)
      this.intro = 1
    } else {
      for (const k of KEYS) {
        if (k === 'explode') continue
        const lambda = LAMBDA[k] ?? DEFAULT_LAMBDA
        s[k] = THREE.MathUtils.damp(s[k], target[k], lambda, dt)
        if (Math.abs(s[k] - target[k]) > 1e-3) moving = true
        else s[k] = target[k]
      }
      // Spring (bán ẩn Euler, 2 bước con cho ổn định).
      for (let i = 0; i < 2; i++) {
        const h = dt / 2
        this.explodeVel += (SPRING.k * (target.explode - s.explode) - SPRING.c * this.explodeVel) * h
        s.explode += this.explodeVel * h
      }
      if (Math.abs(s.explode - target.explode) > 1e-3 || Math.abs(this.explodeVel) > 1e-3) moving = true
      else {
        s.explode = target.explode
        this.explodeVel = 0
      }
      this.intro = Math.min(1, this.intro + dt / INTRO_SECONDS)
      const pt = this.pointer
      pt.x = THREE.MathUtils.damp(pt.x, pt.tx, 2.5, dt)
      pt.y = THREE.MathUtils.damp(pt.y, pt.ty, 2.5, dt)
      if (Math.abs(pt.x - pt.tx) + Math.abs(pt.y - pt.ty) > 1e-3) moving = true
    }
    this.settled = !moving && this.intro >= 1

    // --- Intro: nét tự vẽ rồi mặt quét đi lên "in" vật liệu ---
    const intro = this.intro
    const drawIntro = THREE.MathUtils.smootherstep(intro, 0, 0.4)
    const scanIntro = THREE.MathUtils.smootherstep(intro, 0.3, 1)
    const introOn = intro < 1
    const lines = introOn ? 1 : s.lines
    const draw = Math.min(introOn ? 1 : s.draw, drawIntro)

    // --- Model ---
    const { speaker, rigs } = this
    speaker.root.rotation.y = s.rotY
    for (const e of this.explodables) e.obj.position.copy(e.base).addScaledVector(e.dir, s.explode)
    rigs.driver.set(Math.min(s.rDriver, scanIntro), lines, draw)
    rigs.pcb.set(Math.min(s.rPcb, scanIntro), lines, draw)
    rigs.shell.set(Math.min(s.rShell, scanIntro), lines, draw)
    rigs.back.set(Math.min(s.rBack, scanIntro), lines, draw)
    const dimMat = speaker.dims.material as THREE.ShaderMaterial
    dimMat.uniforms.uOpacity.value = s.dims > 0.001 ? 0.9 : 0
    dimMat.uniforms.uDraw.value = s.dims
    dimMat.uniforms.uCut.value = -10
    speaker.dims.visible = s.dims > 0.002

    // --- Sàn, rung màng loa, không khí ---
    const dpr = gl.getPixelRatio()
    const floorOn = s.floor > 0.002
    this.floor.mesh.visible = floorOn
    const fu = this.floor.material.uniforms
    fu.uOpacity.value = s.floor
    fu.uTime.value = this.time
    fu.uPulse.value = s.pulse
    // Màng loa chuyển động cùng pha với gợn sóng tại tâm (ph = -t·2.6).
    this.shared.uPulse.value = s.pulse * Math.sin(-this.time * 2.6)
    if (floorOn) this.floor.mesh.getRenderTarget().setSize(Math.round((W * dpr) / 2), Math.round((H * dpr) / 2))
    this.atmosphere.set(s.dust, this.time, dpr)

    // --- Camera: khối cầu bao (radius) vừa vùng khung, dịch bằng view offset; parallax con trỏ ---
    const halfFov = THREE.MathUtils.degToRad(cam.fov / 2)
    const t = Math.min(Math.tan(halfFov) * s.fh, Math.tan(halfFov) * (W / H) * s.fw)
    const dist = (s.radius * Math.sqrt(1 + t * t)) / t
    focusW.set(s.focusX, s.focusY, s.focusZ).applyEuler(euler.set(0, s.rotY, 0))
    const yaw = this.pointer.x * 0.06
    const pitch = s.pitch + this.pointer.y * 0.035
    cam.position.set(
      focusW.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      focusW.y + Math.sin(pitch) * dist,
      focusW.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    )
    cam.lookAt(focusW)
    cam.near = Math.max(0.1, dist - 7)
    cam.far = dist + 12
    cam.setViewOffset(W, H, (0.5 - s.fx) * W, (0.5 - s.fy) * H, W, H)
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
    speaker.root.updateMatrixWorld(true)

    // --- Nền ---
    const bu = this.backdrop.material.uniforms
    bu.uRes.value.set(W * dpr, H * dpr)
    bu.uDpr.value = dpr
    bu.uCenter.value.set(s.fx, 1 - s.fy)
    bu.uWarmth.value = s.warmth
    bu.uGrid.value = s.grid

    return moving || introOn || floorOn || s.dust > 0.002
  }

  /** Chiếu các neo chú thích (và khung bao model nếu cần) ra tọa độ màn hình. */
  project(cam: THREE.PerspectiveCamera, W: number, H: number, measureModel: boolean): FrameInfo {
    const anchors = {} as AnchorScreen
    for (const [id, obj] of Object.entries(this.speaker.anchors) as [AnchorId, THREE.Object3D][]) {
      obj.getWorldPosition(v).project(cam)
      anchors[id] = { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, visible: v.z < 1 }
    }
    let modelRect: FrameInfo['modelRect'] = null
    if (measureModel) {
      let l = Infinity, top = Infinity, r = -Infinity, b = -Infinity
      for (const rig of Object.values(this.rigs)) {
        if (!rig.shown) continue
        for (const { mesh, points } of rig.samples) {
          for (const p of points) {
            tmp.copy(p).applyMatrix4(mesh.matrixWorld).project(cam)
            const x = (tmp.x * 0.5 + 0.5) * W
            const y = (-tmp.y * 0.5 + 0.5) * H
            l = Math.min(l, x)
            r = Math.max(r, x)
            top = Math.min(top, y)
            b = Math.max(b, y)
          }
        }
      }
      modelRect = Number.isFinite(l) ? { left: l, top, right: r, bottom: b } : null
    }
    return { anchors, width: W, height: H, modelRect }
  }

  dispose() {
    Object.values(this.rigs).forEach((r) => r.dispose())
    if (this.ownsSpeaker) this.speaker.dispose()
    this.floor.mesh.dispose()
    this.floor.mesh.geometry.dispose()
    this.backdrop.material.dispose()
    this.backdrop.mesh.geometry.dispose()
    this.atmosphere.dispose()
  }
}

