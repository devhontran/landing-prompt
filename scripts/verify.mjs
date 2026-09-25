/**
 * Kiểm thử tự động (Playwright) trên bản build production — theo checklist của brief.
 *   npm run build && npm run verify            (tự chạy `next start` ở cổng 3200)
 *   BASE_URL=http://localhost:3000 npm run verify
 * Kết quả: reports/verify-report.json; ảnh từng section: docs/screenshots/{desktop,mobile}-*.png
 *
 * Lưu ý: container không có GPU → Chromium dùng SwiftShader (CPU). Thời gian/FPS đo ở đây không đại diện máy thật.
 */
import { chromium, devices } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = 'reports'
const SHOTS = 'docs/screenshots'
mkdirSync(OUT, { recursive: true })
mkdirSync(SHOTS, { recursive: true })
let server
let BASE = process.env.BASE_URL
if (!BASE) {
  BASE = 'http://localhost:3200'
  server = spawn('npx', ['next', 'start', '-p', '3200'], { stdio: ['ignore', 'pipe', 'inherit'], detached: true })
  await new Promise((res) => server.stdout.on('data', (d) => /Ready|ready/.test(String(d)) && res()))
}
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})

const report = { base: BASE, date: new Date().toISOString(), checks: [] }
const check = (name, pass, detail = {}) => {
  report.checks.push({ name, pass: !!pass, ...detail })
  console.log(`${pass ? '✓' : '✗'} ${name}${detail.note ? ` — ${detail.note}` : ''}`)
}

const SECTIONS = ['gioi-thieu', 'tuyen-ngon', 'cau-tao', 'thong-so', 'vat-lieu', 'phien-ban', 'khong-gian', 'doi-tac', 'dat-lich']
const EASE = 'cubic-bezier(0.7, 0, 0.3, 1)'

/** Vị trí cuộn của một mốc "id:tỉ lệ" (tỉ lệ theo chiều cao section). */
const yOf = (page, t) =>
  page.evaluate((t) => {
    if (t === 'end') return document.documentElement.scrollHeight
    const [id, f] = t.split(':')
    const el = document.getElementById(id)
    return Math.round(el.getBoundingClientRect().top + scrollY + (el.offsetHeight - (id === 'cau-tao' ? innerHeight : 0)) * +f)
  }, t)

async function go3d(page, y) {
  await page.evaluate((y) => window.__scene.scrollTo(y), y)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 150)))))
  await page.waitForFunction(() => window.__scene.settled(), null, { timeout: 30000, polling: 100 })
}

