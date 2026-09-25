# Landing page — Loa để bàn cao cấp

Landing page kể câu chuyện thiết kế và cấu tạo của một mẫu loa để bàn, dẫn tới nút **Mua ngay**.
Next.js 16 (App Router) · React 19 · TypeScript · Three.js + React Three Fiber · GSAP ScrollTrigger.

> ⚠️ Model 3D, ảnh, thông số, tên sản phẩm, giá và URL mua hàng hiện đều là **placeholder có gắn nhãn**.
> Danh sách đầy đủ và yêu cầu kỹ thuật: [`ASSETS_NEEDED.md`](./ASSETS_NEEDED.md).

## Chạy dự án

Yêu cầu Node.js ≥ 20.9.

```bash
npm install
cp .env.example .env.local      # điền NEXT_PUBLIC_BUY_URL, NEXT_PUBLIC_SITE_URL
npm run dev                     # http://localhost:3000
npm run build && npm start      # bản production
```

| Lệnh | Việc làm |
|---|---|
| `npm run lint` / `npm run typecheck` | ESLint (core-web-vitals + TS) / kiểm tra kiểu |
| `npm run verify` | Kiểm thử Playwright trên bản build: trình tự cảnh, chồng lấn chữ–model, cuộn ngược, gallery, mobile, giảm chuyển động, bàn phím, header bảo mật, FPS. Kết quả ở `reports/` |
| `npm run lighthouse` | Lighthouse mobile + desktop (3 lần, lấy trung vị) → `reports/lighthouse-*.html` |
| `npm run profile` | Spector.js: draw call / tam giác từng cảnh + payload + thời gian khởi tạo → `reports/profile.json` |
| `npm run capture` | Render lại ảnh tĩnh (mobile/gallery/OG) từ cảnh 3D qua trang nội bộ `/capture` (chỉ có ở dev) |

Công cụ debug: mở `/?debug` để thấy FPS và dữ liệu cảnh (`window.__story`, `window.__gallery`); `/?static` để ép chế độ ảnh tĩnh.

## Hành trình

| Cảnh | Desktop 3D (cuộn → đích, cảnh đuổi theo bằng damping/spring) | Mobile / giảm chuyển động |
|---|---|---|
| Hero | Model được "in" ra khi tải trang: nét tự vẽ rồi mặt quét đi lên, mép cắt sáng ấm; vệt sáng softbox + bụi lơ lửng | Tiêu đề + ảnh hero |
| 01 Thiết kế | Loa quay sang mặt sau (quay một chiều suốt câu chuyện), camera nhích gần để xem cổng | Ảnh mặt sau |
| 02 Thông số | Mặt quét hạ từ đỉnh xuống: vật liệu tan thành nét bản vẽ đang tự vẽ; nền chuyển lạnh, lưới hiện; đường kích thước vẽ dần; thông số ra lần lượt ở hai cột có đường dẫn | Ảnh bản vẽ + danh sách thông số |
| 03 Cấu tạo | **Exploded view**: 6 khối tách theo trục bằng spring; lần lượt **củ loa → bo mạch → vỏ loa** được "in" vật liệu, camera tiến về đúng bộ phận, các khối khác giữ nét; cuối cùng lắp lại | Mỗi bộ phận một ảnh + chú thích vật liệu |
| 04 Hoàn thiện | Góc thấp chính diện, sàn phản chiếu với sóng âm lan ra làm méo ảnh phản chiếu, màng loa "thở" cùng nhịp; nền ấm trở lại; nút Mua ngay | Ảnh + nút Mua ngay |
| Thanh tiến độ | Dải mảnh ở chân màn hình, tô màu theo cuộn, sáng chương hiện tại | — |
| Thư viện | Grid ngẫu hứng lặp vô hạn, kéo có quán tính, parallax trong khung + uốn theo vận tốc kéo | Dải cuộn ngang gốc (scroll-snap) |
| Đặt hàng | Giá, bảng thông số, nút Mua ngay lớn | như desktop |

Chữ vào theo từng cảnh: tiêu đề được "lau" từ dưới lên (clip-path) cùng nhịp mặt quét, phần còn lại hiện dần theo thứ tự; khi đã hiện thì giữ nguyên, đủ lâu để đọc.

## Hệ thiết kế (UI)

