/**
 * Kiểm thử tự động bằng Playwright trên bản build production.
 *   npm run build && npm run verify            (tự chạy `next start` ở cổng 3200)
 *   BASE_URL=http://localhost:3000 npm run verify
 * Kết quả: reports/verify-report.json + ảnh chụp trong reports/screenshots/.
 *
 * Lưu ý FPS: container/CI không có GPU nên Chromium dùng SwiftShader (render bằng CPU).
 * Số FPS đo ở đây KHÔNG đại diện cho máy desktop thật — dùng ?debug trên máy thật để đo.
 */
import { chromium, devices } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = 'reports'
mkdirSync(`${OUT}/screenshots`, { recursive: true })
let server
let BASE = process.env.BASE_URL
if (!BASE) {
  BASE = 'http://localhost:3200'
  server = spawn('npx', ['next', 'start', '-p', '3200'], { stdio: ['ignore', 'pipe', 'inherit'], detached: true })
  await new Promise((res) => server.stdout.on('data', (d) => /Ready|ready/.test(String(d)) && res()))
}
const GPU_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', args: GPU_ARGS })

const report = { base: BASE, date: new Date().toISOString(), checks: [] }
const check = (name, pass, detail = {}) => {
  report.checks.push({ name, pass, ...detail })
  console.log(`${pass ? '✓' : '✗'} ${name}${detail.note ? ` — ${detail.note}` : ''}`)
}

// Trình tự mong đợi: [tiến độ %, chương đang hiển thị, kỳ vọng trạng thái]
const STORY = [
  [0, 'hero', (s) => s.rShell > 0.99 && s.lines < 0.01 && Math.abs(s.rotY + 0.42) < 0.02],
  [14, 'back', (s) => s.rotY > 0.3 && s.rotY < Math.PI],
  [24, 'back', (s) => s.rotY > 2.3 && s.lines < 0.01],
  [42, 'blueprint', (s) => s.lines > 0.99 && s.rShell < 0.01 && s.dims > 0.99 && s.draw > 0.99],
  [47, 'blueprint', (s) => s.grid > 0.99 && s.warmth < -0.99],
  [63, 'driver', (s) => s.rDriver > 0.99 && s.rPcb < 0.01 && s.rShell < 0.01 && s.explode > 0.99],
  [75, 'pcb', (s) => s.rPcb > 0.99 && s.rDriver < 0.01 && s.explode > 0.99],
  [86, 'enclosure', (s) => s.rShell > 0.99 && s.explode < 0.01],
  [97, 'final', (s) => s.floor > 0.99 && s.lines < 0.01 && s.pulse > 0.99],
  [100, 'final', (s) => s.floor > 0.99],
]

async function scrollToProgress(page, pct) {
  await page.evaluate((p) => {
    const st = window.__story.st
    window.scrollTo(0, st.start + ((st.end - st.start) * p) / 100)
  }, pct)
  // Chờ scrub (0.6s) đuổi kịp vị trí cuộn.
  await page.waitForFunction(
    (p) => Math.abs(window.__story.tl.progress() - p / 100) < 0.002,
    pct,
    { timeout: 15000, polling: 100 },
  )
  // Cảnh 3D đuổi theo đích bằng damping/spring → chờ đến khi đứng yên rồi mới đo.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 200)))))
  await page.waitForFunction(() => window.__story.settled(), null, { timeout: 60000, polling: 200 })
}

async function snapshot(page) {
  return page.evaluate(() => {
    const s = { ...window.__story.state }
    const frame = window.__story.debug.frame
    const visible = [...document.querySelectorAll('[data-chapter] .chapter__text, [data-spec]')]
      .filter((el) => parseFloat(getComputedStyle(el).opacity) > 0.05)
      .map((el) => {
        const r = el.getBoundingClientRect()
        return { id: el.closest('[data-chapter]')?.dataset.chapter + (el.dataset.spec ? `:${el.dataset.spec}` : ''), rect: [r.left, r.top, r.right, r.bottom], opacity: +getComputedStyle(el).opacity }
      })
    return { s, modelRect: frame?.modelRect, stats: { drawCalls: frame?.drawCalls, triangles: frame?.triangles }, visible, overflowX: document.scrollingElement.scrollWidth - innerWidth }
  })
}

