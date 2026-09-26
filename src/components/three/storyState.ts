/**
 * Trạng thái ĐÍCH của cảnh 3D là một object số thuần, do timeline GSAP gắn trực tiếp với vị trí cuộn
 * (scrub: true → hàm thuần của tiến độ cuộn, cuộn ngược luôn khôi phục đúng). Vòng render
 * (stageController) không dùng trực tiếp giá trị này mà đuổi theo bằng damping/spring
 * → chuyển động liên tục, có quán tính, không bao giờ giật cục.
 *
 * Nhịp camera — mỗi lần di chuyển có lý do:
 *  hero → loa quay dần 360° theo MỘT chiều suốt câu chuyện, mỗi chương lộ ra một mặt:
 *  mặt trước (hero) → mặt sau (thiết kế) → sau-trái (bản vẽ: thấy cổng + kích thước)
 *  → nghiêng trước-trái (exploded: trục tách rời trải ngang màn hình) → camera tiến về từng bộ phận đang kể
 *  → lùi ra khi lắp lại → góc thấp chính diện (cảnh kết, "chân dung" sản phẩm).
 */
import type { gsap as GSAP } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

export type StoryState = {
  /** Xoay model quanh trục đứng (rad). */
  rotY: number
  /** Góc nâng camera (rad). */
  pitch: number
  /** Điểm camera nhìn vào, theo toạ độ LOCAL của loa (tự xoay theo model). */
  focusX: number
  focusY: number
  focusZ: number
  /** Bán kính khối cầu bao cần đặt vừa vùng khung. */
  radius: number
  /** Vùng khung trên màn hình (tỷ lệ 0..1): tâm x/y, rộng/cao. Chữ được bố trí ngoài vùng này. */
  fx: number
  fy: number
  fw: number
  fh: number
  /** Mức lộ vật liệu của từng bộ phận (vị trí mặt phẳng quét): 1 = vật liệu, 0 = nét bản vẽ. */
  rDriver: number
  rPcb: number
  rShell: number
  rBack: number
  /** Độ đậm nét, tiến độ "tự vẽ" nét, đường kích thước (vẽ dần), lưới nền. */
  lines: number
  draw: number
  dims: number
  grid: number
  /** Nhiệt màu nền: -1 lạnh (kỹ thuật) … 1 ấm (studio). */
  warmth: number
  /** Tách rời các khối (exploded view), 0..1 — render bằng spring. */
  explode: number
  /** Sàn phản chiếu, bụi trong vệt sáng, biên độ rung màng loa + sóng sàn. */
  floor: number
  dust: number
  pulse: number
  /** Sau câu chuyện (điều khiển bởi trigger riêng, không thuộc timeline chính):
   *  away: loa tan đi khi gallery tiến vào; buy: loa trở lại ở phần đặt hàng. */
  away: number
  buy: number
}

export const initialState = (): StoryState => ({
  rotY: -0.42,
  pitch: 0.1,
  focusX: 0,
  focusY: 0,
  focusZ: 0,
  radius: 1.62,
  fx: 0.6,
  fy: 0.39,
  fw: 0.5,
  fh: 0.52,
  rDriver: 1,
  rPcb: 1,
  rShell: 1,
  rBack: 1,
  lines: 0,
  draw: 0,
  dims: 0,
  grid: 0,
  warmth: 1,
  explode: 0,
  floor: 0,
  dust: 1,
  pulse: 0,
  away: 0,
  buy: 0,
})

