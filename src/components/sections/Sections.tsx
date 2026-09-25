import { images } from '@/content/media'
import { brand, brandName, catalogueUrl, footer, hero, ids, layers, materials, partners, room, specs, statement } from '@/content/site'
import { ScenePicture } from '../ScenePicture'
import { Dot, Lines, Todo } from '../ui/Lines'
import { FinishSelector } from './FinishSelector'
import { BookingForm } from './BookingForm'

/** Nhãn đầu section: (01) TÊN ······ phụ chú */
function SectionLabel({ index, label, aside }: { index: string; label: string; aside?: React.ReactNode }) {
  return (
    <p className="section__label label">
      <span>
        ({index}) {label}
      </span>
      {aside && <span>{aside}</span>}
    </p>
  )
}

/* 01 — Hero (sáng → tối) */
export function Hero() {
  return (
    <section className="hero" id={ids.hero} data-3d="hero" aria-labelledby="hero-title">
      <div className="hero__sticky">
        <div className="hero__tab" data-theme="light">
          <h1 id="hero-title">
            <span className="wordmark">{brandName}</span>
            <span className="sr-only"> — {brand.category}</span>
          </h1>
          <Dot />
        </div>
        <div className="hero__frame" data-theme="dark">
          <ScenePicture media={images.hero} priority replaces3d className="hero__media" sizes="100vw" />
          <p className="hero__meta label">
            <span>(01) {brand.category}</span>
            <span>{brand.model ?? <Todo>Tên model</Todo>}</span>
          </p>
          <p className="hero__tagline body" data-reveal>
            <Lines lines={hero.taglineLines} />
          </p>
        </div>
      </div>
    </section>
  )
}

/* 02 — Tuyên ngôn (tối) */
export function Statement() {
  return (
    <section className="section statement grid" id={ids.statement} data-theme="dark" data-3d="statement" aria-labelledby="statement-title">
      <SectionLabel index="02" label="Tuyên ngôn" />
      <h2 id="statement-title" className="statement__text statement-type" data-reveal>
        <Lines lines={statement.lines} />
      </h2>
      <div className="statement__stage" data-stage="statement">
        <ScenePicture media={images.statement} replaces3d sizes="100vw" />
      </div>
      <p className="statement__body body reveal">{statement.body}</p>
    </section>
  )
}

/* 03 — Exploded view (tối, ghim nhiều màn hình) */
export function Exploded() {
  return (
    <section className="section exploded" id={ids.exploded} data-theme="dark" data-3d="exploded" aria-labelledby="exploded-title">
      <div className="exploded__sticky grid">
        <SectionLabel index="03" label="Cấu tạo" aside={`${String(layers.length).padStart(2, '0')} lớp`} />
        <h2 id="exploded-title" className="exploded__title statement-type" data-reveal>
          <Lines lines={['Từng lớp,', 'một công trình']} />
        </h2>
        <ol className="callouts">
          {layers.map((l, i) => (
            <li className="callout" key={l.part} data-callout={l.part}>
              <span className="num">{i + 1}</span>
              <span>{l.label}</span>
            </li>
          ))}
        </ol>
        <svg className="callout-lines" aria-hidden="true">
          {layers.map((l) => (
            <line key={l.part} data-line={l.part} x1="0" y1="0" x2="0" y2="0" />
          ))}
        </svg>
        <ScenePicture media={images.exploded} replaces3d className="exploded__media" sizes="100vw" />
      </div>
    </section>
  )
}

/* 04 — Thông số (tối, mỗi hàng ghim một màn hình) */
export function Specs() {
  return (
    <section className="specs" id={ids.specs} data-theme="dark" aria-labelledby="specs-title">
      <h2 id="specs-title" className="sr-only">
        Thông số
      </h2>
      {specs.map((s, i) => (
        <div className="spec-row" key={s.label}>
          <div className="spec-row__inner">
            <span className="spec-row__line" aria-hidden="true" />
            <p className="spec-row__meta label">
              <span>
                ({String(i + 1).padStart(2, '0')}) {s.label}
                {!s.value && (
                  <>
                    {' '}
                    · <Todo />
                  </>
                )}
              </span>
              <span>
                {String(i + 1).padStart(2, '0')} / {String(specs.length).padStart(2, '0')}
              </span>
            </p>
            <p className={`spec-row__value display${s.value ? '' : ' is-placeholder'}`} data-reveal>
              <span className="line">
                <span className="line__inner">
                  {s.value ?? (
                    <>
                      {/* khung số mờ vẽ bằng CSS (::before) — trang trí, không phải nội dung */}
                      <span className="spec-row__mask" data-mask={s.mask} aria-hidden="true" />
                      <span className="sr-only">Chưa có dữ liệu</span>
                    </>
                  )}
                </span>
              </span>
            </p>
          </div>
        </div>
      ))}
    </section>
  )
}