const intersects = (a, m) => a[0] < m.right && a[2] > m.left && a[1] < m.bottom && a[3] > m.top

async function desktopStory(viewport) {
  const tag = `${viewport.width}x${viewport.height}`
  const page = await browser.newPage({ viewport })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(`${BASE}/?debug`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__story?.debug?.frame, null, { timeout: 90000 })

  const forward = {}
  let overlapIssues = []
  for (const [pct, chapter, expect] of STORY) {
    await scrollToProgress(page, pct)
    const snap = await snapshot(page)
    forward[pct] = snap
    await page.screenshot({ path: `${OUT}/screenshots/desktop-${tag}-${String(pct).padStart(3, '0')}.png` })
    const main = snap.visible.filter((v) => v.opacity > 0.5).map((v) => v.id.split(':')[0])
    check(`[${tag}] ${pct}%: chương "${chapter}" hiển thị & trạng thái 3D đúng`, main.includes(chapter) && expect(snap.s), {
      visible: main,
      ...snap.stats,
    })
    if (snap.modelRect) {
      const hits = snap.visible.filter((v) => v.opacity > 0.05 && intersects(v.rect, snap.modelRect))
      if (hits.length) overlapIssues.push({ pct, hits: hits.map((h) => h.id), modelRect: snap.modelRect })
      if (snap.modelRect.top < 64) overlapIssues.push({ pct, header: true, modelRect: snap.modelRect })
    }
    if (snap.overflowX > 0) overlapIssues.push({ pct, overflowX: snap.overflowX })
  }
  check(`[${tag}] Chữ không chồng lên khung bao model, không tràn ngang`, overlapIssues.length === 0, { issues: overlapIssues })

  // Cuộn ngược từng bước → trạng thái phải trùng với lúc cuộn xuôi.
  const diffs = []
  for (const [pct] of [...STORY].reverse()) {
    await scrollToProgress(page, pct)
    const snap = await snapshot(page)
    for (const [k, v] of Object.entries(forward[pct].s)) {
      if (Math.abs(v - snap.s[k]) > 0.005) diffs.push({ pct, key: k, forward: v, backward: snap.s[k] })
    }
    const f = forward[pct].visible.filter((x) => x.opacity > 0.5).map((x) => x.id).sort().join()
    const b = snap.visible.filter((x) => x.opacity > 0.5).map((x) => x.id).sort().join()
    if (f !== b) diffs.push({ pct, text: { forward: f, backward: b } })
  }
  check(`[${tag}] Cuộn ngược khôi phục đúng trạng thái trước đó`, diffs.length === 0, { diffs })

  // Nhảy thẳng từ cuối về đầu (không qua các bước giữa).
  await scrollToProgress(page, 100)
  await scrollToProgress(page, 0)
  const s0 = (await snapshot(page)).s
  const jumpDiff = Object.entries(forward[0].s).filter(([k, v]) => Math.abs(v - s0[k]) >= 0.005).map(([k, v]) => ({ key: k, expected: v, got: s0[k] }))
  check(`[${tag}] Nhảy từ cuối về đầu trả lại đúng hero`, jumpDiff.length === 0, { jumpDiff })
  check(`[${tag}] Không có lỗi JS/console`, errors.length === 0, { errors })
  await page.close()
}

async function fpsTest() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`${BASE}/?debug`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__story?.debug?.frame, null, { timeout: 90000 })
  await page.mouse.move(700, 450)
  await page.evaluate(() => {
    window.__frames = []
    const loop = (t) => {
      window.__frames.push(t)
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  })
  const total = await page.evaluate(() => window.__story.st.end - window.__story.st.start)
  const steps = 160
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, total / steps)
    await page.waitForTimeout(40)
  }
  await page.waitForTimeout(1500)
  const r = await page.evaluate(() => {
    const f = window.__frames
    const dts = f.slice(1).map((t, i) => t - f[i]).sort((a, b) => a - b)
    const dur = (f.at(-1) - f[0]) / 1000
    return { avgFps: +(f.length / dur).toFixed(1), p95FrameMs: +dts[Math.floor(dts.length * 0.95)].toFixed(1), frames: f.length, seconds: +dur.toFixed(1) }
  })
  const gl = await page.evaluate(() => {
    const c = document.querySelector('.story__canvas canvas')
    const ctx = c.getContext('webgl2')
    const ext = ctx.getExtension('WEBGL_debug_renderer_info')
    return ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'
  })
  check('FPS khi cuộn toàn bộ phần kể chuyện (1440×900)', true, { ...r, renderer: gl, note: `${r.avgFps} fps trung bình, p95 ${r.p95FrameMs} ms — renderer: ${gl}` })
  await page.close()
}

