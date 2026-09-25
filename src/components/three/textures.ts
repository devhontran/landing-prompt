/**
 * Texture thủ tục (canvas 2D → CanvasTexture), nhỏ gọn, không cần tải file:
 * - fluteNormal: gân dọc của kính (normal map, lặp theo trục U).
 * - brushedNormal: vệt phay xước dọc của nhôm.
 * - walnutMap: vân gỗ óc chó (minh hoạ — cần thay bằng texture quét thật khi có).
 */
import * as THREE from 'three'

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

/** Mulberry32 — ngẫu nhiên có hạt giống để ảnh render luôn giống nhau. */
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function fluteNormal(ribs = 28) {
  const W = 256
  const [c, g] = canvas(W, 4)
  const img = g.createImageData(W, 4)
  for (let x = 0; x < W; x++) {
    // Mỗi gân là nửa trụ: pháp tuyến nghiêng theo sin trong một chu kỳ.
    const u = ((x / W) * ribs) % 1
    const nx = Math.sin((u - 0.5) * Math.PI) * 0.85
    const nz = Math.sqrt(1 - nx * nx)
    for (let y = 0; y < 4; y++) {
      const i = (y * W + x) * 4
      img.data[i] = (nx * 0.5 + 0.5) * 255
      img.data[i + 1] = 128
      img.data[i + 2] = nz * 255
      img.data[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

export function brushedNormal() {
  const W = 256
  const H = 256
  const [c, g] = canvas(W, H)
  const img = g.createImageData(W, H)
  const r = rng(7)
  const cols = Array.from({ length: W }, () => (r() - 0.5) * 0.35)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const nx = cols[x] + (r() - 0.5) * 0.05
      const i = (y * W + x) * 4
      img.data[i] = (nx * 0.5 + 0.5) * 255
      img.data[i + 1] = 128
      img.data[i + 2] = 250
      img.data[i + 3] = 255
    }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

export function walnutMap() {
  const W = 256
  const H = 512
  const [c, g] = canvas(W, H)
  const r = rng(11)
  g.fillStyle = '#4a3222'
  g.fillRect(0, 0, W, H)
  // Thớ gỗ: các vệt dọc lượn nhẹ, đậm nhạt xen kẽ.
  for (let k = 0; k < 90; k++) {
    const x0 = r() * W
    const amp = 2 + r() * 10
    const freq = 1 + r() * 3
    const dark = r() > 0.45
    g.strokeStyle = dark ? `rgba(28,17,10,${0.2 + r() * 0.35})` : `rgba(122,84,54,${0.12 + r() * 0.2})`
    g.lineWidth = 0.6 + r() * 2.4
    g.beginPath()
    for (let y = 0; y <= H; y += 8) {
      const x = x0 + Math.sin((y / H) * Math.PI * 2 * freq + k) * amp
      if (y === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}
