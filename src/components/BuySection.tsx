import { buy, chapters, product, specSheet } from '@/content/product'
import { sceneImages } from '@/content/media'
import { Value } from './Placeholder'
import { Arrow, Meta } from './Typo'
import { MagneticCta } from './MagneticCta'
import { ScenePicture } from './ScenePicture'

/**
 * Đặt hàng. Desktop 3D: loa (trên canvas dùng chung) quay lại giữa màn hình, tên sản phẩm tách đôi đứng hai bên,
 * CTA tròn ở dưới. Mobile: xếp dọc với ảnh tĩnh.
 */
export function BuySection() {
  const [first, ...rest] = product.name.split(' ')
  return (
    <section className="buy" id={chapters.buy.id} aria-labelledby="buy-title">
      <div className="buy__stage">
        <div className="buy__top reveal">
          <Meta index={chapters.buy.index} label={chapters.buy.eyebrow} />
        </div>
        <h2 id="buy-title" className="buy__title t-display">
          <span className="buy__word buy__word--l">{first}</span> <span className="buy__word buy__word--r">{rest.join(' ')}</span>
        </h2>
        <ScenePicture media={sceneImages.final} className="buy__media reveal" sizes="(min-width: 1024px) 40vw, 100vw" />
        <div className="buy__bottom reveal">
          <div className="buy__price">
            <span className="buy__label">Giá bán</span>
            {product.price ? <span className="buy__amount">{product.price}</span> : <span className="missing">Cần cung cấp</span>}
            {!buy.configured && (
              <p className="notice" role="note">
                URL mua hàng chưa được cấu hình — đặt <code>NEXT_PUBLIC_BUY_URL</code> (https).
              </p>
            )}
          </div>
          <MagneticCta href={buy.href} label="Mua ngay" ring={`Mua ngay · ${product.name}`} external={buy.configured} />
          <a className="buy__jump meta" href="#thong-so-ky-thuat">
            <span className="meta__label">Thông số kỹ thuật</span>
            <Arrow dir="down" />
          </a>
        </div>
      </div>

      <div className="buy__specs" id="thong-so-ky-thuat">
        <Meta label="Thông số kỹ thuật" total={`${String(specSheet.length).padStart(2, '0')} mục`} />
        <dl className="spec-grid">
          {specSheet.map((s, i) => (
            <div className="spec-cell reveal" key={s.label} style={{ ['--i' as string]: i }}>
              <span className="spec-cell__index" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <dt>{s.label}</dt>
              <dd>
                <Value value={s.value} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
