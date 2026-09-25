import { buy, chapters, product } from '@/content/product'
import { Arrow } from './Typo'

const NAV = [
  [chapters.back.id, '01', 'Thiết kế'],
  [chapters.blueprint.id, '02', 'Thông số'],
  [chapters.construction.id, '03', 'Cấu tạo'],
  [chapters.gallery.id, '05', 'Thư viện'],
] as const

export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="skip-link" href="#noi-dung">
        Bỏ qua đến nội dung
      </a>
      <a className="skip-link" href={`#${chapters.gallery.id}`}>
        Bỏ qua phần trình diễn, đến thư viện ảnh
      </a>
      <a className="brand" href={`#${chapters.hero.id}`}>
        {product.brand ?? product.name}
      </a>
      <nav aria-label="Các phần của trang">
        <ul>
          {NAV.map(([id, n, label]) => (
            <li key={id}>
              <a href={`#${id}`}>
                <span className="nav__index">{n}</span>
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <a className="pill pill--light" href={buy.href} rel={buy.configured ? 'noopener' : undefined}>
        <span>Mua ngay</span>
        <span className="pill__icon">
          <Arrow />
        </span>
      </a>
    </header>
  )
}
