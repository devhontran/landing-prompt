/** Chữ chia dòng; mỗi dòng có mặt nạ riêng để trượt lên (stagger 0.1s). Đọc liền mạch với trình đọc màn hình. */
export function Lines({ lines }: { lines: readonly string[] }) {
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

export function Dot({ icon = 'plus' }: { icon?: 'plus' | 'arrow' | 'down' }) {
  return (
    <span className="dot" aria-hidden="true">
      <svg viewBox="0 0 8 8">
        {icon === 'plus' && <path d="M4 0v8M0 4h8" />}
        {icon === 'arrow' && <path d="M0 4h7M4.5 1.5 7 4 4.5 6.5" />}
        {icon === 'down' && <path d="M4 0v7M1.5 4.5 4 7l2.5-2.5" />}
      </svg>
    </span>
  )
}

/** Giá trị chưa có dữ liệu thật → nhãn [CẦN CUNG CẤP]. */
export function Todo({ children = 'Cần cung cấp' }: { children?: React.ReactNode }) {
  return <span className="todo">{children}</span>
}
