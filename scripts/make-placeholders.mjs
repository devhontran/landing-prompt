// Tạo ảnh placeholder tối giản (chỉ dùng khi chưa chạy `npm run capture`).
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const scenes = ['hero', 'back', 'blueprint', 'driver', 'pcb', 'enclosure', 'final']
const gallery = Array.from({ length: 8 }, (_, i) => `view-${i + 1}`)

async function make(file, w, h, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="100%" height="100%" fill="#101113"/>
    <rect x="24" y="24" width="${w - 48}" height="${h - 48}" fill="none" stroke="#3a3d44" stroke-dasharray="10 8"/>
    <text x="50%" y="48%" fill="#a1a1aa" font-family="sans-serif" font-size="${Math.round(w / 22)}" text-anchor="middle">PLACEHOLDER</text>
    <text x="50%" y="56%" fill="#71717a" font-family="sans-serif" font-size="${Math.round(w / 34)}" text-anchor="middle">${label}</text>
  </svg>`
  await sharp(Buffer.from(svg)).webp({ quality: 80 }).toFile(file)
}

mkdirSync('src/assets/scenes', { recursive: true })
mkdirSync('src/assets/gallery', { recursive: true })
for (const s of scenes) await make(`src/assets/scenes/${s}.webp`, 1200, 1200, `scene: ${s}`)
for (const g of gallery) await make(`src/assets/gallery/${g}.webp`, 1080, 1350, g)
console.log('ok')
