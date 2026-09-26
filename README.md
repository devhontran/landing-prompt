# Landing page — Loa hi-end (art direction LIKOVA)

Landing page một trang, cuộn dọc, 3D thời gian thực: loa được trình bày như một công trình kiến trúc — nền navy đêm, khối vuông vức, góc "cắn", tab cắm vào khung, wordmark giãn chữ, hàng thông số 3 cột với vạch 1px chạy theo cuộn.
Next.js 16 (App Router) · React 19 · TypeScript · Three.js + React Three Fiber · GSAP ScrollTrigger · Lenis.

> ⚠️ Tên thương hiệu, model, thông số, logo đối tác, showroom, địa chỉ, model 3D và ảnh hiện đều là **placeholder có gắn nhãn** (`[CẦN CUNG CẤP]`, "Ảnh placeholder"). Không có số liệu nào được tự đặt ra.
> Danh sách TODO đầy đủ: [`ASSETS_NEEDED.md`](./ASSETS_NEEDED.md).

## Chạy dự án

Yêu cầu Node.js ≥ 20.9.

```bash
npm install
cp .env.example .env.local      # NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_CATALOGUE_URL, BOOKING_WEBHOOK_URL (server)
npm run dev                     # http://localhost:3000
npm run build && npm start      # production
```

