/**
 * Lớp gallery vẽ trên canvas WebGL dùng chung (xem webgl/bus.ts) — không có renderer riêng.
 * Mỗi ô DOM có một plane cùng vị trí (toạ độ pixel cửa sổ). Chuyển động:
 *  - offset = kéo chuột + cuộn trang (section được ghim, cuộn dọc → trượt ngang), đuổi theo bằng damping;
 *  - vận tốc → uốn tấm ảnh + gợn như lụa; con trỏ → phóng nhẹ quanh điểm hover;
 *  - ô hiện ra bằng "mặt quét" có mép sáng ấm — cùng motif với phần kể chuyện 3D.
 * Chỉ được import động ở chế độ desktop 3D.
 */
import * as THREE from 'three'
import type { Layer } from '../webgl/bus'
import { PATTERN, wrapX } from './layout'

const vertex = /* glsl */ `
  uniform float uVel;
  uniform vec2 uView;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    float nx = clamp((world.x - uView.x * 0.5) / (uView.x * 0.5), -1.2, 1.2);
    world.x -= sin(uv.y * 3.14159) * uVel * 34.0;
    world.y += (1.0 - nx * nx) * abs(uVel) * 30.0;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`
const fragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uCover;
  uniform float uVel;
  uniform float uReady;
  uniform vec2 uSize;
  uniform float uPar;
  uniform float uReveal;
  uniform float uHover;
  uniform vec2 uMouse;
  uniform vec3 uEdge;
  varying vec2 vUv;
  float roundedMask(vec2 uv, vec2 size, float r) {
    vec2 p = (uv - 0.5) * size;
    vec2 q = abs(p) - size * 0.5 + r;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
    return 1.0 - smoothstep(-1.0, 0.5, d);
  }
  void main() {
    // Mặt quét đi từ đáy lên, mép sáng ấm.
    float cut = uReveal * 1.08;
    if (vUv.y > cut) discard;
    float edge = smoothstep(0.03, 0.0, cut - vUv.y) * (1.0 - step(1.0, uReveal));

    float v = clamp(uVel, -1.0, 1.0);
    float zoom = 0.86 - abs(v) * 0.04 - uHover * 0.05 + (1.0 - uReveal) * 0.1;
    vec2 uv = (vUv - 0.5) * uCover * zoom + 0.5;
    uv += (uMouse - 0.5) * uHover * 0.035 * uCover;
    uv.x += uPar * 0.06 * uCover.x;
    uv.y += sin(vUv.x * 3.14159) * v * 0.018;
    vec3 col = texture2D(uMap, uv).rgb;
    col *= (1.0 - abs(v) * 0.12) * (1.0 + uHover * 0.08);
    col = mix(vec3(0.0045), vec3(1.0), col);
    col += uEdge * edge * 1.6;
    gl_FragColor = vec4(col, uReady * roundedMask(vUv, uSize, 10.0));
    #include <colorspace_fragment>
  }
