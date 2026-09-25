/**
 * MODEL PLACEHOLDER — dựng hoàn toàn bằng code, KHÔNG phải thiết kế thật của sản phẩm.
 *
 * Mục đích: giữ đúng cấu trúc bộ phận mà câu chuyện cần (Enclosure / BackPanel / Driver / PCB + các anchor),
 * để khi có file .glb thật chỉ cần đặt tên node tương ứng (xem ASSETS_NEEDED.md).
 * Đơn vị: 1 = 10 cm (tỷ lệ minh họa, không phải kích thước thật).
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { AnchorId } from '@/content/product'

export const BODY = { w: 1.6, h: 2.3, d: 1.5, r: 0.22 }
const HALF_D = BODY.d / 2

type MatKey = keyof ReturnType<typeof createMaterials>

function createMaterials(pcbMap: THREE.Texture) {
  return {
    shell: new THREE.MeshPhysicalMaterial({ color: 0x1d1e21, roughness: 0.62, metalness: 0.15, clearcoat: 0.25, clearcoatRoughness: 0.5 }),
    front: new THREE.MeshStandardMaterial({ color: 0x141517, roughness: 0.85, metalness: 0.05 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xc9c6c0, roughness: 0.32, metalness: 1 }),
    darkAlu: new THREE.MeshStandardMaterial({ color: 0x3a3b3e, roughness: 0.4, metalness: 1, side: THREE.DoubleSide }),
    cone: new THREE.MeshStandardMaterial({ color: 0x232325, roughness: 0.78, metalness: 0.05, side: THREE.DoubleSide }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x121213, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }),
    magnet: new THREE.MeshStandardMaterial({ color: 0x2c2d30, roughness: 0.45, metalness: 0.8 }),
    pcb: new THREE.MeshStandardMaterial({ map: pcbMap, roughness: 0.55, metalness: 0.2 }),
    chip: new THREE.MeshStandardMaterial({ color: 0x0f0f10, roughness: 0.4, metalness: 0.2 }),
    cap: new THREE.MeshStandardMaterial({ color: 0x2a3f5c, roughness: 0.35, metalness: 0.3 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc8a25a, roughness: 0.3, metalness: 1 }),
  }
}

/** Bộ sinh số giả ngẫu nhiên cố định để ảnh chụp luôn giống nhau. */
function prng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

function createPcbTexture(): THREE.Texture {
  const size = 512
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.fillStyle = '#0f241c'
  g.fillRect(0, 0, size, size)
  const rnd = prng(7)
  g.strokeStyle = 'rgba(200,162,90,0.55)'
  g.lineCap = 'round'
  for (let i = 0; i < 70; i++) {
    let x = Math.floor(rnd() * 16) * 32 + 16
    let y = Math.floor(rnd() * 16) * 32 + 16
    g.lineWidth = rnd() > 0.8 ? 5 : 2
    g.beginPath()
    g.moveTo(x, y)
    for (let s = 0; s < 3; s++) {
      if (rnd() > 0.5) x += (rnd() > 0.5 ? 1 : -1) * 32 * Math.ceil(rnd() * 4)
      else y += (rnd() > 0.5 ? 1 : -1) * 32 * Math.ceil(rnd() * 4)
      g.lineTo(x, y)
    }
    g.stroke()
    g.fillStyle = 'rgba(214,176,100,0.8)'
    g.beginPath()
    g.arc(x, y, 5, 0, Math.PI * 2)
    g.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function roundedRect<P extends THREE.Path = THREE.Shape>(w: number, h: number, r: number, path: P = new THREE.Shape() as unknown as P): P {
  const x = -w / 2
  const y = -h / 2
  path.moveTo(x + r, y)
  path.lineTo(x + w - r, y)
  path.quadraticCurveTo(x + w, y, x + w, y + r)
  path.lineTo(x + w, y + h - r)
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  path.lineTo(x + r, y + h)
  path.quadraticCurveTo(x, y + h, x, y + h - r)
  path.lineTo(x, y + r)
  path.quadraticCurveTo(x, y, x + r, y)
  return path
}

function circlePath(cx: number, cy: number, r: number) {
  const p = new THREE.Path()
  p.absarc(cx, cy, r, 0, Math.PI * 2, true)
  return p
}

/** Lathe quanh trục Z (mặt trước = +Z). */
function latheZ(points: [number, number][], segments = 48) {
  const g = new THREE.LatheGeometry(points.map(([r, h]) => new THREE.Vector2(r, h)), segments)
  g.rotateX(Math.PI / 2)
  return g
}

function cylZ(r: number, len: number, seg = 32, open = false) {
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, open)
  g.rotateX(Math.PI / 2)
  return g
}

class Bucket {
  private map = new Map<MatKey, THREE.BufferGeometry[]>()
  add(key: MatKey, geo: THREE.BufferGeometry, m?: THREE.Matrix4) {
    if (m) geo.applyMatrix4(m)
    const g = geo.index ? geo.toNonIndexed() : geo
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name)
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2))
    const list = this.map.get(key) ?? []
    list.push(g)
    this.map.set(key, list)
  }
  build(mats: ReturnType<typeof createMaterials>, name: string) {
    const group = new THREE.Group()
    group.name = name
    for (const [key, list] of this.map) {
      const merged = mergeGeometries(list, false)!
      merged.computeBoundingSphere()
      const mesh = new THREE.Mesh(merged, mats[key])
      mesh.name = `${name}_${key}`
      group.add(mesh)
    }
    return group
  }
}

