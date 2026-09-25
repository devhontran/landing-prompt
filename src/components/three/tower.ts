/**
 * MODEL PLACEHOLDER — loa cột dựng bằng khối cơ bản, tỉ lệ W:D:H = 1 : 1.1 : 3.2 theo brief.
 * [CẦN CUNG CẤP] model .glb thật (xem loadGlb.ts + ASSETS_NEEDED.md). Tên node trùng với `LayerPart`:
 *   Shell · Glass · Frame · Bass · Mid · Tweeter · Crossover
 * Mỗi bộ phận là một Group; hình học cùng vật liệu trong một bộ phận được gộp → ~16 draw call cho cả loa.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { FinishKey, LayerPart } from '@/content/site'
import { brushedNormal, fluteNormal, walnutMap } from './textures'

export const DIM = { W: 0.5, D: 0.55, H: 1.6 }
const T = 0.022 // độ dày vách nhôm

type Part = {
  group: THREE.Group
  /** Hướng tách rời (toạ độ model) khi exploded = 1. */
  offset: THREE.Vector3
  /** Điểm neo cho vạch chú thích (toạ độ bộ phận). */
  anchor: THREE.Vector3
}

export const FINISHES: Record<FinishKey, { color: THREE.Color; metal: number; rough: number; wood: number }> = {
  graphite: { color: new THREE.Color('#2a2d34'), metal: 1, rough: 0.38, wood: 0 },
  silver: { color: new THREE.Color('#c7cbd3'), metal: 1, rough: 0.3, wood: 0 },
  walnut: { color: new THREE.Color('#ffffff'), metal: 0, rough: 0.58, wood: 1 },
}

function box(w: number, h: number, d: number, x = 0, y = 0, z = 0) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z)
}

/** Củ loa hướng về +Z, mặt trước tại z = 0. */
function driver(r: number, dome = false) {
  const paper: THREE.BufferGeometry[] = []
  const rubber: THREE.BufferGeometry[] = []
  const metal: THREE.BufferGeometry[] = []
  const faceZ = (g: THREE.BufferGeometry) => g.rotateX(Math.PI / 2)
  if (dome) {
    metal.push(new THREE.SphereGeometry(r, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 0.55))
    rubber.push(new THREE.TorusGeometry(r * 1.08, r * 0.1, 6, 40))
    // loa kèn (waveguide) nông
    const wg = [new THREE.Vector2(r * 1.2, -0.012), new THREE.Vector2(r * 1.6, -0.004), new THREE.Vector2(r * 1.9, 0)]
    metal.push(faceZ(new THREE.LatheGeometry(wg, 40)).rotateX(Math.PI))
  } else {
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 8; i++) {
      const t = i / 8
      pts.push(new THREE.Vector2(r * (0.2 + 0.66 * t), -r * 0.42 * (1 - t) ** 1.4))
    }
    paper.push(faceZ(new THREE.LatheGeometry(pts, 40)).rotateX(Math.PI))
    paper.push(
      new THREE.SphereGeometry(r * 0.24, 20, 6, 0, Math.PI * 2, 0, Math.PI / 2)
        .rotateX(Math.PI / 2)
        .scale(1, 1, 0.45)
        .translate(0, 0, -r * 0.3),
    )
    rubber.push(new THREE.TorusGeometry(r * 0.93, r * 0.07, 8, 48))
    metal.push(new THREE.RingGeometry(r * 1.0, r * 1.1, 48).translate(0, 0, 0.001))
    metal.push(new THREE.CylinderGeometry(r * 0.45, r * 0.45, 0.05, 24).rotateX(Math.PI / 2).translate(0, 0, -r * 0.5 - 0.03))
  }
  return { paper, rubber, metal }
}

type Mats = ReturnType<typeof createMaterials>

