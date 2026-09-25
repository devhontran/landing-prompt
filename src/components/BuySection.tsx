import { buy, chapters, product, specSheet } from '@/content/product'
import { Value } from './Placeholder'
import { Arrow, Meta } from './Typo'

export function BuySection() {
  return (
    <section className="buy" id={chapters.buy.id} aria-labelledby="buy-title">
      <div className="buy__head reveal">
        <Meta index={chapters.buy.index} label={chapters.buy.eyebrow} />
        <h2 id="buy-title" className="t-display">
          {product.name}
        </h2>
      </div>
      <div className="buy__cta reveal">
        <p className="buy__price">
          <span className="meta__label">Giá bán</span>
          {product.price ? <span className="buy__amount">{product.price}</span> : <span className="missing">Cần cung cấp</span>}
        </p>
        <a className="pill pill--light pill--xl" href={buy.href} rel={buy.configured ? 'noopener' : undefined}>
          <span>Mua ngay</span>
          <span className="pill__icon">
            <Arrow />
          </span>
        </a>
        {!buy.configured && (
          <p className="notice" role="note">
            URL mua hàng chưa được cấu hình. Đặt biến môi trường <code>NEXT_PUBLIC_BUY_URL</code> (https) để nút dẫn đến trang thanh toán.
          </p>
        )}
      </div>
      <div className="buy__specs reveal">
        <Meta label="Thông số kỹ thuật" total={`${String(specSheet.length).padStart(2, '0')} mục`} />
        <table>
          <caption className="sr-only">Thông số kỹ thuật</caption>
          <tbody>
            {specSheet.map((s, i) => (
              <tr key={s.label}>
                <td className="spec-sheet__index">{String(i + 1).padStart(2, '0')}</td>
                <th scope="row">{s.label}</th>
                <td>
                  <Value value={s.value} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
