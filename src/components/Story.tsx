import { chapters, parts, specs, buy, product } from '@/content/product'
import { sceneImages } from '@/content/media'
import { ScenePicture } from './ScenePicture'
import { StoryStage } from './StoryStage'
import { Value } from './Placeholder'
import { Arrow, Lines, Meta } from './Typo'

/**
 * Phần kể chuyện. HTML ngữ nghĩa đầy đủ được render sẵn trên server (SEO + trình đọc màn hình).
 * - Desktop 3D: CSS biến khối này thành sân khấu sticky, chữ nằm ở vùng riêng, GSAP điều khiển theo cuộn.
 * - Mobile / giảm chuyển động: bố cục một cột, mỗi cảnh có ảnh tĩnh tương ứng.
 */
export function Story() {
  return (
    <div className="story" id="cau-chuyen">
      <div className="story__sticky">
        <StoryStage />

        {/* Thanh tiến độ chương (chỉ hiện ở chế độ 3D). Điều hướng bàn phím đã có ở header nên ẩn khỏi cây truy cập. */}
        <div className="story-progress" aria-hidden="true" data-active="0">
          <div className="story-progress__track">
            <span className="story-progress__fill" />
          </div>
          <span className="story-progress__pct">000</span>
          <ol>
            {[
              [chapters.hero.id, 'Giới thiệu'],
              [chapters.back.id, 'Thiết kế'],
              [chapters.blueprint.id, 'Thông số'],
              [chapters.construction.id, 'Cấu tạo'],
              [chapters.final.id, 'Hoàn thiện'],
            ].map(([id, label], i) => (
              <li key={id} style={{ ['--i' as string]: i }}>
                <a href={`#${id}`} tabIndex={-1}>
                  <span className="story-progress__num">{String(i).padStart(2, '0')}</span> {label}
                </a>
              </li>
            ))}
          </ol>
        </div>

        <section className="chapter chapter--hero" data-chapter="hero" id={chapters.hero.id} aria-labelledby="hero-title">
          <div className="chapter__text hero__title">
            <h1 id="hero-title" className="t-display" tabIndex={-1}>
              <Lines lines={chapters.hero.lines} />
            </h1>
          </div>
          <div className="chapter__text hero__intro">
            <Meta index="00" label={chapters.hero.eyebrow} />
            <p className="lede">{product.description}</p>
            {product.namePlaceholder && <span className="badge">Tên sản phẩm: cần cung cấp</span>}
          </div>
          <p className="hero__scroll meta" aria-hidden="true">
            <span className="meta__label">Cuộn để khám phá</span>
            <Arrow dir="down" />
          </p>
          <ScenePicture media={sceneImages.hero} priority className="chapter__media" />
        </section>

        <section className="chapter chapter--side" data-chapter="back" id={chapters.back.id} aria-labelledby="back-title">
          <ScenePicture media={sceneImages.back} className="chapter__media reveal" />
          <div className="chapter__text reveal">
            <Meta index={chapters.back.index} label={chapters.back.eyebrow} total="01 / 04" />
            <h2 id="back-title" className="t-h2" tabIndex={-1}>
              <Lines lines={chapters.back.lines} />
            </h2>
            <p className="body">{chapters.back.body}</p>
          </div>
        </section>

        <section className="chapter chapter--blueprint" data-chapter="blueprint" id={chapters.blueprint.id} aria-labelledby="bp-title">
          <ScenePicture media={sceneImages.blueprint} className="chapter__media reveal" />
          <div className="chapter__text reveal">
            <Meta index={chapters.blueprint.index} label={chapters.blueprint.eyebrow} total="02 / 04" />
            <h2 id="bp-title" className="t-h2" tabIndex={-1}>
              <Lines lines={chapters.blueprint.lines} />
            </h2>
            <p className="body">{chapters.blueprint.body}</p>
          </div>
          <dl className="specs reveal">
            {specs.map((s, i) => (
              <div key={s.id} className={`spec spec--${s.side}`} data-spec={s.id} data-anchor={s.anchor} data-side={s.side}>
                <dt>
                  <span className="spec__index">{String(i + 1).padStart(2, '0')}</span>
                  {s.label}
                </dt>
                <dd>
                  <Value value={s.value} />
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="chapter-group" id={chapters.construction.id} aria-labelledby="construction-title">
          <h2 id="construction-title" className="group-title meta" tabIndex={-1}>
            <span className="meta__index">({chapters.construction.index})</span> <span className="meta__label">{chapters.construction.eyebrow}</span>
          </h2>
          {parts.map((p) => (
            <article key={p.id} className="chapter chapter--part" data-chapter={p.id} aria-labelledby={`part-${p.id}`}>
              <ScenePicture media={sceneImages[p.id]} className="chapter__media reveal" />
              <div className="chapter__text reveal">
                <Meta index={p.index} label={chapters.construction.eyebrow} total="03 / 04" />
                <h3 id={`part-${p.id}`} className="t-h2">
                  <Lines lines={[p.title]} />
                </h3>
                <p className="body">{p.body}</p>
                <dl className="materials">
                  {p.materials.map((m) => (
                    <div key={m.label}>
                      <dt>{m.label}</dt>
                      <dd>
                        <Value value={m.value} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </article>
          ))}
        </section>

        <section className="chapter chapter--final" data-chapter="final" id={chapters.final.id} aria-labelledby="final-title">
          <ScenePicture media={sceneImages.final} className="chapter__media reveal" />
          <div className="chapter__text final__title reveal">
            <Meta index={chapters.final.index} label={chapters.final.eyebrow} total="04 / 04" />
            <h2 id="final-title" className="t-display t-display--sm" tabIndex={-1}>
              <Lines lines={chapters.final.lines} />
            </h2>
          </div>
          <div className="chapter__text final__cta reveal">
            <p className="body">{chapters.final.body}</p>
            <div className="cta-group">
              <a className="pill pill--light" href={buy.href} rel={buy.configured ? 'noopener' : undefined}>
                <span>Mua ngay</span>
                <span className="pill__icon">
                  <Arrow />
                </span>
              </a>
              <a className="pill pill--ghost" href={`#${chapters.gallery.id}`}>
                <span>Thư viện ảnh</span>
                <span className="pill__icon">
                  <Arrow dir="down" />
                </span>
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