async function galleryTest() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`${BASE}/?debug`, { waitUntil: 'networkidle' })
  await page.locator('#thu-vien').scrollIntoViewIfNeeded()
  const vp = page.locator('.gallery__viewport')
  await vp.scrollIntoViewIfNeeded()
  await page.waitForSelector('.gallery__viewport[data-gl-ready]', { timeout: 20000 })
  await page.waitForTimeout(400)
  const box = await vp.boundingBox()
  const before = await page.evaluate(() => window.__gallery.current)
  const drag = async (dx) => {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + box.width / 2 + (dx * i) / 12, box.y + box.height / 2, { steps: 1 })
    await page.mouse.up()
  }
  await drag(-500)
  await page.screenshot({ path: `${OUT}/screenshots/gallery-dragging.png` })
  await page.waitForTimeout(1200)
  const after = await page.evaluate(() => window.__gallery.current)
  check('Gallery kéo được bằng chuột', after < before - 0.3, { before, after })
  // Kéo nhiều vòng (> 2 chu kỳ) để kiểm tra lặp vô hạn không để lộ khoảng trống.
  for (let i = 0; i < 12; i++) await drag(-700)
  await page.waitForTimeout(1500)
  const cover = await page.evaluate(() => {
    const vp = document.querySelector('.gallery__viewport').getBoundingClientRect()
    const xs = [...document.querySelectorAll('.gallery__viewport .tile')].map((t) => t.getBoundingClientRect()).map((r) => [r.left - vp.left, r.right - vp.left]).sort((a, b) => a[0] - b[0])
    let reach = 0
    let maxGap = 0
    for (const [l, r] of xs) {
      if (l > reach) maxGap = Math.max(maxGap, l - reach)
      reach = Math.max(reach, r)
      if (reach >= vp.width) break
    }
    return { maxGap, reach, width: vp.width, H: vp.height, offset: window.__gallery.current }
  })
  check('Gallery lặp liên tục (không lộ khoảng trống lớn sau nhiều vòng kéo)', cover.reach >= cover.width && cover.maxGap < cover.H * 0.12, cover)
  await page.screenshot({ path: `${OUT}/screenshots/gallery-after-loop.png` })
  await vp.focus()
  const k0 = await page.evaluate(() => window.__gallery.target)
  await page.keyboard.press('ArrowRight')
  const k1 = await page.evaluate(() => window.__gallery.target)
  check('Gallery điều khiển được bằng phím mũi tên', k1 !== k0, { k0, k1 })
  await page.close()
}

async function mobileTest() {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const requests = []
  page.on('request', (r) => requests.push(r.url()))
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 60))
    }
  })
  await page.waitForTimeout(800)
  const info = await page.evaluate(() => ({
    three: !!window.__threeLoaded,
    canvas: document.querySelectorAll('canvas').length,
    mode: document.documentElement.dataset.mode,
    overflowX: document.scrollingElement.scrollWidth - innerWidth,
    heroImg: (() => {
      const i = document.querySelector('[data-chapter="hero"] img')
      return { complete: i.complete, w: i.naturalWidth, src: i.currentSrc.slice(0, 80) }
    })(),
    buttons: [...document.querySelectorAll('.pill, .icon-button')].map((b) => {
      const r = b.getBoundingClientRect()
      return [Math.round(r.width), Math.round(r.height)]
    }),
  }))
  const glb = requests.filter((u) => /\.glb|\.gltf/.test(u))
  const jsBytes = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.initiatorType === 'script').reduce((a, e) => a + e.transferSize, 0))
  check('Mobile: không tải three.js / model 3D, không có canvas', !info.three && info.canvas === 0 && glb.length === 0, { ...info, glb, jsKB: Math.round(jsBytes / 1024) })
  check('Mobile: ảnh hero tải được, không tràn ngang', info.heroImg.complete && info.heroImg.w > 0 && info.overflowX <= 0, info.heroImg)
  check('Mobile: nút bấm ≥ 44×44 px', info.buttons.every(([w, h]) => w >= 44 && h >= 44), { buttons: info.buttons })
  // Chụp theo từng màn hình (fullPage trên thiết bị giả lập mobile có thể ghép ảnh lặp).
  const total = await page.evaluate(() => document.body.scrollHeight)
  for (let y = 0, i = 1; y < total; y += 844 * 1.5, i++) {
    await page.evaluate((y) => window.scrollTo(0, y), y)
    await page.waitForTimeout(1100)
    await page.screenshot({ path: `${OUT}/screenshots/mobile-${String(i).padStart(2, '0')}.png` })
  }
  await ctx.close()
}