function createMaterials(clip: THREE.Plane[]) {
  const brushed = brushedNormal()
  brushed.repeat.set(2, 2)
  const wood = walnutMap()
  const uWood = { value: 0 }
  const finish = new THREE.MeshStandardMaterial({
    color: FINISHES.graphite.color.clone(),
    metalness: 1,
    roughness: 0.35,
    map: wood,
    normalMap: brushed,
    normalScale: new THREE.Vector2(0.22, 0.22),
    clippingPlanes: clip,
  })
  // Vỏ đổi chất liệu mượt (kim loại ↔ gỗ) bằng một uniform: diffuse = mix(màu, vân gỗ, uWood).
  finish.onBeforeCompile = (s) => {
    s.uniforms.uWood = uWood
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWood;')
      .replace('#include <map_fragment>', 'diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(map, vMapUv).rgb, uWood);')
  }
  finish.customProgramCacheKey = () => 'finish-blend'

  const flutes = fluteNormal(26)
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#dfe5f5',
    metalness: 0,
    roughness: 0.14,
    transmission: 1,
    thickness: 0.04,
    ior: 1.5,
    attenuationColor: new THREE.Color('#8ea2d6'),
    attenuationDistance: 0.5,
    normalMap: flutes,
    normalScale: new THREE.Vector2(1.1, 1.1),
    clippingPlanes: clip,
  })
  const std = (color: string, metalness: number, roughness: number) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, clippingPlanes: clip })
  return {
    finish,
    uWood,
    glass,
    frame: std('#15171e', 1, 0.45),
    paper: std('#121318', 0, 0.78),
    rubber: std('#0a0b0f', 0, 0.92),
    metal: std('#8f95a0', 1, 0.3),
    pcb: std('#0e1b24', 0.1, 0.55),
    component: std('#3a3e47', 0.6, 0.4),
    textures: [brushed, wood, flutes],
  }
}

export class Tower {
  root = new THREE.Group()
  parts = {} as Record<LayerPart, Part>
  mats: Mats
  private finish = { ...FINISHES.graphite, color: FINISHES.graphite.color.clone() }

  constructor(clip: THREE.Plane[] = []) {
    this.mats = createMaterials(clip)
    const { W, D, H } = DIM
    const m = this.mats
    const add = (
      name: LayerPart,
      offset: [number, number, number],
      anchor: [number, number, number],
      pieces: [THREE.Material, THREE.BufferGeometry[]][],
    ) => {
      const group = new THREE.Group()
      group.name = name
      for (const [mat, geos] of pieces) {
        if (!geos.length) continue
        const geo = mergeGeometries(geos, false)!
        geos.forEach((g) => g.dispose())
        group.add(new THREE.Mesh(geo, mat))
      }
      this.root.add(group)
      this.parts[name] = { group, offset: new THREE.Vector3(...offset), anchor: new THREE.Vector3(...anchor) }
    }

    // Vỏ nhôm: hai vách, nắp, đáy, lưng.
    add(
      'Shell',
      [0, 0, -0.42],
      [W / 2, H * 0.3, -D / 2],
      [
        [
          m.finish,
          [
            box(T, H, D, -W / 2 + T / 2),
            box(T, H, D, W / 2 - T / 2),
            box(W - 2 * T, T, D, 0, H / 2 - T / 2),
            box(W - 2 * T, T, D, 0, -H / 2 + T / 2),
            box(W - 2 * T, H - 2 * T, T, 0, 0, -D / 2 + T / 2),
          ],
        ],
      ],
    )

    // Mặt kính gân dọc phủ toàn bộ mặt trước.
    add('Glass', [0, 0, 0.95], [-W / 2, H * 0.38, D / 2], [[m.glass, [box(W, H, 0.024, 0, 0, D / 2 - 0.012)]]])

    // Khung: vách ngăn trước (baffle), giằng ngang, đế.
    const baffleZ = D / 2 - 0.05
    add(
      'Frame',
      [0, 0, 0.18],
      [-W / 2 + T, -H * 0.1, baffleZ],
      [
        [
          m.frame,
          [
            box(W - 2 * T, H - 2 * T, 0.02, 0, 0, baffleZ - 0.01),
            box(W - 2 * T, 0.012, D - 0.12, 0, -0.16, -0.02),
            box(W - 2 * T, 0.012, D - 0.12, 0, 0.3, -0.02),
            box(W - 0.08, 0.05, D - 0.08, 0, -H / 2 - 0.025),
          ],
        ],
      ],
    )

    const placeDriver = (name: LayerPart, r: number, y: number, dz: number, dome = false) => {
      const d = driver(r, dome)
      const move = (gs: THREE.BufferGeometry[]) => gs.map((g) => g.translate(0, y, baffleZ))
      add(
        name,
        [0, 0, dz],
        [-r, y + r * 0.2, baffleZ],
        [
          [m.paper, move(d.paper)],
          [m.rubber, move(d.rubber)],
          [m.metal, move(d.metal)],
        ],
      )
    }
    placeDriver('Bass', 0.16, -0.4, 0.36)
    placeDriver('Mid', 0.1, 0.16, 0.5)
    placeDriver('Tweeter', 0.038, 0.5, 0.66, true)

    // Mạch phân tần: bo mạch + tụ + cuộn cảm, đặt dựa lưng phía dưới.
    const bz = -D / 2 + T + 0.02
    add(
      'Crossover',
      [0.62, -0.05, -0.1],
      [0.15, -0.62, bz],
      [
        [m.pcb, [box(0.34, 0.22, 0.01, 0, -0.6, bz)]],
        [
          m.component,
          [
            new THREE.CylinderGeometry(0.022, 0.022, 0.07, 14).rotateX(Math.PI / 2).translate(-0.1, -0.56, bz + 0.04),
            new THREE.CylinderGeometry(0.022, 0.022, 0.07, 14).rotateX(Math.PI / 2).translate(-0.04, -0.56, bz + 0.04),
            new THREE.CylinderGeometry(0.016, 0.016, 0.05, 14).rotateX(Math.PI / 2).translate(-0.07, -0.65, bz + 0.03),
            new THREE.TorusGeometry(0.035, 0.014, 8, 20).translate(0.07, -0.58, bz + 0.02),
            new THREE.TorusGeometry(0.028, 0.012, 8, 20).translate(0.12, -0.65, bz + 0.02),
          ],
        ],
      ],
    )
  }

