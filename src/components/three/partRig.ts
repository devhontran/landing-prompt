/**
 * Mỗi bộ phận có 3 lớp, cùng chịu một "mặt phẳng quét" nằm ngang (cao độ uCut, toạ độ thế giới):
 *  1. solid  – vật liệu thật được patch (onBeforeCompile): phần NẰM TRÊN mặt quét bị discard,
 *              mép cắt phát sáng ấm như vệt laser của máy quét. Vật liệu luôn opaque → không lỗi sắp xếp trong suốt.
 *  2. ghost  – fresnel vẽ đường bao cho bề mặt cong, chỉ hiện PHÍA TRÊN mặt quét.
 *  3. edges  – nét cạnh có hiệu ứng "tự vẽ": mỗi đoạn có thứ tự (aOrder, từ trên xuống) và toạ độ dọc đoạn (aT).
 * reveal = 1 → mặt quét trên đỉnh model (toàn vật liệu); reveal = 0 → dưới đáy (toàn nét).
 */
import * as THREE from 'three'

export const LINE_COLOR = new THREE.Color(0xa9c7e8)
/** Dải cao độ (thế giới) mà mặt quét đi qua, bao cả phần exploded. */
export const SCAN = { min: -1.95, max: 2.05 }
const EDGE_COLOR = new THREE.Color(1.0, 0.66, 0.38)

type Shared = { uPulse: { value: number }; uPulseCenter: { value: THREE.Vector3 } }

function prng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

/** Thêm aT (0→1 dọc mỗi đoạn) và aOrder (đoạn cao vẽ trước) cho hình học LineSegments không index. */
export function withDrawAttributes(geo: THREE.BufferGeometry, seed = 1) {
  const pos = geo.attributes.position
  const n = pos.count
  const aT = new Float32Array(n)
  const aOrder = new Float32Array(n)
  geo.computeBoundingBox()
  const { min, max } = geo.boundingBox!
  const span = Math.max(1e-3, max.y - min.y)
  const rnd = prng(seed)
  for (let i = 0; i < n; i += 2) {
    const midY = (pos.getY(i) + pos.getY(i + 1)) / 2
    const o = 0.8 * (1 - (midY - min.y) / span) + 0.2 * rnd()
    aT[i] = 0
    aT[i + 1] = 1
    aOrder[i] = aOrder[i + 1] = o
  }
  geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1))
  geo.setAttribute('aOrder', new THREE.BufferAttribute(aOrder, 1))
  return geo
}

/** Vật liệu nét "tự vẽ" (dùng cho nét cạnh và đường kích thước). */
export function createLineMaterial(color = LINE_COLOR) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: color.clone() },
      uOpacity: { value: 0 },
      uDraw: { value: 0 },
      uCut: { value: SCAN.min },
      uBand: { value: 0.06 },
    },
    vertexShader: /* glsl */ `
      attribute float aT;
      attribute float aOrder;
      varying float vT;
      varying float vOrder;
      varying float vY;
      void main() {
        vT = aT;
        vOrder = aOrder;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vY = wp.y;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uDraw;
      uniform float uCut;
      uniform float uBand;
      varying float vT;
      varying float vOrder;
      varying float vY;
      void main() {
        const float SPAN = 0.3;
        float local = clamp((uDraw * (1.0 + SPAN) - vOrder) / SPAN, 0.0, 1.0);
        if (vT > local) discard;
        float above = smoothstep(uCut - uBand, uCut + uBand * 0.25, vY);
        // Đầu bút sáng hơn khi nét đang được vẽ.
        float tip = (1.0 - step(0.999, local)) * smoothstep(local - 0.08, local, vT);
        gl_FragColor = vec4(uColor * (1.0 + tip * 1.5), uOpacity * above * (0.7 + tip * 0.3));
        #include <colorspace_fragment>
      }
    `,
  })
}

function createGhostMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: LINE_COLOR.clone() }, uOpacity: { value: 0 }, uCut: { value: SCAN.min }, uBand: { value: 0.06 } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying float vY;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec4 mv = viewMatrix * wp;
        vY = wp.y;
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uCut;
      uniform float uBand;
      varying vec3 vN;
      varying vec3 vV;
      varying float vY;
      void main() {
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float a = pow(f, 4.0) * 0.5 + 0.015;
        float above = smoothstep(uCut - uBand, uCut + uBand * 0.25, vY);
        gl_FragColor = vec4(uColor, a * uOpacity * above);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
}