| Lệnh | Việc làm |
|---|---|
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run verify` | Playwright trên bản build: chuỗi cảnh 3D theo cuộn, model không đè chữ, cuộn ngược, canvas tạm dừng, checklist thiết kế (không bo góc, không shadow, in hoa, weight ≤ 450, cỡ chữ theo token, một easing, notch, không cuộn ngang), mobile, giảm chuyển động, bàn phím, form, API, header bảo mật. Ảnh từng section → `docs/screenshots/` |
| `npm run lighthouse` | Lighthouse mobile / desktop tĩnh / desktop 3D (3 lần, trung vị) |
| `npm run profile` | Spector.js: draw call / tam giác từng cảnh |
| `npm run capture` | Render lại ảnh tĩnh (mobile, vật liệu, phòng nghe, OG) từ cảnh 3D qua `/capture` (chỉ dev) |

`/?static` ép chế độ ảnh tĩnh.

## Cấu trúc

```
src/styles/tokens.css            token màu / chữ / lưới / easing (đúng brief)
src/app/globals.css              hệ thống: 4+1 cỡ chữ, lưới 12→6→1 cột, .notch, .btn, nav, section, chế độ 3D
src/content/site.ts              TOÀN BỘ nội dung (null = chưa có dữ liệu → hiện [CẦN CUNG CẤP])
src/content/media.ts             ảnh tĩnh + alt
src/components/sections/*        Hero, Statement, Exploded, Specs, Materials, Finish, Room, Partners, Contact, Footer, BookingForm, FinishSelector
src/components/three/*           proceduralSpeaker.ts (model placeholder), partRig.ts (vật liệu ↔ nét bản vẽ), effects.ts (sàn phản chiếu, bụi, lưới),
                                 stageController.ts (camera + damping/spring), storyState.ts (timeline câu chuyện 0–100), director.ts (cuộn), Experience.tsx
src/app/api/booking/route.ts     nhận form → webhook phía server
```

## Nhịp trang

| # | Section | Nền | Desktop 3D | Mobile / giảm chuyển động |
|---|---|---|---|---|
| 1 | Preloader ~2.5s | navy | model được "in" ra: nét bản vẽ tự vẽ rồi mặt quét đi lên phủ vật liệu; panel trắng cắn góc + bộ đếm 000→100%, panel trượt về đúng vị trí tab hero (transform + clip-path, CLS 0) | không có |
| 2 | Hero | sáng → tối | nav 50px; tab trắng nửa trái chứa wordmark + icon tròn 20px; cuộn → dolly-in, loa bắt đầu quay, tab thu nhỏ bay vào logo nav | ảnh tĩnh |
| 3 | Tuyên ngôn | tối | câu 32px (dòng đầu thụt vào cột 7); loa trượt xuống khung dưới câu tuyên ngôn và quay hẳn ra mặt sau (cổng thoát hơi, cổng kết nối) | ảnh mặt sau |
| 4 | Cấu tạo | tối | ghim 5 màn hình: vật liệu tan thành **bản vẽ kỹ thuật** (nét tự vẽ, đường kích thước, lưới) với chú thích chiều cao / rộng × sâu / cổng / núm → **tách rời** (spring), camera tiến lần lượt tới **củ loa → bo mạch → vỏ loa**, bộ phận đang kể hiện vật liệu, phần còn lại giữ nét → lắp lại. Mỗi chú thích: vạch 1px + nhãn 11px + số trong vòng 16px | danh sách chi tiết + ảnh |
| 5 | Thông số | tối | 3 hàng, mỗi hàng ghim 1 màn hình; vạch 1px vẽ trái → phải theo cuộn; số lớn căn phải (placeholder mờ) | tĩnh |
| 6 | Vật liệu | sáng #e3e6eb | cặp ảnh 4:3 cách 10px, khung cắn góc 100px | như desktop |
| 7 | Phiên bản | tối | loa hạ xuống góc thấp trên sàn phản chiếu, màng loa "thở" cùng gợn sóng sàn; nút viền 1px cắn góc (30% → 100%); vỏ crossfade 0.5s Graphite / Silver / Walnut | ảnh crossfade |
| 8 | Không gian nghe | tối | ảnh full-bleed parallax, tab navy ghi diện tích phòng | không parallax |
| 9 | Đối tác | sáng | 3 panel navy 453×473, nhãn trên-trái, logo giữa, dấu + dưới-phải | như desktop |
| 10 | Đặt lịch + footer | tối | wordmark lớn, CTA trắng cắn góc + CTA viền, form gạch chân, footer 11px | như desktop |

Chuyển động: một easing duy nhất `cubic-bezier(0.7, 0, 0.3, 1)` (CSS, GSAP `CustomEase`, three.js dùng chung `src/lib/ease.ts`), thời lượng 0.5 / 1 / 2s; chữ trượt khỏi mặt nạ theo dòng (stagger 0.1s); hover chỉ: khép góc khuyết, chữ 60%, viền 30 → 100%. Không scale / nhấc / glow.

## Kiến trúc 3D

- **Một câu chuyện liên tục** (`storyState.ts`, timeline 0–100, trạng thái đích là hàm thuần của vị trí cuộn): mặt trước → quay 360° một chiều → mặt sau → bản vẽ → tách rời, soi củ loa / bo mạch / vỏ → lắp lại → chân dung trên sàn phản chiếu. `StageController` đuổi theo đích bằng damping (camera chậm, điện ảnh) và spring (tách rời có chút nảy cơ khí).
- **Gắn với layout LIKOVA** (`director.ts`): mỗi sân khấu DOM (hero, khung tuyên ngôn, section cấu tạo ghim, khung phiên bản) giữ một đoạn timeline; vị trí cuộn trong sân khấu → thời điểm; khung hình camera lấy từ hình chữ nhật DOM → model luôn khớp bố cục và **trượt giữa các vị trí** khi chuyển section. Cuộn ngược → y hệt.
- **Một canvas cố định, nền trong suốt**: trong preloader nằm trên nội dung, sau đó nằm dưới; section sáng che nó. Section không có 3D (thông số, vật liệu, phòng nghe, đối tác, đặt lịch): model tan bằng mặt quét, canvas ẩn và **không vẽ frame nào**. `frameloop="demand"`.
- Ánh sáng: key ấm `#ffe2bd` trên-phải, rim lạnh `#9fb3ff` thấp, môi trường studio tối (0.55). Không bóng realtime. FOV 26.
- **Chế độ**: 3D chỉ khi desktop ≥ 1024px, chuột, không giảm chuyển động, có WebGL2, CPU ≥ 4 luồng, không tiết kiệm dữ liệu. Còn lại: ảnh tĩnh, **không tải three.js**.

## Bảo mật

- Header (`next.config.ts`): CSP (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'`…), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP, HSTS; tắt `X-Powered-By`.
- Form đặt lịch: kiểm tra phía client + server (422), chỉ nhận JSON (415), honeypot chống spam, giới hạn độ dài, timeout 8s. Webhook `BOOKING_WEBHOOK_URL` chỉ ở server; chưa cấu hình → 503 và form báo rõ, không giả vờ thành công.
- Biến công khai duy nhất: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CATALOGUE_URL` (chỉ nhận `https://`).
- CSP còn `'unsafe-inline'` cho script (trang tĩnh, không nonce). `/capture` trả 404 ở production.

## Kết quả kiểm tra (25/09/2026, container không có GPU — Chromium dùng SwiftShader)

Số liệu thô: `reports/verify-report.json`, `reports/lighthouse-summary.json`, `reports/profile.json`. Ảnh: [`docs/screenshots/`](./docs/screenshots).

- `build`, `lint`, `typecheck`: không lỗi.
- `npm run verify`: **81/81 đạt** (gồm từng cảnh của câu chuyện: mặt sau ở tuyên ngôn, bản vẽ + 5 chú thích kỹ thuật, soi củ loa, soi bo mạch, lắp lại).
- Spector.js (1440×900): hero 24 draw call / 12.6k tam giác; bản vẽ + tách rời 37 / 12.5k; phiên bản (có pass phản chiếu sàn) 49 / 25.2k. Model 0 KB (dựng bằng code).

| Lighthouse (trung vị 3 lần) | Perf | A11y | BP | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| Mobile | 97 | 100 | 100 | 100 | 2.6 s | 90 ms | 0 |
| Desktop, nhánh ảnh tĩnh | 100 | 100 | 100 | 100 | 0.5 s | 0 ms | 0 |
| Desktop, nhánh 3D | **70** | 100 | 100 | 100 | 0.5 s | 1.62 s | 0 |

**Chưa đạt:** mục tiêu desktop Performance ≥ 85 ở nhánh 3D. TBT ~1.6s đến từ render WebGL bằng CPU (SwiftShader): mỗi frame chặn luồng chính hàng chục–trăm ms, FPS khi cuộn chỉ ~13 fps; preloader kéo dài ~8s trong môi trường này. Trên GPU thật 24–49 draw call là rẻ, nhưng **chưa đo được trên máy thật** — cần chạy Lighthouse/FPS trên desktop có GPU để kết luận.
