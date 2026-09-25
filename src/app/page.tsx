import { SiteHeader } from '@/components/SiteHeader'
import { Story } from '@/components/Story'
import { Gallery } from '@/components/gallery/Gallery'
import { BuySection } from '@/components/BuySection'
import { RevealObserver } from '@/components/Reveal'
import { product, buy } from '@/content/product'
import { sceneImages, galleryImages } from '@/content/media'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

/** JSON-LD chỉ chứa dữ liệu đã có; giá/offer được thêm khi có thông tin thật. */
function productJsonLd() {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: [sceneImages.hero, ...galleryImages.slice(0, 3)].map((m) => new URL(m.src.src, siteUrl).toString()),
  }
  if (product.brand) data.brand = { '@type': 'Brand', name: product.brand }
  if (product.price && buy.configured) data.offers = { '@type': 'Offer', url: buy.href, availability: 'https://schema.org/InStock' }
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="noi-dung">
        <Story />
        <section className="gallery" id="thu-vien" aria-labelledby="gallery-title">
          <div className="gallery__head">
            <p className="eyebrow">Thư viện</p>
            <h2 id="gallery-title">Mọi góc nhìn.</h2>
          </div>
          <Gallery />
        </section>
        <BuySection />
      </main>
      <footer className="site-footer">
        <p>© {new Date().getFullYear()} {product.brand ?? 'Tên thương hiệu (cần cung cấp)'}.</p>
        <p className="muted">Hình ảnh, model 3D và thông số trên trang hiện là placeholder, chưa phải dữ liệu chính thức.</p>
      </footer>
      <RevealObserver />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd() }} />
    </>
  )
}
