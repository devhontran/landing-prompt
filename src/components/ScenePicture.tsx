import { getImageProps } from 'next/image'
import type { Media } from '@/content/media'
import { DESKTOP_3D_QUERY } from '@/lib/experience'

/** GIF 1×1 trong suốt: ở chế độ 3D, <picture> chọn nguồn này nên ảnh tĩnh không bị tải. */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

type Props = {
  media: Media
  priority?: boolean
  sizes?: string
  className?: string
  /** true: ảnh chỉ thay cho canvas 3D (ẩn và không tải ở chế độ 3D). */
  replaces3d?: boolean
  active?: boolean
}

export function ScenePicture({ media, priority, sizes = '100vw', className = '', replaces3d, active }: Props) {
  const { props } = getImageProps({
    src: media.src,
    alt: media.alt,
    sizes,
    quality: 80,
    loading: priority ? 'eager' : 'lazy',
    fetchPriority: priority ? 'high' : 'auto',
  })
  return (
    <figure
      className={`media ${replaces3d ? 'media--3d' : ''} ${className}`}
      data-active={active === undefined ? undefined : String(active)}
    >
      <picture>
        {replaces3d && <source media={DESKTOP_3D_QUERY} srcSet={BLANK} data-gate="3d" />}
        {/* eslint-disable-next-line jsx-a11y/alt-text -- alt nằm trong props */}
        <img {...props} />
      </picture>
      {media.placeholder && <span className="media__badge">Ảnh placeholder</span>}
    </figure>
  )
}