/** Patch vật liệu PBR: discard phía trên mặt quét, mép cắt phát sáng; tuỳ chọn rung màng loa (uPulse). */
function patchSolid(mat: THREE.Material, u: Record<string, THREE.IUniform>, pulse: boolean) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec3 vScanW;${pulse ? '\nuniform float uPulse;\nuniform vec3 uPulseCenter;' : ''}`,
      )
      .replace(
        '#include <begin_vertex>',
        pulse
          ? `#include <begin_vertex>\n{ float rr = length(transformed.xy - uPulseCenter.xy); transformed.z += uPulse * 0.03 * smoothstep(0.46, 0.04, rr); }`
          : '#include <begin_vertex>',
      )
      .replace('#include <project_vertex>', '#include <project_vertex>\nvScanW = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vScanW;\nuniform float uCut;\nuniform float uBand;\nuniform vec3 uEdge;',
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        float scanN = sin(vScanW.x * 11.0 + vScanW.z * 7.0) * 0.6 + sin(vScanW.x * 27.0 - vScanW.z * 19.0) * 0.4;
        float cutY = uCut + scanN * 0.016;
        if (vScanW.y > cutY) discard;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `float edgeD = cutY - vScanW.y;
        outgoingLight += uEdge * (smoothstep(uBand * 0.35, 0.0, edgeD) * 2.5 + smoothstep(uBand * 5.0, 0.0, edgeD) * 0.18);
        #include <opaque_fragment>`,
      )
  }
  mat.customProgramCacheKey = () => (pulse ? 'scan-pulse' : 'scan')
}

export class PartRig {
  private readonly solids: THREE.Material[] = []
  private ghost = createGhostMaterial()
  private lines = createLineMaterial()
  private overlays: THREE.Object3D[] = []
  private uniforms = { uCut: { value: SCAN.max }, uBand: { value: 0.05 }, uEdge: { value: EDGE_COLOR.clone() } }
  /** true khi bộ phận có phần nào đang hiển thị (dùng khi đo khung bao). */
  shown = true
  /** Điểm mẫu (không gian local của mesh) để tính khung bao trên màn hình khi debug. */
  readonly samples: { mesh: THREE.Mesh; points: THREE.Vector3[] }[] = []

  /** Một bộ phận chỉ có một rig (StrictMode có thể gọi hai lần trên cùng object). */
  static of(object: THREE.Object3D, shared: Shared): PartRig {
    return (object.userData.partRig as PartRig | undefined) ?? new PartRig(object, shared)
  }

  private constructor(object: THREE.Object3D, shared: Shared) {
    object.userData.partRig = this
    const meshes: THREE.Mesh[] = []
    object.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !o.userData.overlay) meshes.push(o as THREE.Mesh)
    })
    let seed = 1
    for (const mesh of meshes) {
      const src = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const cloned = src.map((m) => {
        const c = m.clone()
        c.transparent = false
        const pulse = !!m.userData.pulse
        patchSolid(c, pulse ? { ...this.uniforms, ...shared } : this.uniforms, pulse)
        return c
      })
      mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]
      this.solids.push(...cloned)

      const ghost = new THREE.Mesh(mesh.geometry, this.ghost)
      ghost.name = `${mesh.name}_ghost`
      ghost.renderOrder = 2
      const edges = new THREE.LineSegments(withDrawAttributes(new THREE.EdgesGeometry(mesh.geometry, 35), seed++), this.lines)
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

  /** reveal: 0 = toàn nét, 1 = toàn vật liệu. lines: độ đậm nét. draw: tiến độ "tự vẽ" nét 0..1. */
  set(reveal: number, lines: number, draw: number) {
    const r = THREE.MathUtils.clamp(reveal, 0, 1)
    const cut = THREE.MathUtils.lerp(SCAN.min, SCAN.max, r)
    this.uniforms.uCut.value = cut
    this.ghost.uniforms.uCut.value = cut
    this.lines.uniforms.uCut.value = cut
    const solidOn = r > 0.001
    for (const m of this.solids) m.visible = solidOn
    const l = r < 0.999 ? lines : 0
    this.ghost.uniforms.uOpacity.value = l
    this.lines.uniforms.uOpacity.value = l * 0.9
    this.lines.uniforms.uDraw.value = draw
    const overlayOn = l > 0.002 && draw > 0.001
    for (const o of this.overlays) o.visible = overlayOn
    this.shown = solidOn || overlayOn
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
