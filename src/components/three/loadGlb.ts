/**
 * Nạp model .glb thật (khi đã có) — [CẦN CUNG CẤP]. Yêu cầu node (xem ASSETS_NEEDED.md):
 *   Shell, Glass, Frame, Bass, Mid, Tweeter, Crossover
 * Chuẩn hoá: gốc toạ độ ở tâm khối loa, +Z là mặt trước, +Y hướng lên, cao ≈ 1.6 đơn vị.
 * Hướng tách rời (exploded) khai báo bằng extras `explode: [x, y, z]` trên từng node; thiếu thì dùng giá trị mặc định.
 * Hỗ trợ Meshopt (EXT_meshopt_compression), KTX2/Basis (transcoder ở /basis/), WebP.
 * Cách thay: trong Tower, thay phần dựng hình bằng các node trả về ở đây (giữ nguyên API setExplode/setFinish).
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import type { LayerPart } from '@/content/site'

export const REQUIRED_NODES: LayerPart[] = ['Shell', 'Glass', 'Frame', 'Bass', 'Mid', 'Tweeter', 'Crossover']

export type LoadedSpeaker = {
  root: THREE.Group
  parts: Record<LayerPart, { node: THREE.Object3D; explode: THREE.Vector3 | null }>
}

export async function loadGlbSpeaker(url: string, renderer: THREE.WebGLRenderer): Promise<LoadedSpeaker> {
  const ktx2 = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer)
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  loader.setKTX2Loader(ktx2)
  const gltf = await loader.loadAsync(url).finally(() => ktx2.dispose())
  const root = gltf.scene
  const missing = REQUIRED_NODES.filter((n) => !root.getObjectByName(n))
  if (missing.length) throw new Error(`Model thiếu node bắt buộc: ${missing.join(', ')}`)
  const parts = {} as LoadedSpeaker['parts']
  for (const name of REQUIRED_NODES) {
    const node = root.getObjectByName(name)!
    const e = node.userData.explode as number[] | undefined
    parts[name] = { node, explode: Array.isArray(e) && e.length === 3 ? new THREE.Vector3(...e) : null }
  }
  const center = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3())
  root.position.sub(center)
  const wrapper = new THREE.Group()
  wrapper.add(root)
  return { root: wrapper, parts }
}
