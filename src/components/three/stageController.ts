/**
 * Điều khiển cảnh 3D theo kiểu imperative (đúng pattern của R3F): mọi thay đổi trên object three.js
 * nằm ở đây, component React chỉ gọi `update()` trong useFrame.
 */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { AnchorId } from '@/content/product'
import { buildProceduralSpeaker, type SpeakerBuild } from './proceduralSpeaker'
import { PartRig } from './partRig'
import { createBlueprintGrid, createFloor } from './effects'
import type { StoryState } from './storyState'

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

const v = new THREE.Vector3()
const tmp = new THREE.Vector3()

export class StageController {
  readonly speaker: SpeakerBuild
  readonly root = new THREE.Group()
  private rigs: Record<'driver' | 'pcb' | 'shell' | 'back', PartRig>
  private floor: ReturnType<typeof createFloor>
  private grid = createBlueprintGrid()
  private time = 0
  private ownsSpeaker: boolean

  constructor(external?: SpeakerBuild | null) {
    performance.mark('stage:build-start')
    this.ownsSpeaker = !external
    this.speaker = external ?? buildProceduralSpeaker()
    const p = this.speaker.parts
    this.rigs = { driver: PartRig.of(p.driver), pcb: PartRig.of(p.pcb), shell: PartRig.of(p.enclosure), back: PartRig.of(p.backPanel) }
    // Sàn & bóng tiếp xúc lấy theo hộp bao thật của model (đúng cho cả model .glb).
    const box = new THREE.Box3()
    Object.values(p).forEach((part) => box.expandByObject(part))
    const size = box.getSize(new THREE.Vector3())
    this.floor = createFloor({ w: size.x * 0.84, d: size.z * 0.84 })
    this.floor.mesh.position.y = box.min.y
    const key = new THREE.DirectionalLight(0xffffff, 1.6)
    key.position.set(3, 5, 4)
    const rim = new THREE.DirectionalLight(0xbfd2ff, 0.9)
    rim.position.set(-4, 2, -3)
    this.root.add(this.grid.mesh, this.speaker.root, this.floor.mesh, key, rim, new THREE.AmbientLight(0xffffff, 0.08))
    performance.measure('stage:build', 'stage:build-start')
  }

  /** Ánh sáng môi trường dựng sẵn (RoomEnvironment → PMREM): không phải tải file HDR. */
  attachEnvironment(gl: THREE.WebGLRenderer, scene: THREE.Scene) {
    performance.mark('stage:env-start')
    const pmrem = new THREE.PMREMGenerator(gl)
    // 64 px, không blur: đủ cho phản chiếu mờ của vật liệu nhám, rẻ hơn nhiều so với mặc định 256.
    const env = pmrem.fromScene(new RoomEnvironment(), 0, 0.1, 100, { size: 64 }).texture
    scene.environment = env
    scene.environmentIntensity = 0.55
    pmrem.dispose()
    performance.measure('stage:env', 'stage:env-start')
    return () => {
      env.dispose()
      scene.environment = null
    }
  }

  /** Áp trạng thái vào cảnh. Trả về true nếu cần vẽ tiếp frame sau (sàn đang có sóng chuyển động). */
  update(s: StoryState, cam: THREE.PerspectiveCamera, gl: THREE.WebGLRenderer, W: number, H: number, delta: number) {
    const { speaker, rigs, floor, grid } = this
    speaker.root.rotation.y = s.rotY
    speaker.parts.backPanel.position.z = -s.explode * 0.95
    speaker.parts.backPanel.position.y = -s.explode * 0.12
    rigs.driver.set(s.sDriver, s.lines)
    rigs.pcb.set(s.sPcb, s.lines)
    rigs.shell.set(s.sShell, s.lines)
    rigs.back.set(s.sBack, s.lines)
    ;(speaker.dims.material as THREE.LineBasicMaterial).opacity = s.dims * 0.9
    speaker.dims.visible = s.dims > 0.002

    floor.material.uniforms.uOpacity.value = s.floor
    floor.mesh.visible = s.floor > 0.002
    if (floor.mesh.visible) {
      this.time += Math.min(delta, 0.05)
      floor.material.uniforms.uTime.value = this.time
    }
    const dpr = gl.getPixelRatio()
    grid.material.uniforms.uOpacity.value = s.grid
    grid.material.uniforms.uRes.value.set(W * dpr, H * dpr)
    grid.material.uniforms.uDpr.value = dpr
    grid.mesh.visible = s.grid > 0.002

    // Camera: đặt khối cầu bao (radius) vừa vùng khung (fx, fy, fw, fh), dịch bằng view offset.
    const halfFov = THREE.MathUtils.degToRad(cam.fov / 2)
    const t = Math.min(Math.tan(halfFov) * s.fh, Math.tan(halfFov) * (W / H) * s.fw)
    const dist = (s.radius * Math.sqrt(1 + t * t)) / t
    cam.position.set(0, s.targetY + Math.sin(s.pitch) * dist, s.targetZ + Math.cos(s.pitch) * dist)
    cam.lookAt(0, s.targetY, s.targetZ)
    cam.near = Math.max(0.1, dist - 6)
    cam.far = dist + 8
    cam.setViewOffset(W, H, (0.5 - s.fx) * W, (0.5 - s.fy) * H, W, H)
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
    speaker.root.updateMatrixWorld(true)
    return floor.mesh.visible
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
        for (const { mesh, points } of rig.samples) {
          if (!mesh.visible) continue
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
    this.floor.material.dispose()
    this.floor.mesh.geometry.dispose()
    this.grid.material.dispose()
    this.grid.mesh.geometry.dispose()
  }
}
