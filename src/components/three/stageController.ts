/**
 * Điều khiển cảnh 3D theo kiểu imperative (đúng pattern của R3F): mọi thay đổi trên object three.js
 * nằm ở đây, component React chỉ gọi `update()` trong useFrame.
 *
 * - `target` (từ timeline cuộn) → `render` bằng damping mũ (lerp theo thời gian) hoặc spring (explode).
 * - Không cấp phát object trong vòng render: mọi Vector/Color tạm được tạo sẵn.
 */
import * as THREE from 'three'
import type { AnchorId, FinishKey } from '@/content/site'
import { walnutMap } from './textures'
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
  rotY: 3.2,
  pitch: 3.2,
  focusX: 3.2,
  focusY: 3.2,
  focusZ: 3.2,
  radius: 3.2,
  fx: 3.2,
  fy: 3.2,
  fw: 3.2,
  fh: 3.2,
}
const DEFAULT_LAMBDA = 6
/** Spring cho exploded: hơi thiếu cản (ζ≈0.7) → các khối tách ra có chút nảy cơ khí. */
const SPRING = { k: 70, c: 11.5 }
const INTRO_SECONDS = 2
/** Tư thế loa ở phần đặt hàng: chính giữa, giữa hai khối chữ lớn. */
const BUY_POSE = { fx: 0.5, fy: 0.47, fw: 0.3, fh: 0.62, radius: 1.85, pitch: 0.12, focusY: -0.12 }

const FINISH: Record<FinishKey, { color: THREE.Color; metal: number; rough: number; coat: number }> = {
  graphite: { color: new THREE.Color(0x202228), metal: 0.2, rough: 0.5, coat: 0.2 },
  silver: { color: new THREE.Color(0xd4d7dc), metal: 0.3, rough: 0.34, coat: 0.3 },
  walnut: { color: new THREE.Color(0xffffff), metal: 0, rough: 0.55, coat: 0.5 },
}
const FINISH_KEYS = Object.keys(FINISH) as FinishKey[]

