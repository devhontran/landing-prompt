/**
 * Wordmark cuối trang vẽ bằng WebGL trên canvas dùng chung.
 *  - Hiện ra từ NÉT VIỀN sang CHỮ ĐẶC bằng mặt quét có mép sáng ấm (motif của cả trang).
 *  - Di chuột lên chữ: sóng âm lan ra từ con trỏ, làm chữ gợn như mặt nước.
 *  - Khi đứng yên: "nhịp loa" phát sóng đều đặn từ tâm.
 */
import * as THREE from 'three'
import type { Layer } from './bus'

const MAX_RIPPLES = 8

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const fragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uReveal;
  uniform float uTime;
  uniform float uAspect;
  uniform vec4 uRip[${MAX_RIPPLES}];
  uniform vec3 uColor;
  uniform vec3 uStroke;
  uniform vec3 uAccent;
  varying vec2 vUv;
  void main() {
    vec2 disp = vec2(0.0);
    float crest = 0.0;
    for (int i = 0; i < ${MAX_RIPPLES}; i++) {
      vec4 r = uRip[i];
      float age = uTime - r.z;
      if (r.w <= 0.0 || age < 0.0 || age > 3.2) continue;
      vec2 d = (vUv - r.xy) * vec2(uAspect, 1.0);
      float dist = length(d);
      float front = age * 0.55;
      float band = smoothstep(0.22, 0.0, abs(dist - front));
      float wave = sin((dist - front) * 60.0) * band * exp(-age * 1.1) * r.w;
      disp += normalize(d + 1e-5) / vec2(uAspect, 1.0) * wave * 0.012;
      crest += max(wave, 0.0);
    }
    vec4 t = texture2D(uMap, vUv + disp);
    float fill = t.r;
    float stroke = t.g;
    float cut = uReveal * 1.25 - 0.1;
    float solid = smoothstep(cut + 0.004, cut - 0.004, vUv.y);
    float edge = smoothstep(0.045, 0.0, abs(vUv.y - cut)) * (1.0 - step(1.1, cut));
    vec3 col = mix(uStroke * stroke, uColor * fill, solid);
    col += uAccent * edge * fill * 2.0;
    col += uAccent * min(crest, 1.0) * fill * 0.9;
    float a = max(fill * solid, stroke * (1.0 - solid) * 0.55) + edge * fill;
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
    #include <colorspace_fragment>
  }
`

export class FooterLayer implements Layer {
  reveal = 0
  pointer: { x: number; y: number } | null = null
  visible = false
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10)
  private mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  private texture: THREE.CanvasTexture | null = null
  private ripples = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -10, 0))
  private next = 0
  private last = { x: -1e4, y: -1e4 }
  private beat = 0
  private size = { w: 0, h: 0 }

  constructor(private el: HTMLElement) {
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uMap: { value: null },
          uReveal: { value: 0 },
          uTime: { value: 0 },
          uAspect: { value: 1 },
          uRip: { value: this.ripples },
          uColor: { value: new THREE.Color(0xf2f1ee) },
          uStroke: { value: new THREE.Color(0xb9b7b0) },
          uAccent: { value: new THREE.Color(0xd9b98a) },
        },
      }),
    )
    this.mesh.frustumCulled = false
    this.scene.add(this.mesh)
    this.build()
  }

  /** Vẽ chữ vào texture: kênh R = chữ đặc, kênh G = nét viền. Căn baseline khớp với DOM. */
  build() {
    const r = this.el.getBoundingClientRect()
    if (!r.width) return
    const cs = getComputedStyle(this.el)
    const dpr = Math.min(window.devicePixelRatio, 2)
    const c = document.createElement('canvas')
    c.width = Math.ceil(r.width * dpr)
    c.height = Math.ceil(r.height * dpr)
    const g = c.getContext('2d')!
    const fontSize = parseFloat(cs.fontSize)
    g.font = `${cs.fontWeight} ${fontSize * dpr}px ${cs.fontFamily}`
    const ls = parseFloat(cs.letterSpacing)
    if ('letterSpacing' in g && Number.isFinite(ls)) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${ls * dpr}px`
    const m = g.measureText(this.el.textContent ?? '')
    const A = m.fontBoundingBoxAscent
    const D = m.fontBoundingBoxDescent
    const lh = parseFloat(cs.lineHeight) * dpr || fontSize * dpr
    const baseline = (lh - (A + D)) / 2 + A
    const x = parseFloat(cs.paddingLeft) * dpr
    const text = this.el.textContent ?? ''
    g.globalCompositeOperation = 'lighter'
    g.fillStyle = 'rgb(255,0,0)'
    g.fillText(text, x, baseline)
    g.strokeStyle = 'rgb(0,255,0)'
    g.lineWidth = 1.3 * dpr
    g.strokeText(text, x, baseline)
    this.texture?.dispose()
    this.texture = new THREE.CanvasTexture(c)
    this.texture.colorSpace = THREE.NoColorSpace
    this.texture.minFilter = THREE.LinearFilter
    this.texture.generateMipmaps = false
    this.mesh.material.uniforms.uMap.value = this.texture
    this.size = { w: r.width, h: r.height }
  }

  private spawn(x: number, y: number, amp: number, time: number) {
    this.ripples[this.next].set(x, y, time, amp)
    this.next = (this.next + 1) % MAX_RIPPLES
  }

  render(gl: THREE.WebGLRenderer, W: number, H: number, dt: number) {
    const r = this.el.getBoundingClientRect()
    this.visible = r.bottom > 0 && r.top < H
    if (!this.visible || !this.texture) return false
    if (Math.abs(r.width - this.size.w) > 1) this.build()
    const u = this.mesh.material.uniforms
    const time = (u.uTime.value as number) + Math.min(dt, 1 / 20)
    u.uTime.value = time
    u.uReveal.value = this.reveal
    u.uAspect.value = r.width / r.height

    // Sóng theo con trỏ (khi di chuyển đủ xa) + nhịp loa đều đặn từ tâm.
    const p = this.pointer
    if (p && p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom && Math.hypot(p.x - this.last.x, p.y - this.last.y) > 70) {
      this.last = { x: p.x, y: p.y }
      this.spawn((p.x - r.left) / r.width, 1 - (p.y - r.top) / r.height, 1, time)
    }
    this.beat += dt
    if (this.beat > 2.4 && this.reveal > 0.95) {
      this.beat = 0
      this.spawn(0.5, 0.55, 0.45, time)
    }

    const cam = this.camera
    cam.left = 0
    cam.right = W
    cam.top = 0
    cam.bottom = -H
    cam.updateProjectionMatrix()
    this.mesh.position.set(r.left + r.width / 2, -(r.top + r.height / 2), 0)
    this.mesh.scale.set(r.width, r.height, 1)
    gl.render(this.scene, cam)
    return true
  }

  dispose() {
    this.texture?.dispose()
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}