async function reducedMotionTest() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  const info = await page.evaluate(() => ({
    three: !!window.__threeLoaded,
    canvas: document.querySelectorAll('canvas').length,
    hidden: [...document.querySelectorAll('.reveal, .chapter__text')].filter((el) => parseFloat(getComputedStyle(el).opacity) < 1).length,
    anims: document.getAnimations().length,
  }))
  check('Giảm chuyển động: không 3D, nội dung hiện ngay, không animation', !info.three && info.canvas === 0 && info.hidden === 0 && info.anims === 0, info)
  await page.screenshot({ path: `${OUT}/screenshots/reduced-motion.png`, fullPage: true })
  await ctx.close()
}

async function keyboardTest() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  const seq = []
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    seq.push(
      await page.evaluate(() => {
        const el = document.activeElement
        const cs = getComputedStyle(el)
        return { tag: el.tagName, text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40), outline: cs.outlineStyle !== 'none' }
      }),
    )
  }
  check('Bàn phím: thứ tự Tab hợp lý, có viền focus', seq[0].text.startsWith('Bỏ qua') && seq.every((s) => s.outline), { seq })
  // Bấm liên kết "Thông số" → cuộn tới đúng cảnh bản vẽ.
  await page.goto(`${BASE}/?debug`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__story?.debug?.frame, null, { timeout: 90000 })
  await page.click('nav a[href="#thong-so"]')
  await page.waitForTimeout(2500)
  const lines = await page.evaluate(() => window.__story.state.lines)
  check('Điều hướng "Thông số" đưa tới cảnh bản vẽ', lines > 0.99, { lines })
  await page.close()
}

async function headersTest() {
  const res = await fetch(`${BASE}/`)
  const h = Object.fromEntries(res.headers)
  const need = ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'x-frame-options', 'strict-transport-security']
  const html = await res.text()
  const asset = html.match(/\/_next\/static\/[^"']+\.js/)?.[0]
  const cache = asset ? (await fetch(BASE + asset)).headers.get('cache-control') : null
  check('Header bảo mật có mặt, không lộ X-Powered-By', need.every((k) => h[k]) && !h['x-powered-by'], { csp: h['content-security-policy'] })
  check('Tài nguyên tĩnh /_next/static có cache immutable', /immutable/.test(cache ?? ''), { asset, cache })
  const secrets = /(sk_live|sk_test|api[_-]?key|secret)["'\s:=]/i.test(html)
  check('HTML không chứa chuỗi giống khóa bí mật', !secrets)
}

try {
  await headersTest()
  await desktopStory({ width: 1440, height: 900 })
  await desktopStory({ width: 1280, height: 720 })
  await desktopStory({ width: 1920, height: 1080 })
  await galleryTest()
  await fpsTest()
  await mobileTest()
  await reducedMotionTest()
  await keyboardTest()
} catch (e) {
  check('Script kiểm thử chạy hết', false, { error: String(e) })
} finally {
  writeFileSync(`${OUT}/verify-report.json`, JSON.stringify(report, null, 2))
  const failed = report.checks.filter((c) => !c.pass).length
  console.log(`\n${report.checks.length - failed}/${report.checks.length} kiểm tra đạt`)
  await browser.close()
  if (server) process.kill(-server.pid)
  process.exitCode = failed ? 1 : 0
}