/** Vùng khung cho từng cảnh — đồng bộ với bố cục chữ trong globals.css. */
const FRAME = {
  /** Hero & cảnh kết: model ở giữa-phải phía trên, tiêu đề display trải ngang đáy màn hình. */
  hero: { fx: 0.6, fy: 0.39, fw: 0.5, fh: 0.52 },
  side: { fx: 0.68, fy: 0.54, fw: 0.46, fh: 0.74 },
  blueprint: { fx: 0.5, fy: 0.56, fw: 0.36, fh: 0.7 },
  construct: { fx: 0.67, fy: 0.53, fw: 0.5, fh: 0.76 },
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

const TAU = Math.PI * 2

export function buildStateTimeline(gsap: typeof GSAP, s: StoryState) {
  gsap.registerPlugin(CustomEase)
  // Easing duy nhất của trang: cubic-bezier(0.7, 0, 0.3, 1). Độ mượt còn lại do damping/spring trong StageController.
  const ease = CustomEase.create('likova', 'M0,0 C0.7,0 0.3,1 1,1')
  const tl = gsap.timeline({ defaults: { ease: 'none' }, paused: true })
  tl.addLabel('hero', MARK.hero)

  // 1. Quay từ mặt trước sang mặt sau, camera nhích gần để xem chi tiết cổng.
  tl.to(s, { rotY: Math.PI - 0.42, pitch: 0.15, radius: 1.55, duration: 22, ease }, 3)
  // Tiêu đề hero rời đi (5.5–8) rồi model mới hạ xuống vùng khung bên phải.
  tl.to(s, { ...FRAME.side, duration: 10, ease }, 7.5)
  tl.to(s, { dust: 0.35, duration: 10 }, 12)
  tl.addLabel('back', MARK.back)

  // 2. Bản vẽ: mặt quét hạ từ đỉnh xuống, vật liệu nhường chỗ cho nét tự vẽ; nền chuyển lạnh.
  tl.to(s, { rotY: Math.PI + 0.62, pitch: 0.2, radius: 1.75, ...FRAME.blueprint, duration: 9, ease }, 27)
  tl.to(s, { dust: 0, duration: 3 }, 26)
  tl.to(s, { lines: 1, duration: 1.5 }, 27.5)
  tl.to(s, { draw: 1, duration: 8 }, 27.5)
  tl.to(s, { rDriver: 0, rPcb: 0, rShell: 0, rBack: 0, duration: 7, ease }, 28.5)
  tl.to(s, { grid: 1, warmth: -1, duration: 6 }, 28)
  tl.to(s, { dims: 1, duration: 5 }, 33)
  tl.addLabel('blueprint', MARK.blueprint)

  // 3. Exploded view: quay nghiêng trước-trái để trục tách rời trải ngang, các khối tách theo spring.
  tl.to(s, { dims: 0, duration: 3 }, 51)
  tl.to(s, { grid: 0.3, warmth: -0.35, duration: 6 }, 52)
  tl.to(s, { rotY: TAU - 1.15, pitch: 0.3, radius: 2.05, ...FRAME.construct, duration: 8, ease }, 52)
  tl.to(s, { explode: 1, duration: 6, ease }, 54)
  // 3.1 Củ loa: vật liệu "in" dần từ dưới lên, camera tiến về phía củ loa.
  tl.to(s, { rDriver: 1, duration: 4, ease }, 58)
  tl.to(s, { focusY: -0.1, focusZ: 0.45, radius: 1.9, pitch: 0.2, duration: 5, ease }, 58)
  tl.addLabel('driver', MARK.driver)
  // 3.2 Bo mạch: quay lại để mặt linh kiện hướng về camera.
  tl.to(s, { rDriver: 0, duration: 3, ease }, 67)
  tl.to(s, { rotY: Math.PI + 0.9, pitch: 0.34, focusY: 0, focusZ: -0.5, duration: 7, ease }, 67)
  tl.to(s, { rPcb: 1, duration: 4, ease }, 69)
  tl.addLabel('pcb', MARK.pcb)
  // 3.3 Vỏ loa: lùi ra, vỏ hiện vật liệu, các khối lắp lại.
  tl.to(s, { rPcb: 0, duration: 3, ease }, 77.5)
  tl.to(s, { rotY: Math.PI + 1.46, pitch: 0.24, focusZ: 0, radius: 2.0, duration: 6, ease }, 78)
  tl.to(s, { rShell: 1, rBack: 1, duration: 4, ease }, 79.5)
  tl.to(s, { explode: 0, duration: 4.5, ease }, 80.5)
  tl.to(s, { rDriver: 1, rPcb: 1, duration: 1 }, 86)
  tl.addLabel('enclosure', MARK.enclosure)

  // 4. Cảnh kết: góc thấp chính diện, sàn phản chiếu, bụi trong vệt sáng, màng loa "thở".
  tl.to(s, { lines: 0, grid: 0, duration: 3 }, 87)
  tl.to(s, { rotY: TAU - 0.5, pitch: 0.1, focusY: -0.25, radius: 1.9, ...FRAME.hero, duration: 7, ease }, 88)
  tl.to(s, { floor: 1, warmth: 1, dust: 1, duration: 5 }, 89)
  tl.to(s, { pulse: 1, duration: 4 }, 92)
  tl.addLabel('final', MARK.final)
  tl.to({}, { duration: 0.001 }, MARK.end)
  return tl
}
