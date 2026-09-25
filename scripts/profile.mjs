/**
 * Đo từng cảnh bằng Spector.js (chụp đúng 1 frame WebGL): số draw call, số lệnh WebGL, tam giác.
 * Thêm dung lượng tải 3D (JS chunk + model/texture) và thời gian khởi tạo (User Timing).
 *   npm run build && npm run profile        → reports/profile.json
 * Ngân sách: < 100 draw call, < 300k tam giác, payload 3D < 3 MB.
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

mkdirSync('reports', { recursive: true })
let server
let BASE = process.env.BASE_URL
if (!BASE) {
  BASE = 'http://localhost:3400'
  server = spawn('npx', ['next', 'start', '-p', '3400'], { stdio: ['ignore', 'pipe', 'inherit'], detached: true })
  await new Promise((res) => server.stdout.on('data', (d) => /Ready|ready/.test(String(d)) && res()))
}
const spectorSrc = readFileSync('node_modules/spectorjs/dist/spector.bundle.js', 'utf8')
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const bytes = { js: 0, model: 0, texture: 0 }
page.on('response', async (r) => {
  const u = r.url()
  const len = Number(r.headers()['content-length'] ?? 0) || (await r.body().catch(() => Buffer.alloc(0))).length
  if (/\.js(\?|$)/.test(u)) bytes.js += len
  else if (/\.(glb|gltf|bin)(\?|$)/.test(u)) bytes.model += len
  else if (/\.(ktx2|basis)(\?|$)/.test(u)) bytes.texture += len
})
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__scene?.settled(), null, { timeout: 60000 })
await page.evaluate(spectorSrc)
const scenes = [
  ['hero', 'gioi-thieu', 0],
  ['statement', 'tuyen-ngon', 0.45],
  ['exploded', 'cau-tao', 0.6],
  ['finish', 'phien-ban', 0.35],
]
const out = { date: new Date().toISOString(), viewport: '1440x900', scenes: {}, budget: { drawCalls: 100, triangles: 300000, payloadMB: 3 } }
for (const [name, id, f] of scenes) {
  await page.evaluate(
    ([id, f]) => {
      const el = document.getElementById(id)
      const y = el.getBoundingClientRect().top + scrollY + (el.offsetHeight - (id === 'cau-tao' ? innerHeight : 0)) * f
      window.__scene.scrollTo(y)
    },
    [id, f],
  )
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 200)))))
  await page.waitForFunction(() => window.__scene.settled(), null, { timeout: 60000, polling: 200 })
  const res = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const canvas = document.querySelector('.webgl canvas')
        const spector = new window.SPECTOR.Spector()
        spector.onCapture.add((c) => {
          const draws = c.commands.filter((x) => /^draw(Arrays|Elements)/.test(x.name))
          let tris = 0
          for (const d of draws) {
            const mode = d.commandArguments[0]
            const count = d.name.startsWith('drawArrays') ? d.commandArguments[2] : d.commandArguments[1]
            if (mode === 4) tris += count / 3 // TRIANGLES
          }
          resolve({ drawCalls: draws.length, commands: c.commands.length, triangles: Math.round(tris), lineAndPointDraws: draws.filter((d) => d.commandArguments[0] !== 4).length })
        })
        spector.captureCanvas(canvas, 0, true)
        // Kích một frame (canvas chỉ vẽ khi có thay đổi).
        window.dispatchEvent(new Event('resize'))
      }),
  )
  out.scenes[name] = res
  console.log(name, JSON.stringify(res))
}
out.timings = await page.evaluate(() => Object.fromEntries(performance.getEntriesByType('measure').filter((m) => m.name.startsWith('stage')).map((m) => [m.name, Math.round(m.duration)])))
out.payload = { jsKB: Math.round(bytes.js / 1024), modelKB: Math.round(bytes.model / 1024), textureKB: Math.round(bytes.texture / 1024) }
out.renderer = await page.evaluate(() => {
  const gl = document.querySelector('.webgl canvas').getContext('webgl2')
  const ext = gl.getExtension('WEBGL_debug_renderer_info')
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'
})
console.log(JSON.stringify({ timings: out.timings, payload: out.payload, renderer: out.renderer }))
writeFileSync('reports/profile.json', JSON.stringify(out, null, 2))
await browser.close()
if (server) process.kill(-server.pid)
