// Ảnh placeholder tối giản (chỉ dùng trước khi chạy `npm run capture`).
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

export const IMAGES = {
  hero: [1200, 1500],
  statement: [1200, 900],
  exploded: [1200, 1200],
  'finish-graphite': [1200, 1200],
  'finish-silver': [1200, 1200],
  'finish-walnut': [1200, 1200],
  'material-aluminium': [1200, 900],
  'material-shell': [1200, 900],
  'material-walnut': [1200, 900],
  room: [1920, 1080],
}
mkdirSync('src/assets', { recursive: true })
for (const [name, [w, h]] of Object.entries(IMAGES)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#070b20"/><text x="50%" y="50%" fill="#bdbec4" font-family="sans-serif" font-size="${Math.round(w / 30)}" text-anchor="middle">PLACEHOLDER · ${name}</text></svg>`
  await sharp(Buffer.from(svg)).webp({ quality: 80 }).toFile(`src/assets/${name}.webp`)
}
console.log('ok')
