import * as THREE from 'three'

/**
 * Sàn cảnh kết: bóng tiếp xúc tính giải tích (không cần shadow map) + các vòng sóng âm
 * lan ra từ chân loa. Chỉ một draw call, không texture.
 */
export function createFloor(footprint: { w: number; d: number }) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uFoot: { value: new THREE.Vector2(footprint.w / 2, footprint.d / 2) },
      uAccent: { value: new THREE.Color(0xd9b98a) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() {
        vP = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uOpacity;
      uniform vec2 uFoot;
      uniform vec3 uAccent;
      varying vec2 vP;
      float sdRoundBox(vec2 p, vec2 b, float r) {
        vec2 q = abs(p) - b + r;
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
      }
      void main() {
        vec2 p = vP;
        float r = length(p);
        float fade = smoothstep(5.2, 1.0, r);
        // nền sàn: xám ấm rất tối, mờ dần ra xa
        vec3 col = vec3(0.075, 0.074, 0.078);
        float alpha = 0.85 * fade;
        // bóng tiếp xúc
        float d = sdRoundBox(p, uFoot, 0.2);
        float shadow = 1.0 - smoothstep(-0.05, 0.9, d);
        col *= 1.0 - shadow * 0.85;
        alpha = max(alpha, shadow * 0.9);
        // vòng sóng: khoảng cách theo hình hộp bo tròn quanh chân loa
        float w = d - uTime * 0.35;
        float ring = abs(fract(w * 0.9) - 0.5);
        float line = smoothstep(0.03, 0.0, ring) * smoothstep(0.0, 0.4, d) * smoothstep(3.6, 0.6, d);
        col += uAccent * line * 0.35;
        // quầng sáng nhẹ quanh đế
        col += uAccent * 0.05 * smoothstep(1.6, 0.0, d) * (1.0 - shadow);
        gl_FragColor = vec4(col, alpha * uOpacity);
      }
    `,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(12, 12, 1, 1), material)
  mesh.rotation.x = -Math.PI / 2
  mesh.renderOrder = -1
  mesh.name = 'Floor'
  return { mesh, material }
}

/** Lưới bản vẽ kỹ thuật dạng full-screen (tọa độ pixel), vẽ trước mọi thứ. */
export function createBlueprintGrid() {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uOpacity: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uDpr: { value: 1 },
      uColor: { value: new THREE.Color(0x6f8fb3) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec2 uRes;
      uniform float uDpr;
      uniform vec3 uColor;
      varying vec2 vUv;
      float gridLine(vec2 px, float size, float width) {
        vec2 g = abs(fract(px / size - 0.5) - 0.5) * size;
        float m = min(g.x, g.y);
        return 1.0 - smoothstep(0.0, width, m);
      }
      void main() {
        vec2 px = vUv * uRes / uDpr;
        float minor = gridLine(px, 24.0, 1.0) * 0.07;
        float major = gridLine(px, 120.0, 1.0) * 0.16;
        vec2 c = vUv - 0.5;
        float vignette = smoothstep(0.85, 0.2, length(c * vec2(uRes.x / uRes.y, 1.0)));
        gl_FragColor = vec4(uColor, (minor + major) * vignette * uOpacity);
      }
    `,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  mesh.frustumCulled = false
  mesh.renderOrder = -10
  mesh.name = 'BlueprintGrid'
  return { mesh, material }
}
