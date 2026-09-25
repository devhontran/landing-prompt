# Tài nguyên cần cung cấp

Mọi mục dưới đây hiện đang là **placeholder có gắn nhãn** trên trang. Không có thông số nào được tự đặt ra — các ô chưa có dữ liệu đều hiện "Cần cung cấp".

## 1. Những ý tưởng phụ thuộc vào cấu trúc model / tài nguyên chưa có

| Ý tưởng | Phụ thuộc vào | Nếu thiếu thì sao |
|---|---|---|
| Highlight lần lượt **củ loa → bo mạch → vỏ loa** | Model phải **tách thành các node riêng**: `Driver`, `PCB`, `Enclosure`, `BackPanel`. Model marketing thường gộp thành một mesh → không highlight được. | Cần file CAD/model đã tách bộ phận. Loader báo lỗi rõ ràng và giữ model placeholder. |
| **Thấy bo mạch bên trong** | Model phải có **hình học bên trong** (PCB, mặt trong vỏ) và nắp lưng là node riêng để tách ra. | Model chỉ có vỏ ngoài → cảnh bo mạch trống. |
| **Thông số cạnh chi tiết tương ứng** | Vị trí điểm neo. Tốt nhất là các empty `Anchor_*` trong model (xem mục 2). | Thiếu anchor → dùng tâm hộp bao của bộ phận, có thể lệch điểm cần chỉ. |
| **Phong cách bản vẽ kỹ thuật** | Nét được sinh tự động bằng `EdgesGeometry` (cạnh > 35°) + shader fresnel cho mặt cong. Lưới tessellation từ CAD rất dày sẽ cho nét rối. | Cần model đã giảm lưới/retopology sạch; có thể chỉnh ngưỡng góc trong `partRig.ts`. |
| Vùng khung, góc camera từng cảnh | Model được chuẩn hóa: gốc ở tâm khối loa, trục **+Z là mặt trước**, cao khoảng **2.3 đơn vị**. | Model lệch trục/tỷ lệ → phải chỉnh lại các góc `rotY/pitch/radius` trong `storyState.ts`. |
| Ảnh tĩnh mobile + gallery | Ảnh chụp sản phẩm thật, hoặc render từ model thật (`npm run capture` render lại tự động khi model thật đã được nạp). | Đang là ảnh render từ model placeholder, có nhãn "PLACEHOLDER". |
| Vật liệu cảnh cấu tạo ("hiện vật liệu đầy đủ") | Vật liệu PBR thật trong GLB (baseColor/roughness/metalness/normal). | Đang dùng vật liệu mô phỏng. |

## 2. Model 3D — `public/models/speaker.glb`

- Định dạng: **glTF binary (.glb)**, nén hình học **Meshopt** (`EXT_meshopt_compression`), texture **WebP** (`EXT_texture_webp`), tối đa 2048 px.
- Ngân sách đề xuất: **≤ 3 MB** sau nén, **≤ 150k tam giác**, ≤ 20 draw call sau khi gộp mesh cùng vật liệu.
- Lệnh gợi ý: `npx @gltf-transform/cli optimize input.glb public/models/speaker.glb --compress meshopt --texture-compress webp --texture-size 2048`
- Cấu trúc node **bắt buộc**: `Driver`, `PCB`, `Enclosure`, `BackPanel`.
- Node **khuyến nghị** (Empty/Object3D): `Anchor_driver`, `Anchor_port`, `Anchor_io`, `Anchor_knob`, `Anchor_amp`, `Anchor_height`, `Anchor_width`, `Anchor_body`, `Anchor_shell`.
- Sau khi đặt file: sửa `model.url` trong `src/content/product.ts` thành `'/models/speaker.glb?v=1'` (tăng `v` mỗi lần thay file vì model được cache `immutable` 1 năm), rồi chạy `npm run capture` để render lại ảnh tĩnh.

## 3. Ảnh — `src/assets/`

| File | Dùng cho | Kích thước đề xuất |
|---|---|---|
| `scenes/hero.webp`, `back`, `blueprint`, `driver`, `pcb`, `enclosure`, `final` | Mobile + chế độ giảm chuyển động (mỗi cảnh một ảnh) | 1200 × 1200 |
| `gallery/view-1..8.webp` | Gallery | 1080 × 1350 (4:5) |
| `src/app/opengraph-image.jpg` | Ảnh chia sẻ mạng xã hội | 1200 × 630 |

Giữ nguyên tên file để không phải sửa code; cập nhật `alt`/`caption` và đặt `placeholder: false` trong `src/content/media.ts`. Next.js tự sinh AVIF/WebP theo kích thước màn hình.

## 4. Nội dung & thông số — `src/content/product.ts`

- Tên sản phẩm (`product.name`, đặt `namePlaceholder: false`), thương hiệu (`product.brand`), giá (`product.price`).
- Thông số bản vẽ (`specs[].value`): chiều cao, rộng × sâu, khối lượng, cổng thoát hơi, cổng kết nối, điều khiển.
- Bảng thông số (`specSheet`): kích thước, khối lượng, củ loa, công suất, dải tần, kết nối, nguồn, chất liệu vỏ.
- Vật liệu từng bộ phận (`parts[].materials`).
- Duyệt lại các câu mô tả (hiện là copy mẫu viết chung, không chứa số liệu).

## 5. Biến môi trường (xem `.env.example`)

- `NEXT_PUBLIC_BUY_URL` — URL trang mua hàng (bắt buộc `https://`). Đây là URL công khai, **không phải khóa bí mật**.
- `NEXT_PUBLIC_SITE_URL` — domain chính thức (canonical, Open Graph, sitemap).
