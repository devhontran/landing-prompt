/**
 * ẢNH TĨNH — dùng cho mobile, chế độ giảm chuyển động và gallery.
 *
 * [CẦN CUNG CẤP] Hiện tất cả là ảnh PLACEHOLDER render từ model tạm (`npm run capture`).
 * Thay bằng ảnh thật: giữ nguyên tên file trong src/assets/, đổi `placeholder` thành false và cập nhật alt.
 * Khuyến nghị: WebP/AVIF/JPEG chất lượng cao, cảnh 1200×1200, gallery 1080×1350 (4:5); Next.js tự tối ưu kích thước.
 */
import type { StaticImageData } from 'next/image'
import hero from '@/assets/scenes/hero.webp'
import back from '@/assets/scenes/back.webp'
import blueprint from '@/assets/scenes/blueprint.webp'
import driver from '@/assets/scenes/driver.webp'
import pcb from '@/assets/scenes/pcb.webp'
import enclosure from '@/assets/scenes/enclosure.webp'
import final from '@/assets/scenes/final.webp'
import v1 from '@/assets/gallery/view-1.webp'
import v2 from '@/assets/gallery/view-2.webp'
import v3 from '@/assets/gallery/view-3.webp'
import v4 from '@/assets/gallery/view-4.webp'
import v5 from '@/assets/gallery/view-5.webp'
import v6 from '@/assets/gallery/view-6.webp'
import v7 from '@/assets/gallery/view-7.webp'
import v8 from '@/assets/gallery/view-8.webp'

export type Media = { src: StaticImageData; alt: string; placeholder: boolean }

export const sceneImages = {
  hero: { src: hero, alt: 'Loa để bàn nhìn chéo từ phía trước, vỏ màu than chì, viền nhôm quanh củ loa', placeholder: true },
  back: { src: back, alt: 'Mặt sau của loa với cổng thoát hơi và cụm cổng kết nối', placeholder: true },
  blueprint: { src: blueprint, alt: 'Bản vẽ kỹ thuật dạng nét của loa, kèm đường kích thước', placeholder: true },
  driver: { src: driver, alt: 'Cấu tạo: củ loa được làm nổi bật, các bộ phận khác hiển thị dạng nét', placeholder: true },
  pcb: { src: pcb, alt: 'Cấu tạo: bo mạch khuếch đại bên trong, nhìn qua nắp lưng đã tháo', placeholder: true },
  enclosure: { src: enclosure, alt: 'Cấu tạo: vỏ loa và nắp lưng khép kín', placeholder: true },
  final: { src: final, alt: 'Loa đặt trên mặt phẳng tối với các vòng sóng âm lan ra từ chân đế', placeholder: true },
} satisfies Record<string, Media>

export const galleryImages: (Media & { caption: string })[] = [
  { src: v1, caption: 'Mặt trước', alt: 'Loa nhìn thẳng từ phía trước', placeholder: true },
  { src: v2, caption: 'Góc ba phần tư', alt: 'Loa nhìn chéo ba phần tư từ phía trước bên phải', placeholder: true },
  { src: v3, caption: 'Tách rời', alt: 'Các khối của loa tách rời theo trục: mặt trước, củ loa, vỏ, bo mạch, nắp lưng', placeholder: true },
  { src: v4, caption: 'Mặt sau', alt: 'Mặt sau của loa với cổng kết nối', placeholder: true },
  { src: v5, caption: 'Núm xoay', alt: 'Nhìn từ trên xuống, núm xoay nhôm trên đỉnh loa', placeholder: true },
  { src: v6, caption: 'Củ loa', alt: 'Cận cảnh củ loa và vòng viền nhôm', placeholder: true },
  { src: v7, caption: 'Trên mặt bàn', alt: 'Loa đặt trên mặt phẳng tối', placeholder: true },
  { src: v8, caption: 'Góc thấp', alt: 'Loa nhìn từ góc thấp phía trước bên trái', placeholder: true },
]
