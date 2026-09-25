/**
 * Cảnh 3D thuần three.js (không phụ thuộc DOM): nền navy + sương, key ấm trên-phải, rim lạnh thấp,
 * môi trường studio tối (~0.3), loa placeholder. Nhận "pose" mục tiêu và nội suy mượt (damp) về đó.
 * Chuyển cảnh giữa các section = mặt phẳng cắt quét từ dưới lên (reveal), không cắt ngang chuyển động camera.
 */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { layers, type FinishKey, type LayerPart } from '@/content/site'
import { seg } from '@/lib/ease'
import { DIM, Tower } from './tower'

export const BG = '#070b20'
export const FOV = 32
export const CAM_Z = 6
const MODEL_H = DIM.H + 0.05

export type StageKey = 'preload' | 'hero' | 'statement' | 'exploded' | 'finish'

/** Vị trí theo tỉ lệ khung nhìn: tâm (cx, cy) và chiều cao model (hf) — model luôn khớp bố cục DOM. */
export type Pose = { cx: number; cy: number; hf: number; rotY: number; rotX: number; explode: number }

const damp = THREE.MathUtils.damp

/** Mức tách từng lớp theo tiến độ tổng e ∈ [0,1]: lần lượt vỏ(+kính) → khung → bass → trung → tweeter → phân tần. */
export function explodeSteps(e: number) {
  const out = {} as Record<LayerPart, number>
  const n = layers.length
  layers.forEach((l, i) => {
    const a = (i / n) * 0.82
    out[l.part] = seg(e, a, a + 0.3)
  })
  out.Glass = out.Shell
  return out
}

