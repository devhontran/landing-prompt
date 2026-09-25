import type { Metadata, Viewport } from 'next'
import { Manrope } from 'next/font/google'
import { brand, brandName, seo } from '@/content/site'
import './globals.css'

// Brief yêu cầu TT Norms Pro (font thương mại, chưa có license) → dùng Manrope (có tiếng Việt). [CẦN CUNG CẤP] file font có license nếu muốn đổi.
const manrope = Manrope({ subsets: ['latin', 'vietnamese'], display: 'swap', variable: '--font-manrope' })

/** [CẦN CUNG CẤP] Domain chính thức qua NEXT_PUBLIC_SITE_URL (canonical, Open Graph, sitemap). */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: seo.title,
  description: seo.description,
  applicationName: brandName,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: '/',
    title: seo.title,
    description: seo.description,
    siteName: brand.name ?? brand.category,
  },
  twitter: { card: 'summary_large_image', title: seo.title, description: seo.description },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#070b20',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

/**
 * Chạy trước lần vẽ đầu: bật class `js`; ép chế độ tĩnh khi ?static, tiết kiệm dữ liệu hoặc CPU < 4 luồng
 * (CSS chọn bố cục ngay → không nháy, không CLS). Phòng hờ: preloader tự gỡ sau 8s nếu script 3D lỗi.
 */
const bootScript = `(function(d){var h=d.documentElement;h.classList.add('js');var n=navigator,c=n.connection;if(/[?&]static\\b/.test(location.search)||(c&&c.saveData)||(n.hardwareConcurrency||8)<4)h.dataset.mode='static';setTimeout(function(){h.dataset.loaded='true'},8000)})(document)`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={manrope.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
