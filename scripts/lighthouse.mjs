/**
 * Chạy Lighthouse (mobile + desktop) trên bản build production.
 *   npm run build && npm run lighthouse     (tự chạy `next start` ở cổng 3300)
 * Kết quả: reports/lighthouse-{mobile,desktop}.html + reports/lighthouse-summary.json
 * Lưu ý: trong container không GPU, WebGL chạy bằng SwiftShader nên điểm Performance desktop bị kéo xuống.
 */
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import * as chromeLauncher from 'chrome-launcher'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

mkdirSync('reports', { recursive: true })
let server
let BASE = process.env.BASE_URL
if (!BASE) {
  BASE = 'http://localhost:3300'
  server = spawn('npx', ['next', 'start', '-p', '3300'], { stdio: ['ignore', 'pipe', 'inherit'], detached: true })
  await new Promise((res) => server.stdout.on('data', (d) => /Ready|ready/.test(String(d)) && res()))
}
const runs = Number(process.env.RUNS ?? 3)
const summary = {}
try {
  // Chrome headless không có chuột → media query (hover/pointer) khiến trang chạy nhánh ảnh tĩnh.
  // 'desktop-3d' giả lập chuột để đo đúng nhánh WebGL (three.js + R3F + GSAP).
  const MOUSE = '--blink-settings=primaryPointerType=4,primaryHoverType=2,availablePointerTypes=4,availableHoverTypes=2'
  const profiles = [
    ['mobile', undefined, []],
    ['desktop-static', desktopConfig, []],
    ['desktop-3d', desktopConfig, [MOUSE]],
  ]
  const only = process.env.PROFILES?.split(',')
  for (const [name, config, flags] of profiles.filter(([n]) => !only || only.includes(n))) {
    const results = []
    let retries = 0
    for (let i = 0; i < runs; i++) {
      const chrome = await chromeLauncher.launch({
        chromePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium',
        chromeFlags: ['--headless=new', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...flags],
      })
      try {
        const r = await lighthouse(`${BASE}/`, { port: chrome.port, output: ['html', 'json'], logLevel: 'error' }, config)
        const lhr = r.lhr
        if (lhr.runtimeError || lhr.categories.performance.score === null) {
          console.log(name, i + 1, 'lỗi lượt chạy:', lhr.runtimeError?.code, '→ chạy lại')
          if (++retries <= 3) i--
          continue
        }
        const scores = Object.fromEntries(Object.entries(lhr.categories).map(([k, c]) => [k, Math.round(c.score * 100)]))
        const m = (id) => lhr.audits[id]?.displayValue
        results.push({ scores, jsKB: Math.round(lhr.audits['network-requests'].details.items.filter((q) => q.resourceType === 'Script').reduce((a, q) => a + q.transferSize, 0) / 1024), lcp: m('largest-contentful-paint'), tbt: m('total-blocking-time'), cls: m('cumulative-layout-shift'), fcp: m('first-contentful-paint'), si: m('speed-index'), html: r.report[0], failing: Object.values(lhr.audits).filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode === 'binary' || (a.score !== null && a.score < 0.5 && a.scoreDisplayMode === 'numeric')).map((a) => a.id) })
        console.log(name, i + 1, JSON.stringify(results.at(-1).scores), 'LCP', results.at(-1).lcp, 'TBT', results.at(-1).tbt, 'CLS', results.at(-1).cls, 'JS', results.at(-1).jsKB + 'KB')
      } finally {
        await chrome.kill()
      }
    }
    // Lấy lần chạy trung vị theo điểm performance.
    results.sort((a, b) => a.scores.performance - b.scores.performance)
    const median = results[Math.floor(results.length / 2)]
    if (!only) writeFileSync(`reports/lighthouse-${name}.html`, median.html)
    summary[name] = { median: { ...median, html: undefined }, all: results.map((r) => r.scores) }
  }
} finally {
  if (!process.env.PROFILES) writeFileSync('reports/lighthouse-summary.json', JSON.stringify(summary, null, 2))
  if (server) process.kill(-server.pid)
}
console.log(JSON.stringify(summary, null, 2))
