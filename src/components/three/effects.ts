import * as THREE from 'three'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'

/** Màu nhấn ấm (champagne) dùng chung cho mép quét, sóng sàn, bụi. */
export const ACCENT = new THREE.Color(0xd9b98a)

/**
 * Môi trường studio dựng bằng code: một softbox lớn phía trên-trái (nguồn sáng chính),
 * một dải rim mảnh phía sau-phải và một tấm hắt sáng yếu phía dưới. Tạo vệt phản chiếu dài
 * kiểu chụp sản phẩm trên nhôm/clearcoat thay vì ánh sáng "mặc định" đều khắp.
 */
export function createStudioEnvironment() {
  const scene = new THREE.Scene()
  const geo = new THREE.PlaneGeometry(1, 1)
  const panel = (w: number, h: number, intensity: number, color: number, pos: [number, number, number]) => {
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
    m.color.multiplyScalar(intensity)
    const mesh = new THREE.Mesh(geo, m)
    mesh.scale.set(w, h, 1)
    mesh.position.set(...pos)
    mesh.lookAt(0, 0, 0)
    scene.add(mesh)
    return mesh
  }
  panel(5, 2.6, 6, 0xfff4ea, [3, 5, 3.5]) // softbox chính (trung tính, trên-phải; sắc ấm do key light)
  panel(0.35, 5, 7, 0x9fb3ff, [-4.5, -0.8, -3]) // rim lạnh, thấp
  panel(0.25, 3, 2.2, 0xffffff, [4, 0.5, 3]) // kicker cho viền nhôm
  panel(10, 10, 0.12, 0xf2f0ee, [0, -6, 0]) // hắt sáng sàn
  return {
    scene,
    dispose: () => {
      geo.dispose()
      scene.traverse((o) => ((o as THREE.Mesh).material as THREE.Material | undefined)?.dispose())
    },
  }
}

/**
 * Lớp nền full-screen trong suốt: chỉ có lưới bản vẽ (cảnh kỹ thuật), mờ dần ở mép. Một draw call.
 */
