import { Nav } from '@/components/Nav'
import { Preloader } from '@/components/Preloader'
import { ExperienceMount } from '@/components/ExperienceMount'
import { RevealObserver } from '@/components/RevealObserver'
import { Contact, Exploded, Finish, Footer, Hero, Materials, Partners, Room, Specs, Statement } from '@/components/sections/Sections'
import { images } from '@/content/media'
import { brand, brandName, seo } from '@/content/site'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

/** JSON-LD chỉ chứa dữ liệu đã có; giá/offer/thương hiệu được thêm khi có thông tin thật. */
function productJsonLd() {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: brand.model ?? `${brandName} — ${brand.category}`,
    description: seo.description,
    image: [images.hero, images.finishGraphite].map((m) => new URL(m.src.src, siteUrl).toString()),
  }
  if (brand.name) data.brand = { '@type': 'Brand', name: brand.name }
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export default function Home() {
  return (
    <>
      <Preloader />
      <Nav />
      <main id="noi-dung">
        <Hero />
        <Statement />
        <Exploded />
        <Specs />
        <Materials />
        <Finish />
        <Room />
        <Partners />
        <Contact />
      </main>
      <Footer />
      <ExperienceMount />
      <RevealObserver />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd() }} />
    </>
  )
}
