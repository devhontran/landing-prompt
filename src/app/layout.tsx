import type { Metadata, Viewport } from 'next'
import { Be_Vietnam_Pro } from 'next/font/google'
import { product } from '@/content/product'
import './globals.css'

const font = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-sans',
})

/** [CẦN CUNG CẤP] Domain chính thức qua NEXT_PUBLIC_SITE_URL (dùng cho canonical, Open Graph, sitemap). */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const title = `${product.name} — ${product.tagline}`

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description: product.description,
  applicationName: product.name,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: '/',
    title,
    description: product.description,
    siteName: product.brand ?? product.name,
  },
  twitter: { card: 'summary_large_image', title, description: product.description },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0b',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

/** Chạy trước lần vẽ đầu: bật class `js` để CSS chọn bố cục 3D / hiệu ứng fade ngay, không nháy, không CLS. */
const bootScript = `document.documentElement.classList.add('js');if(/[?&]static\\b/.test(location.search))document.documentElement.dataset.mode='static'`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={font.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
