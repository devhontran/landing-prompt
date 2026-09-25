/**
 * NỘI DUNG SẢN PHẨM — nguồn dữ liệu duy nhất cho toàn trang.
 *
 * Mọi giá trị có `placeholder: true` hoặc bằng `null` là CHƯA CÓ DỮ LIỆU THẬT.
 * Trang sẽ hiển thị nhãn "Cần cung cấp" cho các mục đó. Không điền số liệu ước đoán.
 * Xem ASSETS_NEEDED.md để biết danh sách đầy đủ tài nguyên cần bổ sung.
 */

export type PartId = 'driver' | 'pcb' | 'enclosure'
export type AnchorId = 'driver' | 'port' | 'io' | 'knob' | 'amp' | 'height' | 'width' | 'body' | 'shell' | 'backPanel'

export const PLACEHOLDER_LABEL = 'Cần cung cấp'

export const product = {
  /** [CẦN CUNG CẤP] Tên thương mại. Đang dùng tên mô tả chung. */
  name: 'Loa để bàn',
  namePlaceholder: true,
  /** [CẦN CUNG CẤP] Thương hiệu — dùng cho JSON-LD và metadata. */
  brand: null as string | null,
  tagline: 'Âm thanh được thiết kế từ bên trong.',
  /** Mô tả meta (SEO). Viết chung, không chứa thông số. */
  description:
    'Khám phá thiết kế và cấu tạo của mẫu loa để bàn cao cấp: từ đường nét vỏ loa, củ loa, bo mạch khuếch đại đến từng chi tiết hoàn thiện.',
  /** [CẦN CUNG CẤP] Giá bán. null = không hiển thị giá. */
  price: null as string | null,
}

/**
 * [CẦN CUNG CẤP] URL mua hàng qua biến môi trường NEXT_PUBLIC_BUY_URL (không phải khóa bí mật).
 * Chỉ chấp nhận https://. Nếu thiếu, nút "Mua ngay" trỏ về phần đặt hàng trên trang và hiện nhãn cảnh báo.
 */
function resolveBuyUrl(): { href: string; configured: boolean } {
  const raw = process.env.NEXT_PUBLIC_BUY_URL
  if (raw) {
    try {
      const url = new URL(raw)
      if (url.protocol === 'https:') return { href: url.toString(), configured: true }
    } catch {
      /* URL không hợp lệ → dùng fallback */
    }
  }
  return { href: '#mua-ngay', configured: false }
}
export const buy = resolveBuyUrl()

/**
 * Model 3D.
 * - url = null → dùng model dựng thủ tục (placeholder) trong src/components/three/proceduralSpeaker.ts.
 * - Khi có file thật: đặt vào public/models/, điền url (tăng ?v= mỗi lần thay file để phá cache immutable).
 *   Yêu cầu cấu trúc node: xem ASSETS_NEEDED.md mục "Model 3D".
 */
export const model = {
  url: null as string | null, // ví dụ: '/models/speaker.glb?v=1'
  placeholder: true,
}

/** Thông số hiển thị ở cảnh bản vẽ kỹ thuật. value = null → "Cần cung cấp". */
export type Spec = { id: string; label: string; value: string | null; anchor: AnchorId; side: 'left' | 'right' }
export const specs: Spec[] = [
  { id: 'knob', label: 'Điều khiển', value: null, anchor: 'knob', side: 'left' },
  { id: 'weight', label: 'Khối lượng', value: null, anchor: 'body', side: 'left' },
  { id: 'width', label: 'Chiều rộng × sâu', value: null, anchor: 'width', side: 'left' },
  { id: 'port', label: 'Cổng thoát hơi (bass reflex)', value: null, anchor: 'port', side: 'right' },
  { id: 'height', label: 'Chiều cao', value: null, anchor: 'height', side: 'right' },
  { id: 'io', label: 'Cổng kết nối', value: null, anchor: 'io', side: 'right' },
]

/** Thông số tổng hợp ở phần đặt hàng (bảng). */
export const specSheet: { label: string; value: string | null }[] = [
  { label: 'Kích thước (R × C × S)', value: null },
  { label: 'Khối lượng', value: null },
  { label: 'Củ loa', value: null },
  { label: 'Công suất khuếch đại', value: null },
  { label: 'Dải tần đáp ứng', value: null },
  { label: 'Kết nối', value: null },
  { label: 'Nguồn điện', value: null },
  { label: 'Chất liệu vỏ', value: null },
]

export type Part = {
  id: PartId
  anchor: AnchorId
  index: string
  title: string
  body: string
  materials: { label: string; value: string | null }[]
}

/** Nội dung cảnh cấu tạo. Mô tả viết chung — không nêu thông số; vật liệu cần cung cấp. */
export const parts: Part[] = [
  {
    id: 'driver',
    anchor: 'driver',
    index: '03.1',
    title: 'Củ loa',
    body: 'Trái tim của hệ thống: màng loa, viền treo và nam châm được căn chỉnh đồng trục để chuyển động của màng luôn thẳng và chính xác.',
    materials: [
      { label: 'Màng loa', value: null },
      { label: 'Nam châm', value: null },
      { label: 'Kích thước', value: null },
    ],
  },
  {
    id: 'pcb',
    anchor: 'amp',
    index: '03.2',
    title: 'Bo mạch',
    body: 'Bo mạch khuếch đại đặt sát mặt sau, cách ly khỏi buồng âm, tản nhiệt qua khối nhôm và nối thẳng tới cụm cổng kết nối.',
    materials: [
      { label: 'Mạch khuếch đại', value: null },
      { label: 'Công suất', value: null },
      { label: 'Xử lý tín hiệu', value: null },
    ],
  },
  {
    id: 'enclosure',
    anchor: 'shell',
    index: '03.3',
    title: 'Vỏ loa',
    body: 'Khối vỏ bo tròn các cạnh giữ buồng âm kín và cứng vững, nắp lưng khép lại toàn bộ linh kiện bên trong.',
    materials: [
      { label: 'Chất liệu vỏ', value: null },
      { label: 'Hoàn thiện bề mặt', value: null },
      { label: 'Thể tích buồng âm', value: null },
    ],
  },
]

/** Chữ cho các chương kể chuyện. `id` dùng làm neo điều hướng. */
export const chapters = {
  hero: { id: 'gioi-thieu', eyebrow: 'Loa để bàn', title: product.tagline },
  back: {
    id: 'thiet-ke',
    index: '01',
    eyebrow: 'Thiết kế',
    title: 'Mặt sau cũng được chăm chút như mặt trước.',
    body: 'Cụm cổng kết nối và cổng thoát hơi được sắp xếp gọn trên nắp lưng, để chiếc loa đẹp ở mọi góc đặt trên bàn.',
  },
  blueprint: {
    id: 'thong-so',
    index: '02',
    eyebrow: 'Thông số',
    title: 'Bản vẽ kỹ thuật.',
    body: 'Các thông số đang chờ dữ liệu chính thức từ nhà sản xuất.',
  },
  construction: { id: 'cau-tao', index: '03', eyebrow: 'Cấu tạo' },
  final: {
    id: 'hoan-thien',
    index: '04',
    eyebrow: 'Hoàn thiện',
    title: 'Sẵn sàng cho góc làm việc của bạn.',
    body: 'Một khối âm thanh gọn gàng, đặt vừa trên mặt bàn.',
  },
}