  /** e[i] ∈ [0,1] — mức tách của từng lớp. */
  setExplode(e: Partial<Record<LayerPart, number>>) {
    for (const [name, p] of Object.entries(this.parts) as [LayerPart, Part][]) {
      p.group.position.copy(p.offset).multiplyScalar(e[name] ?? 0)
    }
  }

  /** Chỉ hiện khối kính (section tuyên ngôn) — kính dày lên thành một khối, giữ nguyên tâm. */
  setGlassOnly(on: boolean) {
    for (const [name, p] of Object.entries(this.parts) as [LayerPart, Part][]) p.group.visible = !on || name === 'Glass'
    const g = this.parts.Glass.group
    const k = on ? 7 : 1
    g.scale.z = k
    if (on) g.position.set(0, 0, -(DIM.D / 2 - 0.012) * (k - 1))
  }

  /** Trọng số phiên bản (tổng = 1) → vật liệu vỏ. */
  setFinish(w: Record<FinishKey, number>) {
    const f = this.finish
    const metalW = w.graphite + w.silver
    f.color.lerpColors(FINISHES.graphite.color, FINISHES.silver.color, metalW > 0 ? w.silver / metalW : 0)
    f.color.lerp(FINISHES.walnut.color, w.walnut)
    const mat = this.mats.finish
    mat.color.copy(f.color)
    mat.metalness = w.graphite * FINISHES.graphite.metal + w.silver * FINISHES.silver.metal + w.walnut * FINISHES.walnut.metal
    mat.roughness = w.graphite * FINISHES.graphite.rough + w.silver * FINISHES.silver.rough + w.walnut * FINISHES.walnut.rough
    mat.normalScale.setScalar(0.22 * (1 - w.walnut) + 0.08 * w.walnut)
    this.mats.uWood.value = w.walnut
  }

  anchorWorld(name: LayerPart, out: THREE.Vector3) {
    const p = this.parts[name]
    return p.group.localToWorld(out.copy(p.anchor))
  }

  dispose() {
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) mesh.geometry.dispose()
    })
    const m = this.mats
    ;[m.finish, m.glass, m.frame, m.paper, m.rubber, m.metal, m.pcb, m.component].forEach((mat) => mat.dispose())
    m.textures.forEach((t) => t.dispose())
  }
}
