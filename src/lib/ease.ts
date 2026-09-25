/** Easing DUY NHẤT của trang: cubic-bezier(0.7, 0, 0.3, 1) — dùng chung cho GSAP, three.js và CSS (--ease). */
export const EASE = [0.7, 0, 0.3, 1] as const

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t
  const sy = (t: number) => ((ay * t + by) * t + cy) * t
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x
      const d = dx(t)
      if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break
      t -= e / d
    }
    return sy(Math.min(1, Math.max(0, t)))
  }
}

export const ease = bezier(...EASE)
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
/** Tiến độ tuyến tính của v trong [a, b] rồi áp easing. */
export const seg = (v: number, a: number, b: number) => ease(clamp01((v - a) / (b - a)))
