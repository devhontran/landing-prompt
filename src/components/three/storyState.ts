/**
 * Trạng thái cảnh 3D là một object số thuần. Timeline GSAP (scrub theo cuộn) tween các số này,
 * còn vòng render chỉ đọc chúng. Vì trạng thái là hàm thuần của tiến độ cuộn, cuộn ngược luôn
 * khôi phục đúng trạng thái trước đó (không có callback một chiều).
 */
import type { gsap as GSAP } from 'gsap'

export type StoryState = {
  /** Xoay model quanh trục đứng (rad). */
  rotY: number
  /** Góc nâng camera (rad). */
  pitch: number
  /** Tâm nhìn (không gian thế giới). */
  targetY: number
  targetZ: number
  /** Bán kính khối cầu bao cần đặt vừa vùng khung. */
  radius: number
  /** Vùng khung trên màn hình (tỷ lệ 0..1): tâm x/y, rộng/cao. Chữ được bố trí ngoài vùng này. */
  fx: number
  fy: number
  fw: number
  fh: number
  /** Mức "vật liệu đầy đủ" của từng bộ phận (0 = nét bản vẽ). */
  sDriver: number
  sPcb: number
  sShell: number
  sBack: number
  /** Độ đậm nét tối đa, lưới nền, đường kích thước. */
  lines: number
  grid: number
  dims: number
  /** Nắp lưng tách ra (0..1). */
  explode: number
  /** Sàn shader cảnh kết. */
  floor: number
}

export const initialState = (): StoryState => ({
  rotY: -0.42,
  pitch: 0.1,
  targetY: 0,
  targetZ: 0,
  radius: 1.62,
  fx: 0.68,
  fy: 0.54,
  fw: 0.46,
  fh: 0.74,
  sDriver: 1,
  sPcb: 1,
  sShell: 1,
  sBack: 1,
  lines: 0,
  grid: 0,
  dims: 0,
  explode: 0,
  floor: 0,
})

/** Vùng khung cho từng cảnh — đồng bộ với bố cục chữ trong globals.css. */
const FRAME = {
  side: { fx: 0.68, fy: 0.54, fw: 0.46, fh: 0.74 },
  blueprint: { fx: 0.5, fy: 0.56, fw: 0.36, fh: 0.7 },
  construct: { fx: 0.68, fy: 0.54, fw: 0.46, fh: 0.76 },
}

/** Mốc thời gian (đơn vị timeline, tổng = 100). Dùng chung cho chữ và điều hướng. */
export const MARK = {
  hero: 0,
  back: 16,
  blueprint: 36,
  driver: 60,
  pcb: 71,
  enclosure: 82,
  final: 94,
  end: 100,
} as const

export function buildStateTimeline(gsap: typeof GSAP, s: StoryState) {
  const tl = gsap.timeline({ defaults: { ease: 'none' }, paused: true })
  const ease = 'power2.inOut'
  tl.addLabel('hero', MARK.hero)

  // 1. Xoay từ mặt trước sang mặt sau.
  tl.to(s, { rotY: Math.PI - 0.42, pitch: 0.14, duration: 22, ease }, 4)
  tl.addLabel('back', MARK.back)

  // 2. Chuyển sang bản vẽ kỹ thuật.
  tl.to(s, { rotY: Math.PI + 0.62, pitch: 0.2, radius: 1.75, ...FRAME.blueprint, duration: 8, ease }, 28)
  tl.to(s, { sDriver: 0, sPcb: 0, sShell: 0, sBack: 0, lines: 1, duration: 6, ease }, 29)
  tl.to(s, { grid: 1, duration: 6 }, 30)
  tl.to(s, { dims: 1, duration: 4 }, 33)
  tl.addLabel('blueprint', MARK.blueprint)

  // 3. Cảnh cấu tạo: góc nhìn sau-trên để thấy bo mạch, nắp lưng tách ra.
  tl.to(s, { dims: 0, duration: 3 }, 52)
  tl.to(s, { grid: 0.35, lines: 0.75, duration: 5 }, 53)
  tl.to(s, { rotY: Math.PI - 0.72, pitch: 0.42, targetZ: -0.45, radius: 2.2, ...FRAME.construct, duration: 7, ease }, 53)
  tl.to(s, { explode: 1, duration: 6, ease }, 55)
  // 3.1 Củ loa
  tl.to(s, { sDriver: 1, duration: 3, ease }, 58)
  tl.addLabel('driver', MARK.driver)
  // 3.2 Bo mạch
  tl.to(s, { sDriver: 0, duration: 3, ease }, 68)
  tl.to(s, { sPcb: 1, duration: 3, ease }, 69)
  tl.to(s, { rotY: Math.PI - 0.52, pitch: 0.36, duration: 6, ease }, 67)
  tl.addLabel('pcb', MARK.pcb)
  // 3.3 Vỏ loa: nắp lưng khép lại, vỏ hiện vật liệu đầy đủ.
  tl.to(s, { sPcb: 0, duration: 3, ease }, 79)
  tl.to(s, { sShell: 1, sBack: 1, duration: 4, ease }, 80)
  tl.to(s, { explode: 0, targetZ: 0, radius: 1.8, duration: 5, ease }, 80)
  tl.addLabel('enclosure', MARK.enclosure)

  // 4. Cảnh kết: loa đặt trên mặt phẳng.
  tl.to(s, { sDriver: 1, sPcb: 1, lines: 0, grid: 0, duration: 4, ease }, 88)
  tl.to(s, { rotY: 2 * Math.PI - 0.5, pitch: 0.16, targetY: -0.25, radius: 1.9, ...FRAME.side, duration: 7, ease }, 88)
  tl.to(s, { floor: 1, duration: 5, ease }, 90)
  tl.addLabel('final', MARK.final)
  tl.to({}, { duration: 0.001 }, MARK.end)
  return tl
}
