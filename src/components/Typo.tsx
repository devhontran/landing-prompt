/** Tiêu đề display chia dòng: mỗi dòng có mặt nạ riêng để hiện ra từ dưới lên. Đọc liền mạch với trình đọc màn hình. */
export function Lines({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((l, i) => (
        <span className="line" key={i}>
          <span className="line__inner" style={{ ['--i' as string]: i }}>
            {l}
          </span>
          {i < lines.length - 1 ? ' ' : null}
        </span>
      ))}
    </>
  )
}

/** Nhãn mono dạng (01) — đánh số chương kiểu bản vẽ kỹ thuật. */
export function Meta({ index, label, total }: { index?: string; label: string; total?: string }) {
  return (
    <p className="meta">
      {index && <span className="meta__index">({index})</span>}
      <span className="meta__label">{label}</span>
      {total && <span className="meta__total">{total}</span>}
    </p>
  )
}

export function Arrow({ dir = 'right' }: { dir?: 'right' | 'down' | 'up' }) {
  const rot = dir === 'down' ? 90 : dir === 'up' ? -90 : 0
  return (
    <svg className="arrow" viewBox="0 0 16 16" aria-hidden="true" style={{ transform: `rotate(${rot}deg)` }}>
      <path d="M2 8h11M9 4l4 4-4 4" />
    </svg>
  )
}
