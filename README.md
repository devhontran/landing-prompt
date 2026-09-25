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
| `npm run capture` | Render lại ảnh tĩnh (mobile/gallery/OG) từ cảnh 3D qua trang nội bộ `/capture` (chỉ có ở dev) |

Công cụ debug: mở `/?debug` để thấy FPS và dữ liệu cảnh (`window.__story`, `window.__gallery`); `/?static` để ép chế độ ảnh tĩnh.

## Hành trình

| Cảnh | Desktop 3D (scrub theo cuộn) | Mobile / giảm chuyển động |
|---|---|---|
| Hero | Toàn bộ loa, chữ ở cột trái | Tiêu đề + ảnh hero |
| 01 Thiết kế | Loa xoay từ mặt trước sang mặt sau | Ảnh mặt sau |
| 02 Thông số | Chuyển sang bản vẽ kỹ thuật (nét + lưới + đường kích thước); thông số xuất hiện lần lượt ở hai cột, có đường dẫn tới đúng chi tiết | Ảnh bản vẽ + danh sách thông số |
| 03 Cấu tạo | Góc nhìn sau-trên, nắp lưng tách ra để thấy bo mạch; highlight **củ loa → bo mạch → vỏ loa**: bộ phận đang giới thiệu hiện vật liệu đầy đủ, phần còn lại chuyển sang nét | Mỗi bộ phận một ảnh + chú thích vật liệu |
| 04 Hoàn thiện | Loa đặt trên mặt phẳng, shader sàn (bóng tiếp xúc + sóng âm lan ra); nút Mua ngay | Ảnh + nút Mua ngay |
| Thư viện | Grid ngẫu hứng lặp vô hạn, kéo chuột có quán tính, shader uốn cong + tách kênh màu theo vận tốc kéo | Dải cuộn ngang gốc (scroll-snap) |
| Đặt hàng | Giá, bảng thông số, nút Mua ngay lớn | như desktop |

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

- **Cuộn ngược luôn đúng**: trạng thái 3D là một object số được timeline GSAP tween; ScrollTrigger `scrub` điều khiển timeline. Không có callback một chiều nên mọi vị trí cuộn (kể cả nhảy thẳng) cho đúng một trạng thái.
- **Chữ không che model**: mỗi cảnh khai báo vùng khung (`fx, fy, fw, fh`); camera tự tính khoảng cách để khối cầu bao của model nằm trọn trong vùng đó, còn chữ nằm ở cột riêng trong CSS. `npm run verify` đo khung bao thật của model trên màn hình và kiểm tra giao với từng khối chữ ở 3 kích thước màn hình.
- **Không CLS, không tải thừa**: bố cục 3D/tĩnh do CSS media query quyết định từ lần vẽ đầu. Ảnh tĩnh nằm trong `<picture>` có nguồn 1×1 cho desktop 3D nên desktop không tải ảnh; mobile không tải three.js/R3F/GSAP (chunk động không bao giờ được yêu cầu).
- **Hiệu năng 3D**: model placeholder gộp mesh theo vật liệu (tối đa 66 draw call / ~24k tam giác ở cảnh bản vẽ), ánh sáng môi trường dựng sẵn 64 px (không tải HDR), shader được biên dịch bất đồng bộ trước khi hiện model, khởi tạo chia nhỏ theo từng bước và chỉ bắt đầu khi trình duyệt rảnh, `frameloop="demand"` (chỉ vẽ khi cuộn, trừ sàn có sóng), dừng vẽ khi ra khỏi màn hình, DPR tối đa 1.75. Không dùng particle — không phục vụ câu chuyện đủ để đổi lấy chi phí.
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

Số liệu thô: [`reports/verify-report.json`](./reports/verify-report.json), [`reports/lighthouse-summary.json`](./reports/lighthouse-summary.json). Ảnh chụp chọn lọc: [`docs/screenshots/`](./docs/screenshots).

- `npm run build`, `npm run lint`, `npm run typecheck`: không lỗi, không cảnh báo.
- `npm run verify`: **55/55 đạt** — trình tự 10 mốc cảnh × 3 kích thước (1280×720, 1440×900, 1920×1080); chữ không giao khung bao model, không tràn ngang; cuộn ngược từng bước và nhảy thẳng từ cuối về đầu khôi phục đúng trạng thái; gallery kéo được, lặp qua hơn 2 chu kỳ không lộ khoảng trống, điều khiển được bằng phím; mobile không tải three.js/model, không có canvas (137 KB JS); giảm chuyển động hiện nội dung ngay, không có animation; thứ tự Tab và viền focus; header bảo mật; cache immutable.
- **Lighthouse** (trung vị của 3 lần chạy):

| Cấu hình | Performance | Accessibility | Best practices | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| Mobile (mặc định Lighthouse, 4G chậm) | 97 | 100 | 100 | 100 | 2.6 s | 40 ms | 0 |
| Desktop, nhánh ảnh tĩnh* | 100 | 100 | 100 | 100 | 0.6 s | 0 ms | 0 |
| Desktop, nhánh 3D (giả lập chuột) | 72 | 100 | 100 | 100 | 1.2 s | 730 ms | 0 |

\* Chrome headless không có chuột nên Lighthouse desktop mặc định chạy nhánh ảnh tĩnh; lượt "nhánh 3D" dùng `--blink-settings` để giả lập chuột.

- **FPS**: 9.6 fps trung bình khi cuộn hết phần kể chuyện (p95 317 ms/frame) — đo trên **SwiftShader (render bằng CPU)**, không đại diện cho máy desktop có GPU. Chưa đo được trên thiết bị desktop thật trong môi trường này; hãy mở `/?debug` trên máy đại diện để xem bộ đếm FPS.

### Vấn đề còn lại

- TBT của nhánh 3D (0.6–0.8 s) chủ yếu là dựng PMREM (~350 ms) và biên dịch shader lần đầu trên SwiftShader, cộng ~320 KB JS three.js/R3F/GSAP. Trên GPU thật các bước này nhanh hơn nhiều nhưng chưa được đo.
- CSP còn `'unsafe-inline'` cho script (trang tĩnh, không có nonce).
- Gallery trên mobile là dải cuộn ngang gốc, không lặp vô hạn (có chủ đích: thao tác gốc dễ dùng hơn trên cảm ứng, không có animation).
- Mọi nội dung sản phẩm còn là placeholder — xem `ASSETS_NEEDED.md`.