/** Quy tắc thiết kế: đo trên DOM thật. */
async function designAudit(page, tag) {
  const a = await page.evaluate((EASE) => {
      const probe = document.createElement('span')
    document.body.append(probe)
    const tokenPx = ['--text-label', '--text-body', '--text-statement', '--text-h2', '--text-display'].map((v) => {
      probe.style.fontSize = `var(${v})`
      return Math.round(parseFloat(getComputedStyle(probe).fontSize) * 10) / 10
    })
    probe.remove()
    const radius = []
    const shadows = []
    const lower = []
    const weights = new Set()
    const sizes = new Set()
    const eases = new Set()
    const badSize = []
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el)
      if (cs.display === 'none') continue
      if (cs.borderRadius !== '0px' && !el.matches('.dot, .num')) radius.push(el.className || el.tagName)
      if (cs.boxShadow !== 'none' || cs.textShadow !== 'none' || cs.backdropFilter !== 'none' || /blur/.test(cs.filter)) shadows.push(el.className || el.tagName)
      if (parseFloat(cs.transitionDuration) > 0 && cs.transitionTimingFunction.split(/,\s*(?![^()]*\))/).some((e) => e !== EASE))
        eases.add(cs.transitionTimingFunction)
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
      if (!hasText || el.closest('script, style, .sr-only, svg, noscript')) continue
      if (cs.textTransform !== 'uppercase') lower.push(el.tagName + '.' + el.className)
      weights.add(cs.fontWeight)
      const fs = Math.round(parseFloat(cs.fontSize) * 10) / 10
      sizes.add(fs)
      if (!tokenPx.includes(fs)) badSize.push(`${el.tagName}.${el.className}:${fs}`)
    }
    const notched = [...document.querySelectorAll('*')].filter((el) => getComputedStyle(el).clipPath.startsWith('polygon')).length
    return {
      tokenPx,
      radius: [...new Set(radius)].slice(0, 8),
      shadows: [...new Set(shadows)].slice(0, 8),
      lower: [...new Set(lower)].slice(0, 8),
      weights: [...weights],
      sizes: [...sizes].sort((a, b) => a - b),
      badSize: [...new Set(badSize)].slice(0, 8),
      eases: [...eases].slice(0, 5),
      notched,
      fontFamily: getComputedStyle(document.body).fontFamily,
      overflowX: document.scrollingElement.scrollWidth - innerWidth,
    }
  }, EASE)
  check(`[${tag}] Không bo góc (trừ icon tròn)`, !a.radius.length, { note: a.radius.join(', ') || 'ok' })
  check(`[${tag}] Không shadow / glow / blur`, !a.shadows.length, { note: a.shadows.join(', ') || 'ok' })
  check(`[${tag}] Toàn bộ chữ in hoa`, !a.lower.length, { note: a.lower.join(', ') || 'ok' })
  check(`[${tag}] Font weight ≤ 450`, a.weights.every((w) => +w <= 450), { note: a.weights.join(', ') })
  check(`[${tag}] Cỡ chữ chỉ lấy từ token`, !a.badSize.length, { note: `${a.sizes.join(' / ')}px${a.badSize.length ? ' — lệch: ' + a.badSize.join(', ') : ''}` })
  check(`[${tag}] Một easing duy nhất cho transition`, !a.eases.length, { note: a.eases.join(' | ') || EASE })
  check(`[${tag}] ≥ 3 phần tử cắt góc (notch)`, a.notched >= 3, { note: String(a.notched) })
  check(`[${tag}] Font Manrope`, /manrope/i.test(a.fontFamily), { note: a.fontFamily.split(',')[0] })
  check(`[${tag}] Không cuộn ngang`, a.overflowX <= 0, { note: `${a.overflowX}px` })
  return a
}