/* 05 — Vật liệu (sáng, nền #e3e6eb) */
export function Materials() {
  return (
    <section className="section section--alt grid materials" id={ids.materials} data-theme="light" aria-labelledby="materials-title">
      <SectionLabel index="05" label="Vật liệu" aside={<Todo>Cần xác nhận vật liệu</Todo>} />
      <h2 id="materials-title" className="sr-only">
        {materials.title.join(' ')}
      </h2>
      <div className="materials__pair">
        {[
          [images.matAluminium, 'Nhôm phay xước'],
          [images.matGlass, 'Kính gân dọc'],
        ].map(([m, label], i) => (
          <figure key={label as string} className="reveal">
            <ScenePicture media={m as typeof images.matGlass} className="notch notch--lg" sizes="(min-width: 640px) 50vw, 100vw" />
            <figcaption className="label">
              <span>0{i + 1}</span>
              <span>{label as string}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="materials__body body reveal">{materials.body}</p>
    </section>
  )
}

/* 06 — Chọn phiên bản (tối) */
export function Finish() {
  return (
    <section className="section grid finish" id={ids.finish} data-theme="dark" data-3d="finish" aria-labelledby="finish-title">
      <SectionLabel index="06" label="Phiên bản" aside={<Todo>Cần xác nhận các phiên bản</Todo>} />
      <FinishSelector
        pictures={[
          ['graphite', images.finishGraphite],
          ['silver', images.finishSilver],
          ['walnut', images.finishWalnut],
        ]}
      />
    </section>
  )
}

/* 07 — Không gian nghe (tối) */
export function Room() {
  return (
    <section className="section grid room" id={ids.room} data-theme="dark" aria-labelledby="room-title">
      <SectionLabel index="07" label="Không gian nghe" />
      <div className="room__frame" data-parallax>
        <div className="room__tab">
          <span id="room-title">Diện tích phòng phù hợp: {room.size ? `${room.size} m²` : <Todo />}</span>
          <Dot />
        </div>
        <ScenePicture media={images.room} sizes="100vw" />
      </div>
      <p className="room__body body reveal">{room.body}</p>
    </section>
  )
}

/* 08 — Đối tác / giải thưởng (sáng) */
export function Partners() {
  return (
    <section className="section section--light grid partners" id={ids.partners} data-theme="light" aria-labelledby="partners-title">
      <SectionLabel index="08" label="Đối tác & giải thưởng" />
      <h2 id="partners-title" className="sr-only">
        Đối tác và giải thưởng
      </h2>
      <ul className="partners__list">
        {partners.map((p) => (
          <li className="partner notch notch--lg reveal" key={p.label}>
            <span className="partner__label label">{p.label}</span>
            <span className="label">{p.name ?? <Todo>Logo — cần cung cấp</Todo>}</span>
            <span className="partner__plus">
              <Dot />
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* 09 — CTA + form (tối) */
export function Contact() {
  return (
    <section className="section grid contact" id={ids.booking} data-theme="dark" aria-labelledby="contact-title">
      <SectionLabel index="09" label="Đặt lịch nghe thử" />
      <p className="contact__mark" aria-hidden="true" data-reveal>
        <span className="line">
          <span className="line__inner">{brandName}</span>
        </span>
      </p>
      <div className="contact__ctas">
        <a className="btn btn--solid notch" href="#dat-lich-form">
          <span>Đặt lịch nghe thử</span>
          <Dot icon="arrow" />
        </a>
        {catalogueUrl ? (
          <a className="btn btn--line notch" href={catalogueUrl} rel="noopener">
            <span>Tải catalogue</span>
            <Dot icon="down" />
          </a>
        ) : (
          <span className="btn btn--line notch" aria-disabled="true" title="Chưa có file catalogue (NEXT_PUBLIC_CATALOGUE_URL)">
            <span>Tải catalogue · cần cung cấp</span>
            <Dot icon="down" />
          </span>
        )}
      </div>
      <h2 id="contact-title" className="contact__intro body">
        Để lại thông tin, showroom sẽ liên hệ sắp xếp một buổi nghe thử riêng.
      </h2>
      <BookingForm />
    </section>
  )
}

export function Footer() {
  return (
    <footer className="footer grid" data-theme="dark">
      <p>Showroom: {footer.address ?? <Todo>Địa chỉ</Todo>}</p>
      <p>
        {footer.social.length ? (
          footer.social.map((s) => (
            <a key={s.label} href={s.href} rel="noopener" className="link-fade">
              {s.label}{' '}
            </a>
          ))
        ) : (
          <Todo>Mạng xã hội</Todo>
        )}
      </p>
      <p>
        © {new Date().getFullYear()} {brand.name ?? <Todo>Thương hiệu</Todo>}
      </p>
    </footer>
  )
}