const tmpColor = new THREE.Color()
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
  /** Góc xoay bàn xoay ở phần đặt hàng (chỉ cộng dồn khi đang ở đó). */
  private spin = 0
  private ownsSpeaker: boolean
  private uWood = { value: 0 }
  private shellMats: THREE.MeshPhysicalMaterial[] = []
  private finishTex: THREE.Texture | null = null
  private finish = {
    cur: { graphite: 1, silver: 0, walnut: 0 } as Record<FinishKey, number>,
    target: { graphite: 1, silver: 0, walnut: 0 } as Record<FinishKey, number>,
  }
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
      if (e)
        this.explodables.push({
          obj: o,
          base: o.position.clone(),
          dir: Array.isArray(e) ? new THREE.Vector3(...e) : (e as THREE.Vector3).clone(),
        })
    })
    // Sàn & bóng tiếp xúc theo hộp bao thật của model (đúng cho cả .glb).
    const box = new THREE.Box3()
    Object.values(p).forEach((part) => box.expandByObject(part))
    const size = box.getSize(new THREE.Vector3())
    this.floor = createReflectiveFloor({ w: size.x * 0.84, d: size.z * 0.84 })
    this.floor.mesh.position.y = box.min.y
    // Key ấm trên-phải (trùng softbox), rim lạnh thấp phía sau; phần còn lại do môi trường studio tối đảm nhiệm.
    const key = new THREE.DirectionalLight(0xffe2bd, 1.1)
    key.position.set(3, 5, 3.5)
    const rim = new THREE.DirectionalLight(0x9fb3ff, 1.8)
    rim.position.set(-4, -1.5, -3)
    this.root.add(this.backdrop.mesh, this.speaker.root, this.floor.mesh, this.atmosphere.group, key, rim)
    this.setupFinish()
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
    scene.environmentIntensity = 0.55
    pmrem.dispose()
    performance.measure('stage:env', 'stage:env-start')
    return () => {
      env.dispose()
      scene.environment = null
    }
  }

  /** Vật liệu vỏ theo phiên bản: màu/kim loại/độ nhám nội suy, vân gỗ trộn bằng uniform (không biên dịch lại shader). */
  private setupFinish() {
    const wood = walnutMap()
    this.finishTex = wood
    const shells: THREE.MeshPhysicalMaterial[] = []
    this.speaker.root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && /_shell$/.test(m.name)) shells.push(m.material as THREE.MeshPhysicalMaterial)
    })
    for (const mat of shells) {
      const prev = mat.onBeforeCompile
      const prevKey = mat.customProgramCacheKey.bind(mat)
      mat.map = wood
      mat.onBeforeCompile = (sh, r) => {
        prev.call(mat, sh, r)
        sh.uniforms.uWood = this.uWood
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uWood;')
          .replace('#include <map_fragment>', 'diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(map, vMapUv).rgb, uWood);')
      }
      mat.customProgramCacheKey = () => prevKey() + '|finish'
      mat.needsUpdate = true
    }
    this.shellMats = shells
    this.applyFinish()
  }

  private applyFinish() {
    const w = this.finish.cur
    const F = FINISH
    for (const mat of this.shellMats) {
      mat.color.setRGB(0, 0, 0)
      for (const k of FINISH_KEYS) mat.color.add(tmpColor.copy(F[k].color).multiplyScalar(w[k]))
      mat.metalness = FINISH_KEYS.reduce((a, k) => a + F[k].metal * w[k], 0)
      mat.roughness = FINISH_KEYS.reduce((a, k) => a + F[k].rough * w[k], 0)
      mat.clearcoat = FINISH_KEYS.reduce((a, k) => a + F[k].coat * w[k], 0)
    }
    this.uWood.value = w.walnut
  }

  /** Chọn phiên bản → crossfade ~0.5s. */
  setFinish(key: FinishKey) {
    for (const k of FINISH_KEYS) this.finish.target[k] = k === key ? 1 : 0
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
    // Phiên bản vỏ: damp ~0.5s.
    let fm = false
    for (const k of FINISH_KEYS) {
      const c = this.finish.cur
      c[k] = this.snap ? this.finish.target[k] : THREE.MathUtils.damp(c[k], this.finish.target[k], 7, dt)
      if (Math.abs(c[k] - this.finish.target[k]) > 1e-3) fm = true
      else c[k] = this.finish.target[k]
    }
    this.applyFinish()
    if (fm) moving = true
    this.settled = !moving && this.intro >= 1

    // --- Intro: nét tự vẽ rồi mặt quét đi lên "in" vật liệu ---
    const intro = this.intro
    const drawIntro = THREE.MathUtils.smootherstep(intro, 0, 0.4)
    const scanIntro = THREE.MathUtils.smootherstep(intro, 0.3, 1)
    const introOn = intro < 1

    // --- Sau câu chuyện: tan đi (away) khi vào gallery, trở lại ở phần đặt hàng (buy) ---
    const L = THREE.MathUtils.lerp
    const away = s.away
    const buyW = THREE.MathUtils.smootherstep(s.buy, 0, 1)
    if (buyW > 0.001) this.spin += dt * 0.2 * buyW
    const shown = Math.max(1 - away, buyW)
    const reveal = (r: number) => Math.max(Math.min(r, scanIntro, 1 - away), Math.min(buyW, scanIntro))
    const lines = (introOn ? 1 : s.lines) * (1 - away)
    const draw = Math.min(introOn ? 1 : s.draw, drawIntro)
    const rotY = s.rotY + this.spin * buyW
    const B = BUY_POSE
    const fx = L(s.fx, B.fx, buyW)
    const fy = L(s.fy, B.fy, buyW)
    const fw = L(s.fw, B.fw, buyW)
    const fh = L(s.fh, B.fh, buyW)
    const radius = L(s.radius, B.radius, buyW)
    const pitch0 = L(s.pitch, B.pitch, buyW)
    const floor = Math.max(s.floor * (1 - away), buyW)
    const dust = Math.max(s.dust * (1 - away), buyW * 0.7)
    const pulse = Math.max(s.pulse * (1 - away), buyW)

    // --- Model ---
    const { speaker, rigs } = this
    speaker.root.visible = shown > 0.001 || lines > 0.001
    speaker.root.rotation.y = rotY
    const explode = s.explode * (1 - buyW)
    for (const e of this.explodables) e.obj.position.copy(e.base).addScaledVector(e.dir, explode)
    rigs.driver.set(reveal(s.rDriver), lines, draw)
    rigs.pcb.set(reveal(s.rPcb), lines, draw)
    rigs.shell.set(reveal(s.rShell), lines, draw)
    rigs.back.set(reveal(s.rBack), lines, draw)
    const dimMat = speaker.dims.material as THREE.ShaderMaterial
    const dims = s.dims * (1 - away)
    dimMat.uniforms.uOpacity.value = dims > 0.001 ? 0.9 : 0
    dimMat.uniforms.uDraw.value = dims
    dimMat.uniforms.uCut.value = -10
    speaker.dims.visible = dims > 0.002

    // --- Sàn, rung màng loa, không khí ---
    const dpr = gl.getPixelRatio()
    const floorOn = floor > 0.002
    this.floor.mesh.visible = floorOn
    const fu = this.floor.material.uniforms
    fu.uOpacity.value = floor
    fu.uTime.value = this.time
    fu.uPulse.value = pulse
    // Màng loa chuyển động cùng pha với gợn sóng tại tâm (ph = -t·2.6).
    this.shared.uPulse.value = pulse * Math.sin(-this.time * 2.6)
    if (floorOn) this.floor.mesh.getRenderTarget().setSize(Math.round((W * dpr) / 2), Math.round((H * dpr) / 2))
    this.atmosphere.set(dust, this.time, dpr)

    // --- Camera: khối cầu bao (radius) vừa vùng khung, dịch bằng view offset; parallax con trỏ ---
    const halfFov = THREE.MathUtils.degToRad(cam.fov / 2)
    const t = Math.min(Math.tan(halfFov) * fh, Math.tan(halfFov) * (W / H) * fw)
    const dist = (radius * Math.sqrt(1 + t * t)) / t
    focusW.set(L(s.focusX, 0, buyW), L(s.focusY, B.focusY, buyW), L(s.focusZ, 0, buyW)).applyEuler(euler.set(0, rotY, 0))
    const yaw = this.pointer.x * 0.06
    const pitch = pitch0 + this.pointer.y * 0.035
    cam.position.set(
      focusW.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      focusW.y + Math.sin(pitch) * dist,
      focusW.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    )
    cam.lookAt(focusW)
    cam.near = Math.max(0.1, dist - 7)
    cam.far = dist + 12
    cam.setViewOffset(W, H, (0.5 - fx) * W, (0.5 - fy) * H, W, H)
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
    speaker.root.updateMatrixWorld(true)

    // --- Nền: dùng chung cho toàn trang; quầng sáng mờ đi ở gallery, sáng lại ở phần đặt hàng ---
    const bu = this.backdrop.material.uniforms
    bu.uRes.value.set(W * dpr, H * dpr)
    bu.uDpr.value = dpr
    bu.uGrid.value = s.grid * (1 - away)

    return moving || introOn || (shown > 0.01 && (floorOn || dust > 0.002 || buyW > 0.001))
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
      let l = Infinity,
        top = Infinity,
        r = -Infinity,
        b = -Infinity
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
    this.finishTex?.dispose()
    Object.values(this.rigs).forEach((r) => r.dispose())
    if (this.ownsSpeaker) this.speaker.dispose()
    this.floor.mesh.dispose()
    this.floor.mesh.geometry.dispose()
    this.backdrop.material.dispose()
    this.backdrop.mesh.geometry.dispose()
    this.atmosphere.dispose()
  }
}
