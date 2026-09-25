'use client'

import { useRef, useState } from 'react'
import { finishes, type FinishKey } from '@/content/site'
import type { Media } from '@/content/media'
import { ScenePicture } from '../ScenePicture'
import { Lines } from '../ui/Lines'

/**
 * Bộ chọn phiên bản: nút cắn góc viền 1px (30% → 100% khi hover/đang chọn).
 * Chế độ 3D: phát sự kiện `finish` để vật liệu model crossfade 0.5s. Chế độ tĩnh: ảnh crossfade.
 */
export function FinishSelector({ pictures }: { pictures: [FinishKey, Media][] }) {
  const [active, setActive] = useState<FinishKey>('graphite')
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const choose = (key: FinishKey) => {
    setActive(key)
    window.dispatchEvent(new CustomEvent('speaker:finish', { detail: key }))
  }
  // Điều hướng bàn phím kiểu radiogroup (mũi tên trái/phải).
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + finishes.length) % finishes.length
    choose(finishes[n].key)
    refs.current[n]?.focus()
  }

  return (
    <>
      <div className="finish__text">
        <h2 id="finish-title" className="h2" data-reveal>
          <Lines lines={['Chọn', 'phiên bản']} />
        </h2>
        <div className="finish__options" role="radiogroup" aria-labelledby="finish-title">
          {finishes.map((f, i) => (
            <button
              key={f.key}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={active === f.key}
              tabIndex={active === f.key ? 0 : -1}
              className="btn btn--line notch finish__option"
              onClick={() => choose(f.key)}
              onKeyDown={(e) => onKey(e, i)}
            >
              <span>{f.label}</span>
              <span className="label">0{i + 1}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="finish__stage" data-stage="finish">
        {pictures.map(([key, media]) => (
          <ScenePicture key={key} media={media} replaces3d active={active === key} sizes="(min-width: 1024px) 58vw, 100vw" />
        ))}
      </div>
    </>
  )
}
