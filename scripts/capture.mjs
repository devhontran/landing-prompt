/**
 * Render ảnh tĩnh (mobile / giảm chuyển động / gallery / Open Graph) từ cảnh 3D.
 * Dùng khi đổi model: `npm run capture` (tự khởi động `next dev` ở cổng 3100).
 * Ảnh được gắn nhãn PLACEHOLDER khi model còn là placeholder — thay bằng ảnh chụp thật khi có.
 */
import { chromium } from 'playwright'
import sharp from 'sharp'
import { spawn } from 'node:child_process'

const PORT = 3100
const LABEL = process.env.CAPTURE_LABEL ?? 'PLACEHOLDER — render từ model tạm'
const only = process.argv[2] ? new RegExp(process.argv[2]) : null
const jobs = [
  ...['hero', 'back', 'blueprint', 'driver', 'pcb', 'enclosure', 'final'].map((n) => ({ preset: n, w: 1200, h: 1200, out: `src/assets/scenes/${n}.webp` })),
  ...Array.from({ length: 8 }, (_, i) => ({ preset: `view-${i + 1}`, w: 1080, h: 1350, out: `src/assets/gallery/view-${i + 1}.webp` })),
  { preset: 'hero', w: 1200, h: 630, out: 'src/app/opengraph-image.jpg' },
].filter((j) => !only || only.test(j.out))

const dev = spawn('npx', ['next', 'dev', '-p', String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'], detached: true })
await new Promise((res) => dev.stdout.on('data', (d) => /Ready|ready/.test(String(d)) && res()))

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1350 } })
  for (const j of jobs) {
    await page.setViewportSize({ width: j.w, height: j.h })
    await page.goto(`http://localhost:${PORT}/capture?preset=${j.preset}&w=${j.w}&h=${j.h}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-capture-ready]', { timeout: 60000 })
    await page.waitForTimeout(400)
    const png = await page.locator('canvas').screenshot()
    const fs = Math.round(j.w / 60)
    const label = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${j.w}" height="${j.h}"><text x="${fs * 1.6}" y="${j.h - fs * 1.6}" fill="#d9b98a" fill-opacity="0.85" font-family="sans-serif" font-size="${fs}" letter-spacing="1">${LABEL}</text></svg>`,
    )
    const img = sharp(await sharp(png).resize(j.w, j.h, { fit: 'cover' }).toBuffer()).composite(LABEL ? [{ input: label }] : [])
    if (j.out.endsWith('.jpg')) await img.jpeg({ quality: 82, mozjpeg: true }).toFile(j.out)
    else await img.webp({ quality: 82, effort: 6 }).toFile(j.out)
    console.log('✓', j.out)
  }
} finally {
  await browser.close()
  process.kill(-dev.pid)
}