- **Lưới 12 cột**, lề `clamp(16px, 3.2vw, 56px)`, khoảng cột `clamp(12px, 1.4vw, 24px)`; đường kẻ tóc làm khung cho mọi khối chữ.
- **Chữ**: Geist (display + body, biến thiên, có tiếng Việt) và Geist Mono cho nhãn kỹ thuật. Display rất lớn, chặt (`line-height` 0.82–0.94, `letter-spacing` −0.045 → −0.07em); cỡ theo cả `vw` lẫn `vh` để tiêu đề hero không bao giờ chạm vùng model.
- **Nhãn đánh số** kiểu bản vẽ: `(01) THIẾT KẾ ······ 01 / 04`; thông số và chú thích dùng mono.
- **Nhịp bố cục**: hero và cảnh kết đặt tiêu đề display trải ngang đáy màn hình, model ở trên; các chương giữa đặt chữ ở cột 5 trái; gallery và đặt hàng mở bằng wordmark tràn ngang; footer kết bằng wordmark cắt ở mép dưới.
- **Chuyển động chữ**: mỗi dòng tiêu đề trồi lên sau mặt nạ riêng (mặt nạ nới rộng để không cắt dấu tiếng Việt), nhãn và thân bài hiện dần theo thứ tự. Trên mobile chỉ fade.
- **Chi tiết tương tác**: nút viên thuốc có biểu tượng tròn xoay khi hover, nav dạng capsule, con trỏ "Kéo" bám theo chuột trong gallery, thanh tiến độ chương có bộ đếm phần trăm.

## Kiến trúc cảnh 3D

Một cảnh, một không khí ánh sáng (studio tối, một softbox), bảng màu hạn chế: than chì · champagne ấm · xanh bản vẽ.
Mọi chuyển động đi qua damping (lerp theo thời gian) hoặc spring, không bao giờ nhảy cóc.

| Đối tượng | Geometry | Vật liệu / shader | Tương tác | Chi phí đo được (Spector.js) |
|---|---|---|---|---|
| Loa: vỏ, mặt trước, núm, chân đế, nắp lưng, củ loa, bo mạch | Dựng thủ tục, gộp mesh theo vật liệu | Physical/Standard được patch: **scan-cut**, nhôm xước anisotropy, vỏ có micro-normal, màng loa rung | Cuộn → xoay 1 chiều, exploded (spring), quét cắt. Con trỏ → parallax | 12.5k tam giác, 20–40 draw call tuỳ cảnh |
| Nét bản vẽ | Edges (> 35°) + đường kích thước | Nét **tự vẽ** + fresnel đường bao | Cuộn | 1 draw call/mesh, chỉ khi hiện |
| Ánh sáng | Softbox + rim + kicker + hắt sáng → PMREM 128 px | Environment + 1 đèn chính cùng hướng softbox; ACES, sRGB đặt tường minh | — | ~280 ms một lần (SwiftShader) |
| Nền | Quad full-screen | Vùng sáng đổi nhiệt màu theo chương, lưới bản vẽ, vignette, dither | Cuộn | 1 draw call |
| Vệt sáng + bụi | Hình nón + 500 điểm | Shader cộng sáng, bụi chỉ sáng khi nằm trong vệt | Thời gian | 2 draw call, tắt ở cảnh kỹ thuật |
| Sàn cảnh kết | Plane | **Reflector** nửa độ phân giải + gợn sóng làm méo phản chiếu | Thời gian | Cảnh nặng nhất: 47 draw call, 24k tam giác (gồm pass phản chiếu) |
| Gallery | Plane / ô | Parallax trong khung + uốn theo vận tốc kéo | Kéo | Render chỉ khi đang chuyển động |

**Shader (mỗi cái 2–3 dòng):**

1. **Scan-cut** (`partRig.ts`) — mỗi vật liệu thật discard mọi điểm nằm trên một mặt phẳng ngang `uCut` (có nhiễu nhẹ để mép cắt hữu cơ); mép cắt cộng thêm ánh sáng ấm như vệt laser máy quét. Hạ mặt phẳng = vật liệu tan thành nét bản vẽ; nâng lên = vật liệu được "in" ra. Vật liệu luôn opaque nên không có lỗi sắp xếp trong suốt.
2. **Nét tự vẽ** — mỗi đoạn cạnh mang `aOrder` (đoạn cao vẽ trước) và `aT` (0→1 dọc đoạn); fragment bỏ phần `aT` vượt tiến độ `uDraw`, đầu bút sáng hơn. Nét chỉ hiện phía trên mặt quét, nên nét và vật liệu luôn nối liền nhau.
3. **Fresnel ghost** — cộng sáng theo `1 - |N·V|` để vẽ đường bao cho mặt cong (EdgesGeometry không bắt được), cũng bị cắt theo mặt quét.
4. **Nền** — gradient Gauss quanh tâm vùng khung, pha giữa nhiệt ấm/lạnh theo `uWarmth`; lưới 24/120 px chỉ hiện ở chương bản vẽ; dither ±0.5/255 chống dải màu.
5. **Sàn âm thanh** — Reflector render ảnh phản chiếu nửa độ phân giải; gợn sóng lan theo khoảng cách tới đế (SDF hình hộp bo góc) làm lệch toạ độ lấy mẫu, blur 5 mẫu tăng theo khoảng cách; màng loa rung cùng pha với gợn tại tâm.
6. **Bụi** — điểm trôi theo thời gian, sáng lên khi nằm trong vệt sáng từ softbox; kích thước theo khoảng cách và DPR.
7. **Gallery** — ảnh phóng nhẹ và trượt ngược theo vị trí ô (parallax khung cửa sổ); khi kéo nhanh ảnh co lại và gợn như lụa theo vận tốc.

