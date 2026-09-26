/**
 * ẢNH TĨNH — dùng cho mobile / giảm chuyển động (thay cho canvas 3D) và cho các section ảnh (vật liệu, không gian nghe).
 * [CẦN CUNG CẤP] Hiện là ảnh PLACEHOLDER render từ model tạm (`npm run capture`). Thay bằng ảnh thật cùng tên file,
 * cập nhật alt và đặt `placeholder: false`.
 */
import type { StaticImageData } from 'next/image'
import hero from '@/assets/hero.webp'
import statement from '@/assets/statement.webp'
import exploded from '@/assets/exploded.webp'
import finishGraphite from '@/assets/finish-graphite.webp'
import finishSilver from '@/assets/finish-silver.webp'
import finishWalnut from '@/assets/finish-walnut.webp'
import matAluminium from '@/assets/material-aluminium.webp'
import matShell from '@/assets/material-shell.webp'
import matWalnut from '@/assets/material-walnut.webp'
import room from '@/assets/room.webp'

export type Media = { src: StaticImageData; alt: string; placeholder: boolean }

export const images = {
  hero: { src: hero, alt: 'Loa dạng khối trong phòng tối, ánh sáng ấm hắt dọc cạnh', placeholder: true },
  statement: { src: statement, alt: 'Mặt sau của loa: cổng thoát hơi và cụm cổng kết nối', placeholder: true },
  exploded: {
    src: exploded,
    alt: 'Loa tách rời: mặt trước, củ loa, bo mạch khuếch đại, vỏ và nắp lưng',
    placeholder: true,
  },
  finishGraphite: { src: finishGraphite, alt: 'Phiên bản Graphite', placeholder: true },
  finishSilver: { src: finishSilver, alt: 'Phiên bản Silver', placeholder: true },
  finishWalnut: { src: finishWalnut, alt: 'Phiên bản Walnut', placeholder: true },
  matAluminium: { src: matAluminium, alt: 'Cận cảnh viền nhôm xước', placeholder: true },
  matShell: { src: matShell, alt: 'Cận cảnh bề mặt vỏ phủ mờ', placeholder: true },
  matWalnut: { src: matWalnut, alt: 'Cận cảnh vân gỗ óc chó', placeholder: true },
  room: { src: room, alt: 'Cặp loa trong phòng khách tối, ánh sáng ấm', placeholder: true },
} satisfies Record<string, Media>
