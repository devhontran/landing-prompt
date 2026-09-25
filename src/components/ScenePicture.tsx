import { getImageProps } from 'next/image'
import type { Media } from '@/content/media'
import { DESKTOP_3D_QUERY } from '@/lib/experience'

/** GIF 1×1 trong suốt: trên desktop 3D, <picture> chọn nguồn này nên ảnh tĩnh không bị tải. */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

type Props = {
  media: Media
  /** Ảnh đầu trang trên mobile (LCP) → tải sớm. */
  priority?: boolean
  sizes?: string
  className?: string
}

export function ScenePicture({ media, priority, sizes = '(min-width: 1024px) 50vw, 100vw', className }: Props) {
  const { props } = getImageProps({
    src: media.src,
    alt: media.alt,
    sizes,
    quality: 80,
    loading: priority ? 'eager' : 'lazy',
    fetchPriority: priority ? 'high' : 'auto',
  })
  return (
    <figure className={`media ${className ?? ''}`}>
      <picture>
        {/* Khi JS phát hiện không dùng được WebGL, nguồn này bị gỡ để ảnh thật được tải. */}
        <source media={DESKTOP_3D_QUERY} srcSet={BLANK} data-gate="3d" />
        {/* eslint-disable-next-line jsx-a11y/alt-text -- alt nằm trong props */}
        <img {...props} />
      </picture>
      {media.placeholder && <span className="badge badge--media">Ảnh placeholder</span>}
    </figure>
  )
}