**Hiệu năng:** DPR tối đa 2, tự hạ xuống 1.5 khi FPS < 50 kéo dài 1 giây; `frameloop="demand"` (chỉ vẽ khi còn đang đuổi theo đích hoặc có hiệu ứng thời gian); dừng hẳn khi tab ẩn hoặc phần kể chuyện ra khỏi màn hình. Shader biên dịch bất đồng bộ trước khi hiện model. Không cấp phát object trong vòng render. Mọi geometry, vật liệu, texture và render target được giải phóng khi unmount.

## Kiến trúc

```
src/
  app/                 layout (metadata, font), page, robots, sitemap, OG image, /capture (dev)
  content/product.ts   MỌI nội dung/thông số (placeholder = null) + URL mua hàng
  content/media.ts     ảnh tĩnh (import tĩnh → URL có hash, cache immutable)
  lib/experience.ts    chọn chế độ '3d' | 'static' (media query + WebGL2 + Save-Data)
  components/
    Story.tsx          HTML ngữ nghĩa của toàn bộ câu chuyện (render server)
    StoryStage.tsx     import động chunk 3D CHỈ khi ở chế độ 3d
    three/
      storyState.ts    trạng thái cảnh (object số) + timeline GSAP
      StoryGL.tsx      Canvas R3F, ScrollTrigger scrub, chú thích + đường dẫn SVG
      stageController  cập nhật camera/vật liệu mỗi frame (render theo yêu cầu)
      partRig.ts       3 lớp mỗi bộ phận: vật liệu thật / fresnel / nét cạnh
      effects.ts       shader sàn cảnh kết + lưới bản vẽ
      proceduralSpeaker.ts  MODEL PLACEHOLDER dựng bằng code
      loadGlb.ts       nạp model thật (Meshopt), kiểm tra tên node
    gallery/           bố cục, engine kéo + WebGL (three thuần)
```

Các quyết định chính:

- **Cuộn ngược luôn đúng**: trạng thái ĐÍCH của cảnh 3D là một object số được timeline GSAP tween, gắn thẳng với vị trí cuộn (`scrub: true`). Không có callback một chiều nên mọi vị trí cuộn (kể cả nhảy thẳng) cho đúng một đích; cảnh hiển thị đuổi theo đích bằng damping/spring nên vẫn mượt.
- **Chữ không che model**: mỗi cảnh khai báo vùng khung (`fx, fy, fw, fh`); camera tự tính khoảng cách để khối cầu bao của model nằm trọn trong vùng đó, còn chữ nằm ở cột riêng trong CSS. `npm run verify` đo khung bao thật của model trên màn hình và kiểm tra giao với từng khối chữ ở 3 kích thước màn hình.
- **Không CLS, không tải thừa**: bố cục 3D/tĩnh do CSS media query quyết định từ lần vẽ đầu. Ảnh tĩnh nằm trong `<picture>` có nguồn 1×1 cho desktop 3D nên desktop không tải ảnh; mobile không tải three.js/R3F/GSAP (chunk động không bao giờ được yêu cầu).
- **Hiệu năng 3D**: xem mục "Kiến trúc cảnh 3D" ở trên. Chunk 3D chỉ bắt đầu khởi tạo khi trình duyệt rảnh, các bước nặng được chia nhỏ (nhường luồng giữa mỗi bước).
- **Giảm chuyển động**: `prefers-reduced-motion: reduce` → chế độ tĩnh, không animation/transition, nội dung hiện ngay.

## Bảo mật

