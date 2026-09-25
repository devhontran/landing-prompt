/**
 * Kênh dùng chung giữa canvas WebGL toàn trang và các section DOM (chỉ ở chế độ 3D).
 * Một canvas cố định phủ toàn màn hình vẽ: cảnh loa (phối cảnh) → rồi các "lớp" 2D (gallery, wordmark footer)
 * bằng camera trực giao theo toạ độ pixel của cửa sổ. Nhờ vậy mọi section dùng chung ánh sáng, nền và nhịp chuyển động.
 */
import type * as THREE from 'three'

export type Layer = {
  /** Vẽ lớp; trả về true nếu cần frame tiếp theo. */
  render(gl: THREE.WebGLRenderer, W: number, H: number, dt: number): boolean
}

type Bus = {
  layers: Set<Layer>
  invalidate: () => void
  /** Con trỏ theo px cửa sổ (−1 khi chưa có). */
  pointer: { x: number; y: number }
  time: number
  scrollTo: (target: number | HTMLElement, opts?: { immediate?: boolean }) => void
}

export const bus: Bus = {
  layers: new Set(),
  invalidate: () => {},
  pointer: { x: -1, y: -1 },
  time: 0,
  scrollTo: (target) => {
    const y = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: y })
  },
}

export function addLayer(layer: Layer) {
  bus.layers.add(layer)
  bus.invalidate()
  return () => {
    bus.layers.delete(layer)
    bus.invalidate()
  }
}
