import { buy, product, specSheet } from '@/content/product'
import { Value } from './Placeholder'

export function BuySection() {
  return (
    <section className="buy" id="mua-ngay" aria-labelledby="buy-title">
      <div className="buy__inner reveal">
        <p className="eyebrow">Đặt hàng</p>
        <h2 id="buy-title">{product.name}</h2>
        <p className="price">
          {product.price ? product.price : <span className="missing">Giá bán: cần cung cấp</span>}
        </p>
        <a className="button button--primary button--lg" href={buy.href} rel={buy.configured ? 'noopener' : undefined}>
          Mua ngay
        </a>
        {!buy.configured && (
          <p className="notice" role="note">
            URL mua hàng chưa được cấu hình. Đặt biến môi trường <code>NEXT_PUBLIC_BUY_URL</code> (https) để nút dẫn đến trang thanh toán.
          </p>
        )}
      </div>
      <div className="buy__specs reveal">
        <table>
          <caption>Thông số kỹ thuật</caption>
          <tbody>
            {specSheet.map((s) => (
              <tr key={s.label}>
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