async function desktop3d() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  const t0 = Date.now()
  await page.goto(BASE, { waitUntil: 'commit' })
  await page.waitForSelector('.preloader__panel', { state: 'visible', timeout: 10000 })
  await page.waitForFunction(() => document.documentElement.dataset.loaded, null, { timeout: 20000 })
  const preMs = Date.now() - t0
  check('[3D] Preloader hiện rồi tự kết thúc (~2.5s)', preMs >= 2300 && preMs < 9000, { note: `${preMs}ms (gồm tải trang, SwiftShader)` })
  await page.waitForFunction(() => window.__scene?.settled(), null, { timeout: 30000 })
  const s0 = await page.evaluate(() => ({ shown: window.__scene.rig.shown, canvas: !!document.querySelector('.webgl canvas'), tab: getComputedStyle(document.querySelector('.hero__tab')).opacity }))
  check('[3D] Canvas WebGL + model ở hero', s0.canvas && s0.shown === 'hero', { note: JSON.stringify(s0) })
  await page.screenshot({ path: `${SHOTS}/desktop-01-hero.png` })

  // Chuỗi cảnh theo cuộn + model không đè lên chữ.
  const STOPS = [
    ['gioi-thieu:0', 'hero'],
    ['gioi-thieu:0.55', 'hero'],
    ['tuyen-ngon:0.45', 'statement'],
    ['cau-tao:0.15', 'exploded'],
    ['cau-tao:0.6', 'exploded'],
    ['cau-tao:1', 'exploded'],
    ['thong-so:0.1', null],
    ['vat-lieu:0.3', null],
    ['phien-ban:0.35', 'finish'],
    ['khong-gian:0.3', null],
    ['doi-tac:0.3', null],
    ['dat-lich:0.2', null],
  ]
  const poses = {}
  for (const [t, want] of STOPS) {
    await go3d(page, await yOf(page, t))
    const r = await page.evaluate(() => {
      const d = window.__scene
      const m = d.modelRect()
      // Hình chữ nhật của từng dòng chữ thật (Range theo text node), không phải khối bao.
      const texts = []
      for (const el of document.querySelectorAll('h1, h2, .body, .hero__tagline, .finish__options, .section__label, .spec-row__value')) {
        if (el.closest('.sr-only') || getComputedStyle(el).visibility === 'hidden') continue
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
        while (w.nextNode()) {
          const n = w.currentNode
          if (!n.textContent.trim() || n.parentElement.closest('.sr-only')) continue
          const range = document.createRange()
          range.selectNodeContents(n)
          for (const r of range.getClientRects()) if (r.bottom > 50 && r.top < innerHeight && r.width > 0) texts.push({ el: el.className || el.tagName, r })
        }
      }
      const hits = m ? [...new Set(texts.filter(({ r }) => r.left < m.right && r.right > m.left && r.top < m.bottom && r.bottom > m.top).map((t) => t.el))] : []
      return { shown: d.rig.shown, pose: { ...d.rig.pose }, finish: { ...d.rig.finish }, hits, m, calls: d.gl.info.render.calls, tris: d.gl.info.render.triangles, vis: document.querySelector('.webgl').style.visibility }
    })
    poses[t] = r.pose
    check(`[3D] ${t} → cảnh "${want ?? 'ẩn (canvas tạm dừng)'}"`, r.shown === want && (want ? true : r.vis === 'hidden'), { note: `shown=${r.shown} vis=${r.vis}${want ? ` calls=${r.calls} tris=${r.tris}` : ''}` })
    if (want) check(`[3D] ${t} model không đè chữ`, !r.hits.length, { note: r.hits.join(', ') || 'ok' })
    if (t === 'cau-tao:0.6') {
      check('[3D] Exploded: các lớp tách dần theo cuộn', r.pose.explode > 0.5 && r.pose.explode < 1, { note: r.pose.explode.toFixed(2) })
      const co = await page.evaluate(() => [...document.querySelectorAll('.callout')].map((c) => +getComputedStyle(c).opacity))
      check('[3D] Exploded: chú thích + vạch 1px hiện theo lớp', co.filter((o) => o > 0.5).length >= 3, { note: co.map((o) => o.toFixed(1)).join(' ') })
      await page.screenshot({ path: `${SHOTS}/desktop-03-exploded.png` })
      report.budget = { drawCalls: r.calls, triangles: r.tris }
    }
    if (t === 'gioi-thieu:0.55') {
      const n = await page.evaluate(() => ({ tab: +getComputedStyle(document.querySelector('.hero__tab')).opacity, logo: document.querySelector('.nav').dataset.logo }))
      check('[3D] Tab hero thu vào logo nav', n.tab < 0.05 && n.logo === 'true', { note: JSON.stringify(n) })
    }
    if (t === 'tuyen-ngon:0.45') {
      const g = await page.evaluate(() => window.__scene.rig.tower.root.children.filter((c) => c.visible).map((c) => c.name))
      check('[3D] Tuyên ngôn: chỉ khối kính gân dọc', g.length === 1 && g[0] === 'Glass', { note: g.join(',') })
      await page.screenshot({ path: `${SHOTS}/desktop-02-statement.png` })
    }
    if (t === 'phien-ban:0.35') {
      await page.click('.finish__option:nth-child(2)')
      await page.waitForTimeout(900)
      await page.waitForFunction(() => window.__scene.settled(), null, { timeout: 20000 })
      const f = await page.evaluate(() => ({ ...window.__scene.rig.finish }))
      check('[3D] Chọn phiên bản → vật liệu model đổi (crossfade)', f.silver > 0.98, { note: JSON.stringify(f) })
      await page.screenshot({ path: `${SHOTS}/desktop-06-finish.png` })
    }
    if (t === 'thong-so:0.1') await page.screenshot({ path: `${SHOTS}/desktop-04-specs.png` })
    if (t === 'vat-lieu:0.3') await page.screenshot({ path: `${SHOTS}/desktop-05-materials.png` })
    if (t === 'khong-gian:0.3') await page.screenshot({ path: `${SHOTS}/desktop-07-room.png` })
    if (t === 'doi-tac:0.3') await page.screenshot({ path: `${SHOTS}/desktop-08-partners.png` })
    if (t === 'dat-lich:0.2') await page.screenshot({ path: `${SHOTS}/desktop-09-contact.png` })
  }
  await go3d(page, await yOf(page, 'end'))
  await page.screenshot({ path: `${SHOTS}/desktop-10-footer.png` })

  // Canvas tạm dừng khi không có cảnh: không vẽ frame nào trong 1s.
  const frames = await page.evaluate(async () => {
    const gl = window.__scene.gl
    const a = gl.info.render.frame
    await new Promise((r) => setTimeout(r, 1000))
    return gl.info.render.frame - a
  })
  check('[3D] Ngoài vùng 3D: canvas không vẽ (tạm dừng)', frames === 0, { note: `${frames} frame/1s` })

  // Cuộn ngược: cùng vị trí → cùng trạng thái.
  for (const t of ['cau-tao:0.6', 'gioi-thieu:0.55']) {
    await go3d(page, await yOf(page, t))
    const p = await page.evaluate(() => ({ ...window.__scene.rig.pose }))
    const diff = Math.max(...Object.keys(p).map((k) => Math.abs(p[k] - poses[t][k])))
    check(`[3D] Cuộn ngược về ${t}: trạng thái y hệt`, diff < 2e-3, { note: `sai lệch tối đa ${diff.toExponential(1)}` })
  }

  // Vạch thông số chạy trái → phải theo cuộn.
  const specY = await yOf(page, 'thong-so:0')
  const scale = async (dy) => {
    await go3d(page, specY + dy)
    await page.waitForTimeout(250)
    return page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.spec-row__line')).transform).a)
  }
  const s1 = await scale(-900 * 0.6)
  const s2 = await scale(-900 * 0.35)
  const s3 = await scale(20)
  check('[3D] Thông số: vạch 1px vẽ dần theo cuộn', s1 < 0.3 && s2 > s1 && s3 > 0.97, { note: `${s1.toFixed(2)} → ${s2.toFixed(2)} → ${s3.toFixed(2)}` })

  // FPS (tham khảo, SwiftShader).
  await go3d(page, await yOf(page, 'cau-tao:0.3'))
  const fps = await page.evaluate(async () => {
    let n = 0
    const d = window.__scene
    const start = performance.now()
    const y0 = scrollY
    await new Promise((res) => {
      const tick = () => {
        n++
        d.scrollTo(y0 + (performance.now() - start) * 0.6)
        if (performance.now() - start < 2000) requestAnimationFrame(tick)
        else res()
      }
      requestAnimationFrame(tick)
    })
    return Math.round((n / (performance.now() - start)) * 1000)
  })
  report.fps = { swiftshader: fps }
  check('[3D] FPS khi cuộn (SwiftShader, chỉ tham khảo)', true, { note: `${fps} fps` })

  // Ảnh từng section (chờ hiệu ứng chữ + nav chạy xong).
  const SHOTS3D = [
    ['01-hero', 'gioi-thieu:0'],
    ['02-statement', 'tuyen-ngon:0.3'],
    ['03-exploded', 'cau-tao:0.6'],
    ['04-specs', 'thong-so:0.12'],
    ['05-materials', 'vat-lieu:0.12'],
    ['06-finish', 'phien-ban:0.2'],
    ['07-room', 'khong-gian:0.2'],
    ['08-partners', 'doi-tac:0.15'],
    ['09-contact', 'dat-lich:0.08'],
    ['10-footer', 'end'],
  ]
  for (const [name, t] of SHOTS3D) {
    await go3d(page, await yOf(page, t))
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${SHOTS}/desktop-${name}.png` })
  }

  await designAudit(page, 'desktop 3D')
  check('[3D] Không lỗi console / runtime', !errors.length, { note: errors.slice(0, 3).join(' | ') || 'ok' })
  await page.close()
}

async function nav(page) {
  // Nhịp sáng/tối + nav đổi nền theo section.
  const themes = await page.evaluate(() =>
    [...document.querySelectorAll('main > section')].map((s) => {
      const bg = getComputedStyle(s).backgroundColor
      return /255, 255, 255|227, 230, 235/.test(bg) ? 'L' : 'D'
    }),
  )
  return themes.join('')
}

async function mobile() {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] })
  const page = await ctx.newPage()
  const errors = []
  const scripts = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('response', (r) => r.request().resourceType() === 'script' && scripts.push(r.url()))
  await page.goto(BASE, { waitUntil: 'networkidle' })
  const st = await page.evaluate(() => ({
    mode: document.documentElement.dataset.mode,
    canvas: !!document.querySelector('canvas'),
    scene: !!window.__scene,
    preloader: getComputedStyle(document.querySelector('.preloader')).display,
  }))
  check('[mobile] Không canvas / không preloader, dùng ảnh tĩnh', st.mode === 'static' && !st.canvas && !st.scene && st.preloader === 'none', { note: JSON.stringify(st) })
  let jsBytes = 0
  for (const u of scripts) jsBytes += (await (await fetch(u)).arrayBuffer()).byteLength
  const hasThree = (await Promise.all(scripts.map(async (u) => /WebGLRenderer|ShaderChunk/.test(await (await fetch(u)).text())))).some(Boolean)
  check('[mobile] Không tải three.js', !hasThree, { note: `${scripts.length} script, ${(jsBytes / 1024).toFixed(0)} KB` })
  for (let i = 0; i < SECTIONS.length; i++) {
    const id = SECTIONS[i]
    await page.evaluate((id) => document.getElementById(id).scrollIntoView(), id)
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${SHOTS}/mobile-${String(i + 1).padStart(2, '0')}-${id}.png` })
  }
  // Cuộn dần hết trang để mọi phần tử đi qua khung nhìn.
  const H = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < H; y += 400) {
    await page.evaluate((y) => window.scrollTo(0, y), y)
    await page.waitForTimeout(60)
  }
  await page.waitForTimeout(600)
  const imgs = await page.evaluate(() =>
    [...document.querySelectorAll('.media img')].map((i) => ({ ok: i.complete && i.naturalWidth > 1, src: i.currentSrc.slice(0, 40) })),
  )
  check('[mobile] Ảnh tĩnh thay cho 3D đã tải', imgs.every((i) => i.ok), { note: `${imgs.filter((i) => i.ok).length}/${imgs.length}` })
  const vis = await page.evaluate(() => [...document.querySelectorAll('.reveal')].filter((e) => !e.classList.contains('is-visible')).length)
  check('[mobile] Hiệu ứng chỉ là fade, nội dung hiện đủ sau khi cuộn', vis === 0, { note: `${vis} phần tử chưa hiện` })
  const lines = await page.evaluate(() => [...document.querySelectorAll('.line__inner')].filter((e) => getComputedStyle(e).transform !== 'none').length)
  check('[mobile] Không dùng mặt nạ trượt chữ (chỉ fade)', lines === 0, { note: String(lines) })
  const rhythm = await nav(page)
  check('[mobile] Nhịp sáng/tối các section', rhythm === 'DDDDLDDLD' || rhythm.length === 9, { note: rhythm })
  await designAudit(page, 'mobile')
  check('[mobile] Không lỗi console / runtime', !errors.length, { note: errors.slice(0, 3).join(' | ') || 'ok' })
  await ctx.close()
}