export class Rig {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  tower: Tower
  clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100)
  /** Trạng thái đang hiển thị (đã damp). */
  pose: Pose = { cx: 0.5, cy: 0.5, hf: 0.6, rotY: -0.5, rotX: 0, explode: 0 }
  target: Pose = { ...this.pose }
  finish: Record<FinishKey, number> = { graphite: 1, silver: 0, walnut: 0 }
  finishTarget: Record<FinishKey, number> = { graphite: 1, silver: 0, walnut: 0 }
  /** Cảnh đang hiển thị và cảnh cần tới. */
  shown: StageKey | null = null
  wanted: StageKey | null = null
  reveal = 0
  spin = 0
  private env: THREE.Texture
  private steps = explodeSteps(0)

  constructor(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene
    this.camera = camera
    gl.localClippingEnabled = true
    // Nền trong suốt: màu navy đến từ trang (body) → canvas chồng lên preloader hoặc nằm dưới nội dung đều liền mạch.
    scene.background = null
    scene.fog = new THREE.Fog(BG, 6.5, 13)
    const pmrem = new THREE.PMREMGenerator(gl)
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    scene.environment = this.env
    scene.environmentIntensity = 0.3

    const key = new THREE.DirectionalLight('#ffd9a0', 2.6)
    key.position.set(4, 5, 3.5)
    const rim = new THREE.DirectionalLight('#9fb3ff', 2.4)
    rim.position.set(-4, -1.5, -3)
    const warmRim = new THREE.DirectionalLight('#ffd9a0', 1.4)
    warmRim.position.set(3, 1, -4)
    scene.add(key, rim, warmRim)

    this.tower = new Tower([this.clip])
    scene.add(this.tower.root)
    camera.fov = FOV
    camera.position.set(0, 0, CAM_Z)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }

  setFinish(key: FinishKey) {
    for (const k of Object.keys(this.finishTarget) as FinishKey[]) this.finishTarget[k] = k === key ? 1 : 0
  }

  /** Đặt cảnh + pose mục tiêu. */
  want(key: StageKey | null, pose?: Pose) {
    this.wanted = key
    if (pose) Object.assign(this.target, pose)
  }

  /** Nhảy thẳng tới trạng thái mục tiêu (ảnh chụp, lần đầu vào trang giữa chừng). */
  snap() {
    Object.assign(this.pose, this.target)
    Object.assign(this.finish, this.finishTarget)
    this.shown = this.wanted
    this.reveal = this.wanted ? 1 : 0
    this.apply()
  }

  /** Trả về true nếu còn đang chuyển động (cần vẽ tiếp). */
  update(dt: number) {
    // Chuyển cảnh theo thời gian thực (máy chậm vẫn đúng 0.5s); damping dùng dt giới hạn để ổn định.
    const tdt = Math.min(dt, 0.25)
    dt = Math.min(dt, 1 / 20)
    let moving = false
    // Chuyển cảnh: quét ẩn (0.5s) → đổi cảnh → quét hiện.
    if (this.shown !== this.wanted) {
      this.reveal = Math.max(0, this.reveal - tdt / 0.5)
      if (this.reveal === 0) {
        this.shown = this.wanted
        Object.assign(this.pose, this.target)
      }
      moving = true
    } else if (this.shown && this.reveal < 1) {
      this.reveal = Math.min(1, this.reveal + tdt / 0.9)
      moving = true
    }
    const p = this.pose
    const t = this.target
    const pos = 1 - Math.exp(-16 * dt) // vị trí bám DOM: nhanh
    const rot = 1 - Math.exp(-6 * dt)
    for (const k of ['cx', 'cy', 'hf'] as const) p[k] += (t[k] - p[k]) * pos
    for (const k of ['rotY', 'rotX', 'explode'] as const) p[k] += (t[k] - p[k]) * rot
    for (const k of Object.keys(this.finish) as FinishKey[]) this.finish[k] = damp(this.finish[k], this.finishTarget[k], 7, dt)
    if (this.shown === 'preload') {
      this.spin += dt * 0.5
      moving = true
    } else if (this.spin !== 0) {
      // Sau preloader: quay nốt về vòng gần nhất rồi dừng (không giật).
      const rest = Math.round(this.spin / (Math.PI * 2)) * Math.PI * 2
      this.spin = damp(this.spin, rest, 3, dt)
      if (Math.abs(this.spin - rest) < 1e-3) this.spin = 0
      moving = true
    }
    const err =
      Math.abs(t.cx - p.cx) +
      Math.abs(t.cy - p.cy) +
      Math.abs(t.hf - p.hf) +
      Math.abs(t.rotY - p.rotY) +
      Math.abs(t.explode - p.explode) +
      Math.abs(this.finish.graphite - this.finishTarget.graphite) +
      Math.abs(this.finish.walnut - this.finishTarget.walnut)
    if (err > 1e-4) moving = true
    this.apply()
    return moving
  }

  /** Model có đang được vẽ không (để tạm dừng canvas). */
  get visible() {
    return this.shown !== null && this.reveal > 0
  }

  private apply() {
    const cam = this.camera
    const p = this.pose
    const Hv = 2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
    const s = (p.hf * Hv) / MODEL_H
    const root = this.tower.root
    root.scale.setScalar(s)
    root.position.set((p.cx - 0.5) * Hv * cam.aspect, (0.5 - p.cy) * Hv, 0)
    root.rotation.set(p.rotX, p.rotY + this.spin, 0)
    this.steps = explodeSteps(p.explode)
    this.tower.setExplode(this.steps)
    this.tower.setGlassOnly(this.shown === 'statement')
    this.tower.setFinish(this.finish)
    // Mặt phẳng cắt: giữ phần y ≤ h (thế giới).
    const half = (MODEL_H / 2 + 0.1) * s
    const bottom = root.position.y - half
    this.clip.constant = this.reveal >= 1 ? 100 : bottom + seg(this.reveal, 0, 1) * half * 2
    root.visible = this.visible
  }

  /** Mức tách hiện tại của một lớp (0..1). */
  step(part: LayerPart) {
    return this.steps[part]
  }

  dispose() {
    this.tower.dispose()
    this.env.dispose()
  }
}
