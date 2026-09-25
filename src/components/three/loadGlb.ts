/**
 * Nạp model .glb thật (khi đã có). Yêu cầu tên node — xem ASSETS_NEEDED.md:
 *   Driver, PCB, Enclosure, BackPanel  (bắt buộc)
 *   Anchor_driver, Anchor_port, Anchor_io, Anchor_knob, Anchor_amp,
 *   Anchor_height, Anchor_width, Anchor_body, Anchor_shell   (khuyến nghị; thiếu thì dùng tâm bộ phận)
 * Model nên được chuẩn hóa: gốc tọa độ ở tâm khối loa, trục +Z là mặt trước, cao ≈ 2.3 đơn vị.
 * Hỗ trợ nén Meshopt (EXT_meshopt_compression) và texture WebP (EXT_texture_webp).
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import type { AnchorId } from '@/content/product'
import type { SpeakerBuild } from './proceduralSpeaker'

const REQUIRED = ['Driver', 'PCB', 'Enclosure', 'BackPanel'] as const
const ANCHORS: AnchorId[] = ['driver', 'port', 'io', 'knob', 'amp', 'height', 'width', 'body', 'shell', 'backPanel']

export async function loadGlbSpeaker(url: string): Promise<SpeakerBuild> {
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const gltf = await loader.loadAsync(url)
  const root = gltf.scene
  const find = (name: string) => root.getObjectByName(name)
  const missing = REQUIRED.filter((n) => !find(n))
  if (missing.length) throw new Error(`Model thiếu node bắt buộc: ${missing.join(', ')}`)

  const parts = {
    driver: find('Driver')!,
    pcb: find('PCB')!,
    enclosure: find('Enclosure')!,
    backPanel: find('BackPanel')!,
  }
  const box = new THREE.Box3().setFromObject(root)
  const center = box.getCenter(new THREE.Vector3())
  const anchors = {} as Record<AnchorId, THREE.Object3D>
  for (const id of ANCHORS) {
    let obj = find(`Anchor_${id}`)
    if (!obj) {
      obj = new THREE.Object3D()
      const fallbackPart = id === 'driver' ? parts.driver : id === 'amp' ? parts.pcb : id === 'port' || id === 'io' || id === 'backPanel' ? parts.backPanel : parts.enclosure
      new THREE.Box3().setFromObject(fallbackPart).getCenter(obj.position)
      root.add(obj)
    }
    anchors[id] = obj
  }

  // Đường kích thước suy ra từ hộp bao.
  const { min, max } = box
  const p: number[] = []
  const hx = min.x - 0.22
  p.push(hx, min.y, min.z, hx, max.y, min.z, min.x, min.y - 0.25, min.z, max.x, min.y - 0.25, min.z)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
  const dims = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xa9c7e8, transparent: true, opacity: 0, depthWrite: false }))
  root.add(dims)
  root.position.sub(center)
  const wrapper = new THREE.Group()
  wrapper.add(root)

  return {
    root: wrapper,
    parts,
    anchors,
    dims,
    dispose: () => {
      wrapper.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh) {
          m.geometry.dispose()
          const mats = Array.isArray(m.material) ? m.material : [m.material]
          mats.forEach((mat) => {
            Object.values(mat).forEach((val) => (val as THREE.Texture)?.isTexture && (val as THREE.Texture).dispose())
            mat.dispose()
          })
        }
      })
    },
  }
}
