/**
 * NỘI DUNG TRANG — nguồn dữ liệu duy nhất.
 *
 * Quy ước: `null` hoặc chuỗi chứa "TODO" = CHƯA CÓ DỮ LIỆU THẬT. Trang hiển thị nhãn "CẦN CUNG CẤP" thay vì bịa số liệu.
 * Mọi câu chữ mô tả dưới đây là COPY MẪU theo art direction, cần khách hàng duyệt (không chứa thông số kỹ thuật).
 * Danh sách đầy đủ: ASSETS_NEEDED.md.
 */

export const PLACEHOLDER = 'Cần cung cấp'

export const brand = {
  /** TODO: tên thương hiệu (wordmark giãn rộng). */
  name: null as string | null,
  /** Hiển thị tạm khi chưa có tên — ngắn để vừa tab hero. */
  fallback: 'Brand',
  /** TODO: tên model. */
  model: null as string | null,
  category: 'Loa hi-end',
  /** TODO: giá bán. */
  price: null as string | null,
}
export const brandName = brand.name ?? brand.fallback

export const seo = {
  title: `${brand.category} — Nơi tĩnh lặng có chiều sâu`,
  description:
    'Dòng loa hi-end được trình bày như một công trình kiến trúc: khối vuông vức, vật liệu thật và ánh sáng ấm trên nền đêm. Đặt lịch nghe thử tại showroom.',
}

/** URL công khai (không phải khoá bí mật). Chỉ nhận https. */
function httpsUrl(raw: string | undefined) {
  if (!raw) return null
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}
/** TODO: NEXT_PUBLIC_CATALOGUE_URL — file PDF catalogue. */
export const catalogueUrl = httpsUrl(process.env.NEXT_PUBLIC_CATALOGUE_URL)

/** Neo điều hướng. */
export const ids = {
  hero: 'gioi-thieu',
  statement: 'tuyen-ngon',
  exploded: 'cau-tao',
  specs: 'thong-so',
  materials: 'vat-lieu',
  finish: 'phien-ban',
  room: 'khong-gian',
  partners: 'doi-tac',
  booking: 'dat-lich',
}

export const hero = {
  taglineLines: ['Nơi tĩnh lặng', 'có chiều sâu'],
}

export const statement = {
  lines: ['Âm thanh được dựng', 'như một công trình: khối vuông vức,', 'vật liệu thật và ánh sáng', 'ấm hắt trên bề mặt.'],
  body: 'Mặt trước kính gân dọc, thân nhôm và từng đường ghép được xử lý như một mặt tiền. Chi tiết vật liệu cần được xác nhận theo sản phẩm thật.',
}

/** Các lớp của exploded view — theo thứ tự tách ra khi cuộn. `part` khớp với tên node trong model. */
export const layers = [
  { part: 'Shell', label: 'Vỏ nhôm' },
  { part: 'Frame', label: 'Khung' },
  { part: 'Bass', label: 'Củ bass' },
  { part: 'Mid', label: 'Củ trung' },
  { part: 'Tweeter', label: 'Tweeter' },
  { part: 'Crossover', label: 'Mạch phân tần' },
] as const
export type LayerPart = (typeof layers)[number]['part'] | 'Glass'

/** Hàng thông số: đơn vị nằm trong nhãn. value = null → hiển thị khung số mờ + "Cần cung cấp". */
export const specs = [
  { label: 'Dải tần đáp ứng, Hz', value: null as string | null, mask: '00–00 000' },
  { label: 'Độ nhạy, dB', value: null as string | null, mask: '00' },
  { label: 'Khối lượng mỗi chiếc, kg', value: null as string | null, mask: '00' },
]

export const materials = {
  title: ['Vật liệu'],
  body: 'Nhôm phay xước, kính gân dọc và gỗ óc chó — ba bề mặt hứng ánh sáng theo ba cách khác nhau. Danh sách vật liệu là minh hoạ theo art direction, cần xác nhận với nhà sản xuất.',
}

/** Các phiên bản hoàn thiện (minh hoạ, cần xác nhận). `key` khớp với finishes.ts. */
export const finishes = [
  { key: 'graphite', label: 'Graphite' },
  { key: 'silver', label: 'Silver' },
  { key: 'walnut', label: 'Walnut' },
] as const
export type FinishKey = (typeof finishes)[number]['key']

export const room = {
  /** TODO: diện tích phòng phù hợp (m²). */
  size: null as string | null,
  body: 'Thiết kế cho không gian sống: đặt sát tường hay giữa phòng, khối loa vẫn giữ vai trò một món nội thất.',
}

/** TODO: logo đối tác / giải thưởng thật. */
export const partners = [
  { label: 'Đối tác 01', name: null as string | null },
  { label: 'Giải thưởng 01', name: null as string | null },
  { label: 'Đối tác 02', name: null as string | null },
]

/** TODO: danh sách showroom thật. */
export const showrooms: { value: string; label: string }[] = []

export const footer = {
  /** TODO */
  address: null as string | null,
  /** TODO: mạng xã hội thật { label, href }. */
  social: [] as { label: string; href: string }[],
}