export function createBackdrop() {
  const material = new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    transparent: true,
    premultipliedAlpha: true,
    uniforms: {
      uRes: { value: new THREE.Vector2(1, 1) },
      uDpr: { value: 1 },
      uGrid: { value: 0 },
      uGridColor: { value: new THREE.Color(0x6f8fb3) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec2 uRes;
      uniform float uDpr;
      uniform float uGrid;
      uniform vec3 uGridColor;
      varying vec2 vUv;
      float gridLine(vec2 px, float size) {
        vec2 g = abs(fract(px / size - 0.5) - 0.5) * size;
        return 1.0 - smoothstep(0.0, 1.0, min(g.x, g.y));
      }
      void main() {
        // Nền trong suốt (màu navy đến từ trang); chỉ vẽ lưới bản vẽ ở cảnh kỹ thuật.
        vec2 px = vUv * uRes / uDpr;
        float aspect = uRes.x / uRes.y;
        float vig = smoothstep(1.1, 0.25, length((vUv - 0.5) * vec2(aspect, 1.0)));
        float a = (gridLine(px, 24.0) * 0.06 + gridLine(px, 120.0) * 0.14) * uGrid * vig * 0.5;
        gl_FragColor = vec4(uGridColor * a, a);
      }
    `,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  mesh.frustumCulled = false
  mesh.renderOrder = -10
  mesh.name = 'Backdrop'
  return { mesh, material }
}

/**
 * Sàn cảnh kết: phản chiếu thật (Reflector, nửa độ phân giải), gợn sóng âm làm méo ảnh phản chiếu,
 * blur tăng theo khoảng cách, bóng tiếp xúc giải tích. Chỉ render khi đang hiển thị.
 */
export function createReflectiveFloor(footprint: { w: number; d: number }) {
  const shader = {
    name: 'SoundFloor',
    uniforms: {
      color: { value: null },
      tDiffuse: { value: null },
      textureMatrix: { value: null },
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uPulse: { value: 0 },
      uFoot: { value: new THREE.Vector2(footprint.w / 2, footprint.d / 2) },
      uAccent: { value: ACCENT.clone() },
    },
    vertexShader: /* glsl */ `
      uniform mat4 textureMatrix;
      varying vec4 vUvR;
      varying vec2 vP;
      void main() {
        vP = position.xy;
        vUvR = textureMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uPulse;
      uniform vec2 uFoot;
      uniform vec3 uAccent;
      varying vec4 vUvR;
      varying vec2 vP;
      float sdRoundBox(vec2 p, vec2 b, float r) {
        vec2 q = abs(p) - b + r;
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
      }
      void main() {
        float d = sdRoundBox(vP, uFoot, 0.2);
        float r = length(vP);
        float ph = d * 9.0 - uTime * 2.6;
        float amp = uPulse * exp(-max(d, 0.0) * 0.7) * smoothstep(0.0, 0.3, d);
        vec2 dir = normalize(vP + 1e-4);
        vec4 uvr = vUvR;
        uvr.xy += dir * cos(ph) * amp * 0.02 * uvr.w;
        float b = (0.004 + max(d, 0.0) * 0.006) * uvr.w;
        vec3 refl = texture2DProj(tDiffuse, uvr).rgb * 0.36;
        refl += texture2DProj(tDiffuse, uvr + vec4( b, 0.0, 0.0, 0.0)).rgb * 0.16;
        refl += texture2DProj(tDiffuse, uvr + vec4(-b, 0.0, 0.0, 0.0)).rgb * 0.16;
        refl += texture2DProj(tDiffuse, uvr + vec4(0.0,  b, 0.0, 0.0)).rgb * 0.16;
        refl += texture2DProj(tDiffuse, uvr + vec4(0.0, -b, 0.0, 0.0)).rgb * 0.16;
        float shadow = 1.0 - smoothstep(-0.05, 0.8, d);
        vec3 col = vec3(0.0021, 0.0033, 0.0144) + refl * 0.5; // navy #070b20 (tuyến tính)
        col *= 1.0 - shadow * 0.85;
        float crest = pow(max(sin(ph), 0.0), 28.0) * amp;
        col += uAccent * crest * 0.22;
        col += uAccent * 0.018 * smoothstep(1.4, 0.0, d) * (1.0 - shadow);
        float fade = smoothstep(4.6, 0.9, r);
        gl_FragColor = vec4(col, max(fade, shadow) * uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }
  const mesh = new Reflector(new THREE.PlaneGeometry(10, 10), {
    shader,
    textureWidth: 512,
    textureHeight: 512,
    clipBias: 0.003,
    multisample: 0,
  })
  const material = mesh.material as THREE.ShaderMaterial
  material.transparent = true
  material.depthWrite = false
  mesh.rotation.x = -Math.PI / 2
  mesh.renderOrder = -1
  mesh.name = 'Floor'
  return { mesh, material }
}

/**
 * Vệt sáng từ softbox + bụi lơ lửng bắt sáng. Phục vụ không khí studio ở hero và cảnh kết;
 * 1 hình nón + 500 điểm, 2 draw call, tắt hẳn ở các cảnh kỹ thuật.
 */
export function createAtmosphere() {
  const shaftMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0xfff1dc) } },
    vertexShader: /* glsl */ `
      varying float vH;
      varying float vFacing;
      void main() {
        vH = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uColor;
      varying float vH;
      varying float vFacing;
      void main() {
        float a = pow(vFacing, 3.0) * smoothstep(0.0, 0.35, vH) * smoothstep(1.0, 0.55, vH);
        gl_FragColor = vec4(uColor, a * 0.05 * uOpacity);
        #include <colorspace_fragment>
      }
    `,
  })
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.7, 7, 40, 1, true), shaftMat)
  shaft.position.set(-1.1, 2.2, 0.9)
  shaft.rotation.z = -0.38
  shaft.rotation.x = 0.28
  shaft.name = 'LightShaft'

  const COUNT = 500
  const pos = new Float32Array(COUNT * 3)
  const seed = new Float32Array(COUNT)
  let s = 5
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
  for (let i = 0; i < COUNT; i++) {
    const a = rnd() * Math.PI * 2
    const rr = Math.sqrt(rnd()) * 1.5
    pos[i * 3] = Math.cos(a) * rr - 0.3
    pos[i * 3 + 1] = rnd() * 4 - 1.3
    pos[i * 3 + 2] = Math.sin(a) * rr + 0.2
    seed[i] = rnd()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  const dustMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uDpr: { value: 1 }, uColor: { value: new THREE.Color(0xffe9c9) } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uDpr;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float t = uTime * (0.05 + aSeed * 0.05);
        p.y = mod(p.y + 1.3 + t, 4.0) - 1.3;
        p.x += sin(uTime * 0.3 + aSeed * 40.0) * 0.08;
        p.z += cos(uTime * 0.25 + aSeed * 30.0) * 0.08;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (1.2 + aSeed * 2.2) * uDpr * (6.0 / -mv.z);
        // Sáng hơn khi nằm trong vệt sáng (trên-trái), mờ dần ở hai đầu.
        float inBeam = smoothstep(1.8, 0.2, length(p.xz - vec2(-0.6 - p.y * 0.25, 0.4)));
        float ends = smoothstep(-1.3, -0.6, p.y) * smoothstep(2.7, 1.6, p.y);
        float twinkle = 0.6 + 0.4 * sin(uTime * (0.8 + aSeed) + aSeed * 20.0);
        vAlpha = inBeam * ends * twinkle;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(uColor, a * vAlpha * uOpacity * 0.55);
        #include <colorspace_fragment>
      }
    `,
  })
  const dust = new THREE.Points(g, dustMat)
  dust.frustumCulled = false
  dust.name = 'Dust'
  const group = new THREE.Group()
  group.add(shaft, dust)
  return {
    group,
    set(opacity: number, time: number, dpr: number) {
      shaftMat.uniforms.uOpacity.value = opacity
      dustMat.uniforms.uOpacity.value = opacity
      dustMat.uniforms.uTime.value = time
      dustMat.uniforms.uDpr.value = dpr
      group.visible = opacity > 0.002
    },
    dispose() {
      shaftMat.dispose()
      dustMat.dispose()
      shaft.geometry.dispose()
      g.dispose()
    },
  }
}
