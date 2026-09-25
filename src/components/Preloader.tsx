import { brandName } from '@/content/site'

/** Preloader (chỉ hiện ở chế độ 3D, CSS quyết định): nền navy, model xoay phía sau, panel trắng cắn góc + bộ đếm. */
export function Preloader() {
  return (
    <div className="preloader" aria-hidden="true">
      <div className="preloader__bg" />
      <div className="preloader__panel">
        <span className="wordmark">{brandName}</span>
        <span className="preloader__count">000%</span>
      </div>
    </div>
  )
}
