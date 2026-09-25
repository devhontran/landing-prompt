import { buy, chapters, product } from '@/content/product'

export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="skip-link" href="#noi-dung">
        Bỏ qua đến nội dung
      </a>
      <a className="skip-link" href="#thu-vien">
        Bỏ qua phần trình diễn, đến thư viện ảnh
      </a>
      <a className="brand" href={`#${chapters.hero.id}`}>
        {product.brand ?? product.name}
      </a>
      <nav aria-label="Các phần của trang">
        <ul>
          <li><a href={`#${chapters.back.id}`}>Thiết kế</a></li>
          <li><a href={`#${chapters.blueprint.id}`}>Thông số</a></li>
          <li><a href={`#${chapters.construction.id}`}>Cấu tạo</a></li>
          <li><a href="#thu-vien">Thư viện</a></li>
        </ul>
      </nav>
      <a className="button button--primary button--sm" href={buy.href} rel={buy.configured ? 'noopener' : undefined}>
        Mua ngay
      </a>
    </header>
  )
}
