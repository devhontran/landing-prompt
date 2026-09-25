/**
 * Bố cục "grid ngẫu hứng" của gallery, tính theo đơn vị = chiều cao vùng xem.
 * Mẫu 8 ô lặp vô hạn theo trục ngang (2 bản sao để luôn phủ kín màn hình rộng).
 */
export type Slot = { x: number; y: number; w: number; h: number }

export const PATTERN: Slot[] = [
  { x: 0, y: 0.08, w: 0.54, h: 0.68 },
  { x: 0.6, y: 0.0, w: 0.3, h: 0.38 },
  { x: 0.6, y: 0.46, w: 0.3, h: 0.34 },
  { x: 0.96, y: 0.26, w: 0.42, h: 0.56 },
  { x: 1.44, y: 0.04, w: 0.34, h: 0.36 },
  { x: 1.44, y: 0.48, w: 0.27, h: 0.38 },
  { x: 1.84, y: 0.14, w: 0.5, h: 0.64 },
  { x: 2.4, y: 0.02, w: 0.3, h: 0.42 },
]
export const GAP = 0.06
export const PERIOD = 2.7 + GAP
export const COPIES = 2
export const MAX_W = Math.max(...PATTERN.map((s) => s.w))

/** Vị trí x (đơn vị) của ô i ở bản sao c khi đã cuộn `offset` đơn vị; luôn nằm trong [-MAX_W - GAP, span - MAX_W - GAP). */
export function wrapX(slotX: number, copy: number, offset: number) {
  const span = PERIOD * COPIES
  const start = -MAX_W - GAP
  const x = slotX + copy * PERIOD + offset - start
  return (((x % span) + span) % span) + start
}

/** Bước khi bấm nút/phím mũi tên: khoảng một ô trung bình. */
export const STEP = 0.48
