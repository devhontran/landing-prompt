/**
 * Chọn chế độ trải nghiệm.
 * - '3d'    : desktop, con trỏ chính xác, không yêu cầu giảm chuyển động, có WebGL2.
 * - 'static': mobile/tablet, giảm chuyển động, tiết kiệm dữ liệu, hoặc không có WebGL → ảnh tĩnh, không tải three.js.
 * Truy vấn này phải trùng với khối @media trong globals.css (bố cục được CSS quyết định ngay từ lần vẽ đầu → không CLS).
 */
export const DESKTOP_3D_QUERY =
  '(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'

export type ExperienceMode = '3d' | 'static'

let webgl: boolean | null = null
function hasWebGL2() {
  if (webgl !== null) return webgl
  try {
    const c = document.createElement('canvas')
    webgl = !!c.getContext('webgl2', { failIfMajorPerformanceCaveat: false })
  } catch {
    webgl = false
  }
  return webgl
}

export function detectMode(): ExperienceMode {
  const params = new URLSearchParams(window.location.search)
  if (params.has('static')) return 'static'
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (conn?.saveData) return 'static'
  if (!window.matchMedia(DESKTOP_3D_QUERY).matches) return 'static'
  return hasWebGL2() ? '3d' : 'static'
}

export function subscribeMode(cb: () => void) {
  const mq = window.matchMedia(DESKTOP_3D_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

export const isDebug = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')