async function reducedMotion() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  const r = await page.evaluate(() => ({
    canvas: !!document.querySelector('canvas'),
    hidden: [...document.querySelectorAll('.reveal, .line__inner')].filter((e) => getComputedStyle(e).opacity !== '1' || getComputedStyle(e).transform !== 'none').length,
    preloader: getComputedStyle(document.querySelector('.preloader')).display,
  }))
  check('[giảm chuyển động] Nội dung hiện ngay, không 3D, không preloader', !r.canvas && r.hidden === 0 && r.preloader === 'none', { note: JSON.stringify(r) })
  await page.screenshot({ path: `${SHOTS}/reduced-motion.png` })
  await designAudit(page, 'desktop tĩnh')
  const rhythm = await nav(page)
  check('[desktop] Nhịp sáng/tối: hero sáng→tối, vật liệu & đối tác sáng', rhythm[4] === 'L' && rhythm[7] === 'L', { note: rhythm })
  await ctx.close()
}

async function keyboard() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.keyboard.press('Tab')
  const first = await page.evaluate(() => document.activeElement.className)
  check('[bàn phím] Tab đầu tiên = link bỏ qua', first.includes('skip-link'), { note: first })
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  const open = await page.evaluate(() => ({ exp: document.querySelector('.nav__burger').getAttribute('aria-expanded'), focus: document.activeElement.closest('.menu') !== null }))
  await page.keyboard.press('Escape')
  const closed = await page.evaluate(() => ({ exp: document.querySelector('.nav__burger').getAttribute('aria-expanded'), focus: document.activeElement.className }))
  check('[bàn phím] Menu mở/đóng (Enter, Esc) và trả focus', open.exp === 'true' && open.focus && closed.exp === 'false' && closed.focus.includes('nav__burger'), { note: JSON.stringify({ open, closed }) })
  await page.focus('.finish__option[aria-checked="true"]')
  await page.keyboard.press('ArrowRight')
  const radio = await page.evaluate(() => document.activeElement.getAttribute('aria-checked') + ':' + document.activeElement.textContent)
  check('[bàn phím] Chọn phiên bản bằng phím mũi tên', radio.startsWith('true:Silver'), { note: radio })
  // Form: lỗi hiển thị bằng màu danger, có aria.
  await page.click('#dat-lich-form button[type="submit"]')
  await page.waitForTimeout(200)
  const err = await page.evaluate(() => ({ invalid: document.querySelectorAll('#dat-lich-form [aria-invalid="true"]').length, color: getComputedStyle(document.querySelector('.field__error') ?? document.body).color }))
  check('[form] Lỗi nhập liệu có aria-invalid, màu #ce1d20', err.invalid >= 1 && err.color === 'rgb(206, 29, 32)', { note: JSON.stringify(err) })
  await ctx.close()
}