const T = (x = 0, y = 0, z = 0) => new THREE.Matrix4().makeTranslation(x, y, z)

export type SpeakerBuild = {
  root: THREE.Group
  parts: { driver: THREE.Object3D; pcb: THREE.Object3D; enclosure: THREE.Object3D; backPanel: THREE.Object3D }
  anchors: Record<AnchorId, THREE.Object3D>
  dims: THREE.LineSegments
  dispose: () => void
}

export function buildProceduralSpeaker(): SpeakerBuild {
  const pcbTex = createPcbTexture()
  const mats = createMaterials(pcbTex)
  const { w, h, r } = BODY

  // ---------- ENCLOSURE (thân vỏ rỗng + mặt trước + chân đế + núm) ----------
  const enc = new Bucket()
  const bevel = 0.025
  const sleeveShape = roundedRect(w - bevel * 2, h - bevel * 2, r)
  sleeveShape.holes.push(roundedRect(w - 0.14, h - 0.14, r - 0.05, new THREE.Path()))
  const sleeve = new THREE.ExtrudeGeometry(sleeveShape, {
    depth: BODY.d - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 10,
  })
  sleeve.translate(0, 0, -HALF_D + bevel)
  enc.add('shell', sleeve)

  // Mặt trước lõm nhẹ, có lỗ tròn cho củ loa.
  const frontShape = roundedRect(w - 0.12, h - 0.12, r - 0.05)
  frontShape.holes.push(circlePath(0, -0.2, 0.47))
  const front = new THREE.ExtrudeGeometry(frontShape, { depth: 0.06, bevelEnabled: false, curveSegments: 10 })
  front.translate(0, 0, HALF_D - 0.075)
  enc.add('front', front)
  // Vòng viền nhôm quanh củ loa.
  const ring = new THREE.TorusGeometry(0.475, 0.022, 12, 72)
  enc.add('alu', ring, T(0, -0.2, HALF_D - 0.02))
  // Đèn trạng thái nhỏ.
  enc.add('alu', cylZ(0.022, 0.02, 16), T(0, 0.82, HALF_D - 0.01))
  // Chân đế nhôm.
  const plinth = new THREE.ExtrudeGeometry(roundedRect(w - 0.25, BODY.d - 0.25, 0.12), { depth: 0.05, bevelEnabled: false, curveSegments: 8 })
  plinth.rotateX(Math.PI / 2)
  enc.add('darkAlu', plinth, T(0, -h / 2 - 0.0, 0))
  // Núm xoay trên đỉnh.
  const knob = new THREE.CylinderGeometry(0.19, 0.2, 0.09, 64)
  enc.add('alu', knob, T(0, h / 2 + 0.045, -0.22))
  enc.add('darkAlu', new THREE.TorusGeometry(0.13, 0.008, 8, 48).rotateX(Math.PI / 2), T(0, h / 2 + 0.092, -0.22))
  const enclosure = enc.build(mats, 'Enclosure')

  // ---------- BACK PANEL (nắp lưng, tách ra trong cảnh cấu tạo) ----------
  const back = new Bucket()
  const backShape = roundedRect(w - 0.12, h - 0.12, r - 0.05)
  backShape.holes.push(circlePath(0, 0.55, 0.16))
  const ioY = -0.68
  backShape.holes.push(shiftPath(roundedRect(0.16, 0.06, 0.029, new THREE.Path()), -0.28, ioY))
  const plate = new THREE.ExtrudeGeometry(backShape, { depth: 0.06, bevelEnabled: false, curveSegments: 10 })
  plate.translate(0, 0, -HALF_D + 0.015)
  back.add('shell', plate)
  back.add('darkAlu', cylZ(0.16, 0.45, 40, true), T(0, 0.55, -HALF_D + 0.26))
  back.add('alu', new THREE.TorusGeometry(0.17, 0.012, 10, 48), T(0, 0.55, -HALF_D + 0.01))
  // Cụm cổng: jack 3.5 mm, nguồn, công tắc (hình minh họa).
  back.add('alu', new THREE.TorusGeometry(0.035, 0.01, 8, 24), T(0.02, ioY, -HALF_D + 0.012))
  back.add('alu', new THREE.TorusGeometry(0.06, 0.012, 8, 32), T(0.28, ioY, -HALF_D + 0.012))
  back.add('rubber', new THREE.BoxGeometry(0.1, 0.05, 0.02), T(0.28, ioY - 0.22, -HALF_D + 0.01))
  const backPanel = back.build(mats, 'BackPanel')

  // ---------- DRIVER (củ loa) ----------
  const drv = new Bucket()
  const dz = HALF_D - 0.09 // mặt phẳng lắp
  const dy = -0.2
  drv.add('cone', latheZ([[0.1, -0.2], [0.18, -0.13], [0.28, -0.06], [0.4, 0.0], [0.405, 0.0]]), T(0, dy, dz))
  drv.add('rubber', latheZ([[0.4, 0.0], [0.415, 0.03], [0.435, 0.04], [0.455, 0.03], [0.465, 0.0]], 64), T(0, dy, dz))
  const dust = new THREE.SphereGeometry(0.15, 32, 12, 0, Math.PI * 2, 0, 0.75)
  dust.rotateX(Math.PI / 2)
  drv.add('cone', dust, T(0, dy, dz - 0.26))
  drv.add('darkAlu', latheZ([[0.465, 0.0], [0.47, -0.02], [0.3, -0.18], [0.2, -0.3], [0.21, -0.3]], 64), T(0, dy, dz))
  drv.add('magnet', cylZ(0.22, 0.16, 48), T(0, dy, dz - 0.4))
  drv.add('alu', cylZ(0.235, 0.025, 48), T(0, dy, dz - 0.31))
  drv.add('alu', cylZ(0.235, 0.025, 48), T(0, dy, dz - 0.49))
  drv.add('gold', new THREE.BoxGeometry(0.05, 0.02, 0.06), T(0.3, dy + 0.32, dz - 0.14))
  const driver = drv.build(mats, 'Driver')

  // ---------- PCB (bo mạch khuếch đại) ----------
  const pc = new Bucket()
  const pz = -HALF_D + 0.3
  pc.add('pcb', new THREE.BoxGeometry(1.1, 1.5, 0.03).rotateY(Math.PI), T(0, -0.05, pz))
  const rnd = prng(3)
  // Chip & linh kiện nhỏ hướng về phía nắp lưng (-Z).
  pc.add('chip', new THREE.BoxGeometry(0.26, 0.26, 0.04), T(-0.22, -0.1, pz - 0.035))
  pc.add('chip', new THREE.BoxGeometry(0.16, 0.12, 0.03), T(0.2, -0.28, pz - 0.03))
  for (let i = 0; i < 10; i++) {
    pc.add('chip', new THREE.BoxGeometry(0.05, 0.03, 0.02), T(-0.45 + rnd() * 0.9, -0.55 + rnd() * 0.3, pz - 0.025))
  }
  for (let i = 0; i < 4; i++) {
    const cap = cylZ(0.055, 0.2, 24)
    pc.add('cap', cap, T(-0.36 + i * 0.13, 0.12, pz - 0.115))
    pc.add('alu', cylZ(0.056, 0.004, 24), T(-0.36 + i * 0.13, 0.12, pz - 0.217))
  }
  // Tản nhiệt nhôm.
  pc.add('alu', new THREE.BoxGeometry(0.46, 0.04, 0.06), T(0.18, 0.2, pz - 0.045))
  for (let i = 0; i < 7; i++) pc.add('alu', new THREE.BoxGeometry(0.02, 0.36, 0.18), T(-0.02 + i * 0.066, 0.38, pz - 0.105))
  // Đầu nối thẳng hàng với cổng ở nắp lưng.
  pc.add('darkAlu', new THREE.BoxGeometry(0.14, 0.05, 0.16), T(-0.28, -0.68, pz - 0.1))
  pc.add('darkAlu', cylZ(0.04, 0.16, 20), T(0.02, -0.68, pz - 0.1))
  pc.add('darkAlu', cylZ(0.065, 0.16, 24), T(0.28, -0.68, pz - 0.1))
  const pcb = pc.build(mats, 'PCB')

  // ---------- ĐƯỜNG KÍCH THƯỚC (bản vẽ) ----------
  const dimPts: number[] = []
  const seg = (a: number[], b: number[]) => dimPts.push(...a, ...b)
  const hx = -w / 2 - 0.22
  const bz = -HALF_D
  seg([hx, -h / 2, bz], [hx, h / 2, bz])
  seg([hx - 0.06, -h / 2, bz], [hx + 0.06, -h / 2, bz])
  seg([hx - 0.06, h / 2, bz], [hx + 0.06, h / 2, bz])
  seg([-w / 2 - 0.02, h / 2, bz], [hx - 0.08, h / 2, bz])
  seg([-w / 2 - 0.02, -h / 2, bz], [hx - 0.08, -h / 2, bz])
  const wy = -h / 2 - 0.25
  seg([-w / 2, wy, bz], [w / 2, wy, bz])
  seg([-w / 2, wy - 0.06, bz], [-w / 2, wy + 0.06, bz])
  seg([w / 2, wy - 0.06, bz], [w / 2, wy + 0.06, bz])
  seg([w / 2, wy, bz], [w / 2, wy, HALF_D])
  seg([w / 2, wy - 0.06, HALF_D], [w / 2, wy + 0.06, HALF_D])
  const dimGeo = new THREE.BufferGeometry()
  dimGeo.setAttribute('position', new THREE.Float32BufferAttribute(dimPts, 3))
  const dims = new THREE.LineSegments(dimGeo, new THREE.LineBasicMaterial({ color: 0xa9c7e8, transparent: true, opacity: 0, depthWrite: false }))
  dims.name = 'Dimensions'

  const root = new THREE.Group()
  root.name = 'Speaker'
  root.add(enclosure, backPanel, driver, pcb, dims)

  // ---------- ANCHORS ----------
  const mk = (parent: THREE.Object3D, name: AnchorId, x: number, y: number, z: number) => {
    const o = new THREE.Object3D()
    o.name = `Anchor_${name}`
    o.position.set(x, y, z)
    parent.add(o)
    return o
  }
  const anchors: Record<AnchorId, THREE.Object3D> = {
    driver: mk(driver, 'driver', 0, dy, dz - 0.4),
    port: mk(backPanel, 'port', 0, 0.55, -HALF_D),
    io: mk(backPanel, 'io', 0.02, ioY, -HALF_D),
    knob: mk(enclosure, 'knob', 0.19, h / 2 + 0.05, -0.22),
    amp: mk(pcb, 'amp', 0.18, 0.38, pz - 0.19),
    height: mk(root, 'height', hx, 0.2, bz),
    width: mk(root, 'width', w / 2, wy, 0),
    body: mk(enclosure, 'body', w / 2, 0.35, 0.1),
    shell: mk(enclosure, 'shell', w / 2 - 0.06, 0.55, -HALF_D),
    backPanel: mk(backPanel, 'backPanel', 0, 0, -HALF_D),
  }

  return {
    root,
    parts: { driver, pcb, enclosure, backPanel },
    anchors,
    dims,
    dispose: () => {
      root.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
      })
      Object.values(mats).forEach((m) => m.dispose())
      pcbTex.dispose()
    },
  }
}

function shiftPath(p: THREE.Path, dx: number, dy: number) {
  const out = new THREE.Path()
  const pts = p.getPoints(6)
  pts.forEach((v, i) => (i === 0 ? out.moveTo(v.x + dx, v.y + dy) : out.lineTo(v.x + dx, v.y + dy)))
  return out
}
