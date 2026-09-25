# Tài nguyên cần cung cấp (TODO)

Mọi mục dưới đây hiện là **placeholder có gắn nhãn** trên trang (`[CẦN CUNG CẤP]`, badge "Ảnh placeholder"). Không có thông số nào được tự đặt ra — các con số ví dụ trong brief **không** được dùng.

## 1. Nội dung — `src/content/site.ts`

| TODO | Trường | Hiện đang hiển thị |
|---|---|---|
| Tên thương hiệu (wordmark giãn chữ) | `brand.name` | `BRAND` |
| Tên model | `brand.model` | `[TÊN MODEL]` |
| Giá (nếu muốn hiển thị) | `brand.price` | không hiển thị |
| Dải tần đáp ứng (Hz) | `specs[0].value` | khung số mờ `00–00 000` |
| Độ nhạy (dB) | `specs[1].value` | `00` |
| Khối lượng mỗi chiếc (kg) | `specs[2].value` | `00` |
| Xác nhận danh sách vật liệu (nhôm / kính gân / óc chó) | `materials` | copy minh hoạ + nhãn "Cần xác nhận" |
| Xác nhận 3 phiên bản Graphite / Silver / Walnut | `finishes` | minh hoạ + nhãn "Cần xác nhận" |
| Diện tích phòng phù hợp (m²) | `room.size` | `[CẦN CUNG CẤP]` |
| Logo 3 đối tác / giải thưởng | `partners[].name` (+ file logo SVG) | `[LOGO — CẦN CUNG CẤP]` |
| Danh sách showroom (form) | `showrooms` | select trống |
| Địa chỉ showroom (footer) | `footer.address` | `[ĐỊA CHỈ]` |
| Mạng xã hội | `footer.social` | `[MẠNG XÃ HỘI]` |
| Duyệt copy (tagline, tuyên ngôn, mô tả) | `hero`, `statement`, `room`… | copy mẫu, không chứa số liệu |

## 2. Model 3D — thay model placeholder

Hiện dùng **model thủ tục** (`src/components/three/tower.ts`): loa cột tỉ lệ W:D:H = 1 : 1.1 : 3.2, 2 củ + tweeter, mặt kính gân dọc. Lưu ý: bản trước là loa để bàn; brief LIKOVA mô tả loa cột nên placeholder đổi theo brief.

- File: `public/models/speaker.glb` — glTF binary, nén **Meshopt**, texture **KTX2/Basis** (transcoder tự chép vào `public/basis/` khi `npm install`) hoặc WebP ≤ 2048 px. Ngân sách: ≤ 3 MB, ≤ 150k tam giác.
- **Node bắt buộc** (khớp exploded view + chú thích): `Shell`, `Glass`, `Frame`, `Bass`, `Mid`, `Tweeter`, `Crossover`. Model marketing gộp một mesh sẽ không tách lớp được.
- Chuẩn hoá: gốc ở tâm khối loa, **+Z là mặt trước**, +Y lên, cao ≈ 1.6 đơn vị.
- Hướng tách: glTF extras `explode: [x, y, z]` trên từng node (mặc định trong `tower.ts`).
- Vật liệu PBR thật (nhôm anod hoá, kính gân, cao su mờ). Nạp bằng `loadGlb.ts`, thay phần dựng hình trong `Tower` (API `setExplode/setFinish/setGlassOnly` giữ nguyên), rồi `npm run capture` để render lại ảnh tĩnh.
- Texture quét thật cho gỗ óc chó / nhôm phay (hiện là texture thủ tục trong `textures.ts`).

## 3. Ảnh — `src/assets/` (hiện render từ model placeholder, có nhãn)

| File | Dùng cho | Kích thước |
|---|---|---|
| `hero.webp` | Hero (mobile / giảm chuyển động) | 1200 × 1500 |
| `statement.webp` | Khối kính gân (mobile) | 1200 × 900 |
| `exploded.webp` | Exploded view (mobile) | 1200 × 1200 |
| `finish-graphite/silver/walnut.webp` | Chọn phiên bản (mobile) | 1200 × 1200 |
| `material-aluminium.webp`, `material-glass.webp`, `material-walnut.webp` | Cặp ảnh vật liệu 4:3 | 1200 × 900 |
| `room.webp` | Không gian nghe (ảnh chụp phòng thật) | 1920 × 1080 |
| `src/app/opengraph-image.jpg` | Chia sẻ mạng xã hội | 1200 × 630 |

Giữ tên file, cập nhật `alt` và đặt `placeholder: false` trong `src/content/media.ts`. **Không dùng ảnh stock** (brief).

## 4. Font

Brief chỉ định TT Norms Pro (font thương mại, chưa có license) → đang dùng **Manrope** (Google Fonts, có tiếng Việt). Nếu có file license: đặt vào `src/app/fonts/` và đổi sang `next/font/local` trong `layout.tsx` (giữ biến `--font-manrope` hoặc sửa `--font` trong `tokens.css`).

## 5. Biến môi trường (xem `.env.example`)

- `NEXT_PUBLIC_SITE_URL` — domain chính thức (canonical, OG, sitemap).
- `NEXT_PUBLIC_CATALOGUE_URL` — PDF catalogue (https). Công khai, không phải khoá bí mật.
- `BOOKING_WEBHOOK_URL` — **chỉ server**, nhận form đặt lịch. Chưa cấu hình → API trả 503, form báo rõ.
