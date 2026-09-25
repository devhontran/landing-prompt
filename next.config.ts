import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV !== 'production'

/**
 * Content-Security-Policy.
 * - Trang được render tĩnh (không có nonce theo request) nên script inline của Next cần 'unsafe-inline'.
 * - 'wasm-unsafe-eval' cho bộ giải nén Meshopt (WASM) khi nạp model .glb đã nén.
 * - Không có bên thứ ba: mọi tài nguyên đều từ 'self'. Nếu thêm analytics/CDN, bổ sung domain tại đây.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
  "worker-src 'self' blob:",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Trình duyệt bỏ qua HSTS trên http://localhost; có hiệu lực khi triển khai qua HTTPS.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [70, 80],
    deviceSizes: [480, 640, 828, 1080, 1280, 1600],
    imageSizes: [256, 384],
    // Ảnh import tĩnh đã có hash trong URL; bản tối ưu được cache 31 ngày.
    minimumCacheTTL: 2678400,
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        source: '/basis/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }],
      },
      {
        // Model 3D trong /public/models: đổi tham số ?v= trong src/content/product.ts mỗi khi thay file.
        source: '/models/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
}

export default nextConfig
