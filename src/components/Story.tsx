import { chapters, parts, specs, buy, product } from '@/content/product'
import { sceneImages } from '@/content/media'
import { ScenePicture } from './ScenePicture'
import { StoryStage } from './StoryStage'
import { Value } from './Placeholder'

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

        <section className="chapter chapter--hero" data-chapter="hero" id={chapters.hero.id} aria-labelledby="hero-title">
          <div className="chapter__text">
            <p className="eyebrow">
              {chapters.hero.eyebrow}
              {product.namePlaceholder && <span className="badge">Tên sản phẩm: cần cung cấp</span>}
            </p>
            <h1 id="hero-title" tabIndex={-1}>
              {chapters.hero.title}
            </h1>
            <p className="lede">{product.description}</p>
            <p className="scroll-hint" aria-hidden="true">
              Cuộn để khám phá
            </p>
          </div>
          <ScenePicture media={sceneImages.hero} priority className="chapter__media" />
        </section>

        <section className="chapter chapter--side" data-chapter="back" id={chapters.back.id} aria-labelledby="back-title">
          <ScenePicture media={sceneImages.back} className="chapter__media reveal" />
          <div className="chapter__text reveal">
            <p className="eyebrow">
              <span className="index">{chapters.back.index}</span> {chapters.back.eyebrow}
            </p>
            <h2 id="back-title" tabIndex={-1}>
              {chapters.back.title}
            </h2>
            <p>{chapters.back.body}</p>
          </div>
        </section>

        <section className="chapter chapter--blueprint" data-chapter="blueprint" id={chapters.blueprint.id} aria-labelledby="bp-title">
          <ScenePicture media={sceneImages.blueprint} className="chapter__media reveal" />
          <div className="chapter__text reveal">
            <p className="eyebrow">
              <span className="index">{chapters.blueprint.index}</span> {chapters.blueprint.eyebrow}
            </p>
            <h2 id="bp-title" tabIndex={-1}>
              {chapters.blueprint.title}
            </h2>
            <p>{chapters.blueprint.body}</p>
          </div>
          <dl className="specs reveal">
            {specs.map((s) => (
              <div key={s.id} className={`spec spec--${s.side}`} data-spec={s.id} data-anchor={s.anchor} data-side={s.side}>
                <dt>{s.label}</dt>
                <dd>
                  <Value value={s.value} />
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="chapter-group" id={chapters.construction.id} aria-labelledby="construction-title">
          <h2 id="construction-title" className="group-title" tabIndex={-1}>
            <span className="index">{chapters.construction.index}</span> {chapters.construction.eyebrow}
          </h2>
          {parts.map((p) => (
            <article key={p.id} className="chapter chapter--part" data-chapter={p.id} aria-labelledby={`part-${p.id}`}>
              <ScenePicture media={sceneImages[p.id]} className="chapter__media reveal" />
              <div className="chapter__text reveal">
                <p className="eyebrow">
                  <span className="index">{p.index}</span> {chapters.construction.eyebrow}
                </p>
                <h3 id={`part-${p.id}`}>{p.title}</h3>
                <p>{p.body}</p>
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
          <div className="chapter__text reveal">
            <p className="eyebrow">
              <span className="index">{chapters.final.index}</span> {chapters.final.eyebrow}
            </p>
            <h2 id="final-title" tabIndex={-1}>
              {chapters.final.title}
            </h2>
            <p>{chapters.final.body}</p>
            <div className="cta-group">
              <a className="button button--primary" href={buy.href} rel={buy.configured ? 'noopener' : undefined}>
                Mua ngay
              </a>
              <a className="button button--ghost" href="#thu-vien">
                Xem thư viện ảnh
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
