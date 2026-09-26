# Tài nguyên cần cung cấp (TODO)

Mọi mục dưới đây hiện là **placeholder có gắn nhãn** trên trang (`[CẦN CUNG CẤP]`, badge "Ảnh placeholder"). Không có thông số nào được tự đặt ra — các con số ví dụ trong brief **không** được dùng.

## 1. Nội dung — `src/content/site.ts`

| TODO | Trường | Hiện đang hiển thị |
|---|---|---|
| Tên thương hiệu (wordmark giãn chữ) | `brand.name` | `BRAND` |
| Tên model | `brand.model` | `[TÊN MODEL]` |
| Giá (nếu muốn hiển thị) | `brand.price` | không hiển thị |
| Giá trị cho chú thích kỹ thuật (chiều cao, rộng × sâu) | `callouts` (hiện chỉ có nhãn) | nhãn không số |
| Dải tần đáp ứng (Hz) | `specs[0].value` | khung số mờ `00–00 000` |
| Độ nhạy (dB) | `specs[1].value` | `00` |
| Khối lượng mỗi chiếc (kg) | `specs[2].value` | `00` |
| Xác nhận danh sách vật liệu (nhôm / vỏ phủ mờ / óc chó) | `materials` | copy minh hoạ + nhãn "Cần xác nhận" |
| Xác nhận 3 phiên bản Graphite / Silver / Walnut | `finishes` | minh hoạ + nhãn "Cần xác nhận" |
| Diện tích phòng phù hợp (m²) | `room.size` | `[CẦN CUNG CẤP]` |
| Logo 3 đối tác / giải thưởng | `partners[].name` (+ file logo SVG) | `[LOGO — CẦN CUNG CẤP]` |
| Danh sách showroom (form) | `showrooms` | select trống |
| Địa chỉ showroom (footer) | `footer.address` | `[ĐỊA CHỈ]` |
| Mạng xã hội | `footer.social` | `[MẠNG XÃ HỘI]` |
| Duyệt copy (tagline, tuyên ngôn, mô tả) | `hero`, `statement`, `room`… | copy mẫu, không chứa số liệu |

## 2. Model 3D — thay model placeholder

Hiện dùng **model thủ tục** (`src/components/three/proceduralSpeaker.ts`, loa khối để bàn — bản 3D được giữ từ phiên bản trước theo yêu cầu).

- File: `public/models/speaker.glb` — glTF binary, nén **Meshopt**, texture **KTX2/Basis** (transcoder tự chép vào `public/basis/` khi `npm install`) hoặc WebP ≤ 2048 px. Ngân sách: ≤ 3 MB, ≤ 150k tam giác.
- **Node bắt buộc**: `Driver`, `PCB`, `Enclosure`, `BackPanel` (câu chuyện soi lần lượt từng bộ phận — model gộp một mesh sẽ không làm được).
- **Điểm neo khuyến nghị** (Empty): `Anchor_driver`, `Anchor_port`, `Anchor_io`, `Anchor_knob`, `Anchor_amp`, `Anchor_height`, `Anchor_width`, `Anchor_body`, `Anchor_shell` — vạch chú thích trỏ vào đây.
- Model cần **hình học bên trong** (bo mạch, mặt trong vỏ) và nắp lưng là node riêng.
- Tách rời: glTF extras `explode: [x, y, z]` trên từng khối. Chuẩn hoá: gốc ở tâm khối loa, **+Z là mặt trước**, cao ≈ 2.3 đơn vị.
- Vật liệu vỏ có tên mesh kết thúc bằng `_shell` sẽ nhận bộ đổi phiên bản (Graphite/Silver/Walnut). Nạp bằng `loadGlb.ts`, rồi `npm run capture` để render lại ảnh tĩnh.
- Texture quét thật cho gỗ óc chó (hiện là texture thủ tục trong `textures.ts`).

## 3. Ảnh — `src/assets/` (hiện render từ model placeholder, có nhãn)

| File | Dùng cho | Kích thước |
|---|---|---|
| `hero.webp` | Hero (mobile / giảm chuyển động) | 1200 × 1500 |
| `statement.webp` | Mặt sau loa (mobile) | 1200 × 900 |
| `exploded.webp` | Exploded view (mobile) | 1200 × 1200 |
| `finish-graphite/silver/walnut.webp` | Chọn phiên bản (mobile) | 1200 × 1200 |
| `material-aluminium.webp`, `material-shell.webp`, `material-walnut.webp` | Cặp ảnh vật liệu 4:3 | 1200 × 900 |
| `room.webp` | Không gian nghe (ảnh chụp phòng thật) | 1920 × 1080 |
| `src/app/opengraph-image.jpg` | Chia sẻ mạng xã hội | 1200 × 630 |

Giữ tên file, cập nhật `alt` và đặt `placeholder: false` trong `src/content/media.ts`. **Không dùng ảnh stock** (brief).

## 4. Font

Brief chỉ định TT Norms Pro (font thương mại, chưa có license) → đang dùng **Manrope** (Google Fonts, có tiếng Việt). Nếu có file license: đặt vào `src/app/fonts/` và đổi sang `next/font/local` trong `layout.tsx` (giữ biến `--font-manrope` hoặc sửa `--font` trong `tokens.css`).

## 5. Biến môi trường (xem `.env.example`)

- `NEXT_PUBLIC_SITE_URL` — domain chính thức (canonical, OG, sitemap).
- `NEXT_PUBLIC_CATALOGUE_URL` — PDF catalogue (https). Công khai, không phải khoá bí mật.
- `BOOKING_WEBHOOK_URL` — **chỉ server**, nhận form đặt lịch. Chưa cấu hình → API trả 503, form báo rõ.
