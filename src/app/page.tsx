import { SiteHeader } from '@/components/SiteHeader'
import { Story } from '@/components/Story'
import { Gallery } from '@/components/gallery/Gallery'
import { BuySection } from '@/components/BuySection'
import { RevealObserver } from '@/components/Reveal'
import { product, buy, chapters } from '@/content/product'
import { Arrow, Lines, Meta } from '@/components/Typo'
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
        <section className="gallery" id={chapters.gallery.id} aria-labelledby="gallery-title">
          <div className="gallery__head reveal">
            <Meta index={chapters.gallery.index} label={chapters.gallery.eyebrow} total={`${String(galleryImages.length).padStart(2, '0')} góc nhìn`} />
            <h2 id="gallery-title" className="t-display">
              <Lines lines={chapters.gallery.lines} />
            </h2>
          </div>
          <Gallery />
        </section>
        <BuySection />
      </main>
      <footer className="site-footer">
        <div className="site-footer__row">
          <p className="meta">
            <span className="meta__label">© {new Date().getFullYear()} {product.brand ?? 'Thương hiệu (cần cung cấp)'}</span>
          </p>
          <p className="site-footer__note">Hình ảnh, model 3D và thông số trên trang hiện là placeholder, chưa phải dữ liệu chính thức.</p>
          <a className="meta site-footer__top" href={`#${chapters.hero.id}`}>
            <span className="meta__label">Lên đầu trang</span>
            <Arrow dir="up" />
          </a>
        </div>
        <p className="site-footer__mark" aria-hidden="true">
          {product.brand ?? product.name}
        </p>
      </footer>
      <RevealObserver />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd() }} />
    </>
  )
}
