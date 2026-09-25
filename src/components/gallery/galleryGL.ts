/**
 * Lớp WebGL của gallery (three.js thuần, không R3F để giữ nhẹ):
 * mỗi ô DOM có một plane cùng vị trí; shader uốn cong + tách kênh màu theo vận tốc kéo.
 * Chỉ được import động ở chế độ desktop 3D.
 */
import * as THREE from 'three'

const vertex = /* glsl */ `
  uniform float uVel;
  uniform vec2 uView;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    float nx = clamp(world.x / (uView.x * 0.5), -1.2, 1.2);
    // Tấm ảnh "trễ" ở giữa khi kéo + cả dải cong nhẹ theo vận tốc.
    world.x -= sin(uv.y * 3.14159) * uVel * 28.0;
    world.y -= (1.0 - nx * nx) * abs(uVel) * 26.0;
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
  varying vec2 vUv;
  float roundedMask(vec2 uv, vec2 size, float r) {
    vec2 p = (uv - 0.5) * size;
    vec2 q = abs(p) - size * 0.5 + r;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
    return 1.0 - smoothstep(-1.0, 0.5, d);
  }
  void main() {
    // Parallax trong khung: ảnh phóng 1/0.86 và trượt ngược hướng theo vị trí ô trên màn hình (uPar),
    // khi kéo nhanh ảnh co nhẹ và gợn như tấm lụa theo vận tốc — không tách kênh màu.
    float v = clamp(uVel, -1.0, 1.0);
    float zoom = 0.86 - abs(v) * 0.04;
    vec2 uv = (vUv - 0.5) * uCover * zoom + 0.5;
    uv.x += uPar * 0.06 * uCover.x;
    uv.y += sin(vUv.x * 3.14159) * v * 0.018;
    vec3 col = texture2D(uMap, uv).rgb;
    col *= 1.0 - abs(v) * 0.12;
    // Nâng nhẹ vùng đen để ô ảnh tách khỏi nền trang.
    col = mix(vec3(0.0045), vec3(1.0), col);
    gl_FragColor = vec4(col, uReady * roundedMask(vUv, uSize, 14.0));
    #include <colorspace_fragment>
  }
`

export type Tile = { el: HTMLElement; imageIndex: number }

export class GalleryGL {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10)
  private geometry = new THREE.PlaneGeometry(1, 1, 24, 24)
  private meshes: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>[] = []
  private textures: (THREE.Texture | null)[] = []
  private aspects: number[] = []
  private uniformsVel = { value: 0 }
  private uniformsView = { value: new THREE.Vector2(1, 1) }
  width = 1
  height = 1

  constructor(
    private canvas: HTMLCanvasElement,
    private images: HTMLImageElement[],
    tileCount: number,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.textures = images.map(() => null)
    for (let i = 0; i < tileCount; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        uniforms: {
          uMap: { value: null },
          uCover: { value: new THREE.Vector2(1, 1) },
          uVel: this.uniformsVel,
          uView: this.uniformsView,
          uReady: { value: 0 },
          uSize: { value: new THREE.Vector2(1, 1) },
          uPar: { value: 0 },
        },
      })
      const m = new THREE.Mesh(this.geometry, mat)
      m.visible = false
      this.meshes.push(m)
      this.scene.add(m)
    }
  }

  /**
   * Tạo texture từ chính thẻ <img> đã tải (không tải lại ảnh). Ảnh được chụp thành ImageBitmap
   * để texture không bị lệch kích thước khi trình duyệt đổi nguồn srcset.
   */
  loadTextures(onLoaded: () => void) {
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
        onLoaded()
      }
      if (img.complete && img.naturalWidth) img.decode().then(make, make)
      else img.addEventListener('load', () => img.decode().then(make, make), { once: true })
    })
  }

  resize(w: number, h: number) {
    this.width = w
    this.height = h
    this.renderer.setSize(w, h, false)
    this.camera.left = -w / 2
    this.camera.right = w / 2
    this.camera.top = h / 2
    this.camera.bottom = -h / 2
    this.camera.updateProjectionMatrix()
    this.uniformsView.value.set(w, h)
  }

  /** rect: vị trí ô (px, trong vùng xem). */
  render(rects: { x: number; y: number; w: number; h: number; imageIndex: number }[], velocity: number) {
    this.uniformsVel.value = velocity
    rects.forEach((r, i) => {
      const mesh = this.meshes[i]
      const tex = this.textures[r.imageIndex]
      const onScreen = r.x + r.w > -60 && r.x < this.width + 60
      mesh.visible = !!tex && onScreen
      if (!mesh.visible || !tex) return
      mesh.position.set(r.x + r.w / 2 - this.width / 2, this.height / 2 - (r.y + r.h / 2), 0)
      mesh.scale.set(r.w, r.h, 1)
      const u = mesh.material.uniforms
      u.uMap.value = tex
      u.uReady.value = 1
      u.uSize.value.set(r.w, r.h)
      u.uPar.value = THREE.MathUtils.clamp(((r.x + r.w / 2) / this.width) * 2 - 1, -1.3, 1.3)
      const imgAspect = this.aspects[r.imageIndex] || 0.8
      const tileAspect = r.w / r.h
      if (imgAspect > tileAspect) u.uCover.value.set(tileAspect / imgAspect, 1)
      else u.uCover.value.set(1, imgAspect / tileAspect)
    })
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.meshes.forEach((m) => m.material.dispose())
    this.geometry.dispose()
    this.textures.forEach((t) => {
      t?.dispose()
      ;(t?.image as ImageBitmap | undefined)?.close?.()
    })
    this.renderer.dispose()
  }
}