`

type Tile = { li: HTMLLIElement; mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>; imageIndex: number; hover: number }

export class GalleryLayer implements Layer {
  /** Offset (đơn vị = chiều cao vùng xem): đích từ kéo/phím, phần từ cuộn trang, giá trị đang hiển thị. */
  target = 0
  scroll = 0
  current = 0
  /** Tiến độ hiện ô (0..1) theo cuộn. */
  reveal = 0
  private vel = 0
  private prev = 0
  private H = 1
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10)
  private geometry = new THREE.PlaneGeometry(1, 1, 24, 24)
  private tiles: Tile[] = []
  private textures: (THREE.Texture | null)[] = []
  private aspects: number[] = []
  private view = { value: new THREE.Vector2(1, 1) }
  private velU = { value: 0 }
  private edge = { value: new THREE.Color(1.0, 0.66, 0.38) }
  onTexturesReady?: () => void

  constructor(
    private viewport: HTMLElement,
    lis: HTMLLIElement[],
    private images: HTMLImageElement[],
  ) {
    this.textures = images.map(() => null)
    lis.forEach((li, k) => {
      const mat = new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uMap: { value: null },
          uCover: { value: new THREE.Vector2(1, 1) },
          uVel: this.velU,
          uView: this.view,
          uReady: { value: 0 },
          uSize: { value: new THREE.Vector2(1, 1) },
          uPar: { value: 0 },
          uReveal: { value: 0 },
          uHover: { value: 0 },
          uMouse: { value: new THREE.Vector2(0.5, 0.5) },
          uEdge: this.edge,
        },
      })
      const mesh = new THREE.Mesh(this.geometry, mat)
      mesh.visible = false
      mesh.frustumCulled = false
      this.scene.add(mesh)
      this.tiles.push({ li, mesh, imageIndex: k % images.length, hover: 0 })
    })
    this.layout()
    this.loadTextures()
  }

  layout() {
    this.H = this.viewport.clientHeight
    this.tiles.forEach((t, k) => {
      const s = PATTERN[k % PATTERN.length]
      t.li.style.width = `${s.w * this.H}px`
      t.li.style.height = `${s.h * this.H}px`
    })
  }

  /** Texture lấy từ chính thẻ <img> đã tải (chụp thành ImageBitmap để không lệch khi đổi srcset). */
  private loadTextures() {
    let loaded = 0
    this.images.forEach((img, i) => {
      const make = async () => {
        if (this.textures[i] || !img.naturalWidth) return
        let tex: THREE.Texture
        try {
          const bmp = await createImageBitmap(img, { imageOrientation: 'flipY' })
          tex = new THREE.Texture(bmp)
          tex.flipY = false
        } catch {
          tex = new THREE.Texture(img)
        }
        if (this.textures[i]) return
        tex.colorSpace = THREE.SRGBColorSpace
        tex.minFilter = THREE.LinearMipmapLinearFilter
        tex.anisotropy = 4
        tex.needsUpdate = true
        this.aspects[i] = img.naturalWidth / img.naturalHeight
        this.textures[i] = tex
        if (++loaded === this.images.length) this.onTexturesReady?.()
      }
      if (img.complete && img.naturalWidth) img.decode().then(make, make)
      else img.addEventListener('load', () => img.decode().then(make, make), { once: true })
    })
  }

  render(gl: THREE.WebGLRenderer, W: number, H: number, dt: number) {
    const r = this.viewport.getBoundingClientRect()
    const onScreen = r.bottom > -40 && r.top < H + 40
    const goal = this.target + this.scroll
    const d = Math.min(dt, 1 / 20)
    this.current += (goal - this.current) * (1 - Math.exp(-d * 8))
    const inst = (this.current - this.prev) / Math.max(d, 1e-3)
    this.prev = this.current
    this.vel += (inst - this.vel) * 0.18
    const moving = Math.abs(goal - this.current) > 1e-4 || Math.abs(this.vel) > 0.003
    if (!moving) this.vel = 0
    if (!onScreen) return false

    const cam = this.camera
    cam.left = 0
    cam.right = W
    cam.top = 0
    cam.bottom = -H
    cam.updateProjectionMatrix()
    this.view.value.set(W, H)
    this.velU.value = THREE.MathUtils.clamp(this.vel * 0.4, -1, 1)
    const Hh = this.H
    const px = { x: -1e4, y: -1e4 }
    const { pointer } = this
    if (pointer) {
      px.x = pointer.x
      px.y = pointer.y
    }
    let hovering = false
    this.tiles.forEach((t, k) => {
      const s = PATTERN[k % PATTERN.length]
      const x = wrapX(s.x, Math.floor(k / PATTERN.length), this.current) * Hh
      const y = s.y * Hh
      const w = s.w * Hh
      const h = s.h * Hh
      t.li.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      // Ô bên trái hiện trước — mặt quét lan theo chiều đọc.
      const order = THREE.MathUtils.clamp(x / r.width, 0, 1)
      const tr = THREE.MathUtils.clamp((this.reveal * 1.6 - order * 0.6) / 1.0, 0, 1)
      t.li.style.opacity = tr > 0.98 ? '' : String(tr)
      const tex = this.textures[t.imageIndex]
      const left = r.left + x
      const top = r.top + y
      const visible = !!tex && left + w > -60 && left < W + 60 && tr > 0.001
      t.mesh.visible = visible
      if (!visible || !tex) return
      const inside = px.x >= left && px.x <= left + w && px.y >= top && px.y <= top + h
      t.hover += ((inside ? 1 : 0) - t.hover) * (1 - Math.exp(-d * 7))
      if (Math.abs(t.hover - (inside ? 1 : 0)) > 0.002) hovering = true
      const u = t.mesh.material.uniforms
      if (inside) u.uMouse.value.set((px.x - left) / w, 1 - (px.y - top) / h)
      t.mesh.position.set(left + w / 2, -(top + h / 2), 0)
      t.mesh.scale.set(w, h, 1)
      u.uMap.value = tex
      u.uReady.value = 1
      u.uSize.value.set(w, h)
      u.uReveal.value = tr
      u.uHover.value = t.hover
      u.uPar.value = THREE.MathUtils.clamp(((left + w / 2) / W) * 2 - 1, -1.3, 1.3)
      const imgAspect = this.aspects[t.imageIndex] || 0.8
      const tileAspect = w / h
      if (imgAspect > tileAspect) u.uCover.value.set(tileAspect / imgAspect, 1)
      else u.uCover.value.set(1, imgAspect / tileAspect)
    })
    gl.render(this.scene, cam)
    return moving || hovering
  }

  /** Vị trí con trỏ (px cửa sổ) do bus cung cấp. */
  pointer: { x: number; y: number } | null = null

  dispose() {
    this.tiles.forEach((t) => {
      t.mesh.material.dispose()
      t.li.style.transform = ''
      t.li.style.width = ''
      t.li.style.height = ''
      t.li.style.opacity = ''
    })
    this.geometry.dispose()
    this.textures.forEach((t) => {
      t?.dispose()
      ;(t?.image as ImageBitmap | undefined)?.close?.()
    })
  }
}