- Header trong `next.config.ts`: CSP (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`…), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `COOP`, HSTS; tắt `X-Powered-By`.
- CSP còn `'unsafe-inline'` cho script vì trang render tĩnh (nonce yêu cầu render động). Nếu cần CSP chặt hơn, chuyển sang nonce qua `src/proxy.ts` (đổi lại trang sẽ render theo request).
- Không có khóa bí mật: biến duy nhất phía trình duyệt là `NEXT_PUBLIC_BUY_URL`/`NEXT_PUBLIC_SITE_URL` (công khai). URL mua hàng được kiểm tra chỉ nhận `https://`.
- `/capture` trả 404 ở production và bị chặn trong `robots.txt`.

## Cache

- `/_next/static/*` (JS, CSS, font, ảnh import tĩnh): `immutable`, 1 năm (mặc định Next.js, URL có hash).
- Ảnh tối ưu `/_next/image`: `minimumCacheTTL` 31 ngày.
- `/models/*`: `public, max-age=31536000, immutable` → đổi `?v=` trong `product.ts` khi thay model.

## Kết quả kiểm tra (25/09/2026, trong container không có GPU)

Số liệu thô: [`reports/verify-report.json`](./reports/verify-report.json), [`reports/lighthouse-summary.json`](./reports/lighthouse-summary.json), [`reports/profile.json`](./reports/profile.json). Ảnh chụp từng section (desktop 1440×900 + mobile): [`docs/screenshots/`](./docs/screenshots).

- `npm run build`, `npm run lint`, `npm run typecheck`: không lỗi.
- `npm run verify`: **55/55 đạt** — 10 mốc cảnh × 3 kích thước màn hình (đo sau khi cảnh đã đứng yên); chữ không giao khung bao model; cuộn ngược từng bước và nhảy thẳng về đầu khôi phục đúng; gallery kéo được, lặp liên tục, điều khiển bằng phím; mobile không tải three.js/model; giảm chuyển động hiện nội dung ngay; bàn phím; header bảo mật; cache.

**Ngân sách 3D — đo bằng Spector.js (1 frame/cảnh, 1440×900):**

| Cảnh | Draw call | Tam giác | Ngân sách |
|---|---|---|---|
| Hero / Thiết kế | 24 | 12.6k | < 100 draw call, < 300k tam giác |
| Bản vẽ | 44 | 12.5k | |
| Exploded — củ loa | 37 | 12.5k | |
| Exploded — bo mạch | 38 | 12.5k | |
| Cảnh kết (có pass phản chiếu) | 47 | 24.2k | |

- Payload 3D: model 0 KB (placeholder dựng bằng code, texture sinh bằng code). Khi có GLB thật, ngân sách là < 3 MB (Meshopt + KTX2). JS nhánh 3D: ~506 KB đã nén (Lighthouse), ~1.7 MB chưa nén.
- Khởi tạo (User Timing, SwiftShader): dựng cảnh 105 ms, môi trường PMREM 278 ms, biên dịch shader 29 ms.

**Lighthouse** (trung vị 3 lần):

| Cấu hình | Performance | Accessibility | Best practices | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| Mobile (4G chậm) | 97 | 100 | 100 | 100 | 2.6 s | 40 ms | 0 |
| Desktop, nhánh ảnh tĩnh | 100 | 100 | 100 | 100 | 0.6 s | 0 ms | 0 |
| Desktop, nhánh 3D (giả lập chuột) | 67 | 100 | 100 | 100 | 0.7 s | 1.1 s | 0 |

- **FPS**: 6 fps trung bình khi cuộn (p95 467 ms) — đo trên **SwiftShader (render bằng CPU)**, không đại diện cho M1 hay iPhone. Chưa đo được trên thiết bị thật; mở `/?debug` trên máy thật để xem FPS (DPR thích ứng sẽ tự hạ 2 → 1.5 nếu dưới 50 fps).

### Vấn đề còn lại

- TBT nhánh 3D (0.5–1.1 s) tăng so với bản trước vì hero giờ render liên tục (intro, bụi, vệt sáng) — trên CPU mỗi frame tốn hàng trăm ms. Trên GPU thật một frame 24–47 draw call là rẻ, nhưng chưa được đo.
- iPhone 12: theo yêu cầu ban đầu, mobile dùng ảnh tĩnh (không tải 3D) nên mục tiêu 30 fps trên iPhone không áp dụng cho bản hiện tại.
- CSP còn `'unsafe-inline'` cho script (trang tĩnh, không nonce).
- Mọi nội dung sản phẩm còn là placeholder — xem `ASSETS_NEEDED.md`.
