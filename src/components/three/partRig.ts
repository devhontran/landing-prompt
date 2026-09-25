/**
 * Mỗi bộ phận có 3 lớp:
 *  1. solid  – vật liệu đầy đủ (opacity = solid)
 *  2. ghost  – shader fresnel vẽ đường bao cho bề mặt cong (opacity = (1 - solid) * lines)
 *  3. edges  – EdgesGeometry cho cạnh sắc (cùng opacity với ghost)
 * Nhờ đó cùng một bộ phận có thể chuyển mượt giữa "vật liệu thật" và "nét bản vẽ".
 * Hoạt động với cả model dựng thủ tục và model .glb (chỉ cần mesh).
 */
import * as THREE from 'three'

export const LINE_COLOR = new THREE.Color(0xa9c7e8)

const ghostVertex = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const ghostFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
    float a = pow(f, 4.0) * 0.6 + 0.02;
    gl_FragColor = vec4(uColor, a * uOpacity);
  }
`

export class PartRig {
  readonly solids: THREE.Material[] = []
  private ghost: THREE.ShaderMaterial
  private lines: THREE.LineBasicMaterial
  private solidMeshes: THREE.Mesh[] = []
  private overlays: THREE.Object3D[] = []
  /** Điểm mẫu (không gian local của mesh) để tính khung bao trên màn hình khi debug. */
  readonly samples: { mesh: THREE.Mesh; points: THREE.Vector3[] }[] = []

  /** Một bộ phận chỉ có một rig (StrictMode có thể gọi useMemo hai lần trên cùng object). */
  static of(object: THREE.Object3D): PartRig {
    return (object.userData.partRig as PartRig | undefined) ?? new PartRig(object)
  }

  private constructor(object: THREE.Object3D) {
    object.userData.partRig = this
    this.ghost = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: LINE_COLOR.clone() }, uOpacity: { value: 0 } },
      vertexShader: ghostVertex,
      fragmentShader: ghostFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    this.lines = new THREE.LineBasicMaterial({ color: LINE_COLOR, transparent: true, opacity: 0, depthWrite: false })

    const meshes: THREE.Mesh[] = []
    object.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !o.userData.overlay) meshes.push(o as THREE.Mesh)
    })
    for (const mesh of meshes) {
      const src = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const cloned = src.map((m) => {
        const c = m.clone()
        c.transparent = true
        return c
      })
      mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]
      this.solids.push(...cloned)
      this.solidMeshes.push(mesh)

      const ghost = new THREE.Mesh(mesh.geometry, this.ghost)
      ghost.name = `${mesh.name}_ghost`
      ghost.renderOrder = 2
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 35), this.lines)
      edges.name = `${mesh.name}_edges`
      edges.renderOrder = 3
      ghost.userData.overlay = edges.userData.overlay = true
      mesh.add(ghost, edges)
      this.overlays.push(ghost, edges)

      const pos = mesh.geometry.attributes.position
      const step = Math.max(1, Math.floor(pos.count / 120))
      const pts: THREE.Vector3[] = []
      for (let i = 0; i < pos.count; i += step) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i))
      this.samples.push({ mesh, points: pts })
    }
  }

  /** solid: 0 = chỉ nét, 1 = vật liệu đầy đủ. lines: độ đậm tối đa của nét. */
  set(solid: number, lines: number) {
    const s = THREE.MathUtils.clamp(solid, 0, 1)
    for (const m of this.solids) {
      m.opacity = s
      m.depthWrite = s > 0.98
    }
    for (const mesh of this.solidMeshes) mesh.visible = s > 0.002 || lines > 0.002
    const l = (1 - s) * lines
    this.ghost.uniforms.uOpacity.value = l
    this.lines.opacity = l * 0.85
    const showOverlay = l > 0.002
    for (const o of this.overlays) o.visible = showOverlay
    // Mesh cha phải hiển thị để lớp nét (con) được vẽ; ẩn riêng vật liệu solid bằng colorWrite.
    for (const m of this.solids) m.colorWrite = s > 0.002
  }

  get visibleAmount() {
    return this.solidMeshes.some((m) => m.visible)
  }

  dispose() {
    this.ghost.dispose()
    this.lines.dispose()
    this.solids.forEach((m) => m.dispose())
    this.overlays.forEach((o) => {
      if ((o as THREE.LineSegments).isLineSegments) (o as THREE.LineSegments).geometry.dispose()
    })
  }
}