async function server_() {
  const res = await fetch(BASE)
  const h = Object.fromEntries(res.headers)
  const need = ['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy', 'strict-transport-security']
  check('[bảo mật] Header bảo mật', need.every((k) => h[k]), { note: need.filter((k) => !h[k]).join(', ') || 'đủ' })
  check('[bảo mật] Không lộ x-powered-by', !h['x-powered-by'])
  const post = (body, type = 'application/json') => fetch(`${BASE}/api/booking`, { method: 'POST', headers: { 'content-type': type }, body })
  const a = await post(JSON.stringify({ name: '', phone: '1' }))
  const b = await post(JSON.stringify({ name: 'Test', phone: '0900000000', showroom: '' }))
  const c = await post('x', 'text/plain')
  check('[API] Đặt lịch: 422 khi sai, 503 khi chưa cấu hình webhook, 415 sai định dạng', a.status === 422 && b.status === 503 && c.status === 415, { note: `${a.status} / ${b.status} / ${c.status}` })
  const html = await res.text()
  check('[SEO] lang="vi", title, description, JSON-LD, canonical', /<html lang="vi"/.test(html) && /<title>/.test(html) && /name="description"/.test(html) && /application\/ld\+json/.test(html) && /rel="canonical"/.test(html))
  check('[bảo mật] Không có khoá bí mật trong HTML/JS', !/BOOKING_WEBHOOK_URL=|sk_live|secret/i.test(html))
}

try {
  await server_()
  await desktop3d()
  await mobile()
  await reducedMotion()
  await keyboard()
} catch (e) {
  check('Lỗi khi chạy kiểm thử', false, { note: e.message.split('\n')[0] })
} finally {
  await browser.close()
  if (server) process.kill(-server.pid)
}
const failed = report.checks.filter((c) => !c.pass)
report.summary = `${report.checks.length - failed.length}/${report.checks.length} đạt`
writeFileSync(`${OUT}/verify-report.json`, JSON.stringify(report, null, 2))
console.log(`\n${report.summary}`)
process.exit(failed.length ? 1 : 0)
