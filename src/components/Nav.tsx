'use client'

import { useEffect, useRef, useState } from 'react'
import { brandName, ids } from '@/content/site'

const MENU = [
  [ids.hero, 'Giới thiệu'],
  [ids.statement, 'Tuyên ngôn'],
  [ids.exploded, 'Cấu tạo'],
  [ids.specs, 'Thông số'],
  [ids.materials, 'Vật liệu'],
  [ids.finish, 'Phiên bản'],
  [ids.room, 'Không gian nghe'],
  [ids.partners, 'Đối tác'],
  [ids.booking, 'Đặt lịch nghe thử'],
] as const

/**
 * Nav cố định 50px: hamburger 2 vạch · (logo) · CHỌN PHIÊN BẢN · ♡ 0 · ĐẶT LỊCH NGHE THỬ.
 * Nền sáng/tối đổi theo phần tử [data-theme] đang nằm ngay dưới nav.
 */
export function Nav() {
  const navRef = useRef<HTMLElement>(null)
  const burgerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [liked, setLiked] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem('liked') === '1') queueMicrotask(() => setLiked(true))
    } catch {
      /* bộ nhớ trình duyệt bị chặn → bỏ qua */
    }
  }, [])

  // Nền nav = theme của phần tử nằm ngay dưới nav (dò bằng elementsFromPoint mỗi lần cuộn, gộp theo rAF).
  // Logo chỉ hiện trên nền tối và khi tab hero đã "cắm" vào nav (chế độ 3D đặt html[data-tab]).
  useEffect(() => {
    const nav = navRef.current!
    const html = document.documentElement
    let raf = 0
    const check = () => {
      raf = 0
      const y = nav.offsetHeight + 2
      const hit = document.elementsFromPoint(4, y).find((el) => !nav.contains(el) && el.closest('[data-theme]'))
      const theme = hit?.closest<HTMLElement>('[data-theme]')?.dataset.theme ?? 'dark'
      nav.dataset.theme = theme
      nav.dataset.logo = String(theme === 'dark' && html.dataset.tab !== 'hero')
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check)
    }
    check()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    const mo = new MutationObserver(onScroll)
    mo.observe(html, { attributes: true, attributeFilter: ['data-tab', 'data-loaded'] })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      mo.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector('a')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        burgerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const toggleLike = () => {
    setLiked((v) => {
      try {
        localStorage.setItem('liked', v ? '0' : '1')
      } catch {
        /* bỏ qua */
      }
      return !v
    })
  }

  return (
    <>
      <a className="skip-link" href="#noi-dung">
        Bỏ qua đến nội dung
      </a>
      <header className="nav" ref={navRef} data-theme="light" data-logo="false">
        <button
          ref={burgerRef}
          type="button"
          className="nav__burger"
          aria-expanded={open}
          aria-controls="menu"
          aria-label={open ? 'Đóng menu' : 'Mở menu'}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
        </button>
        <a className="nav__logo" href={`#${ids.hero}`} aria-label={`${brandName} — về đầu trang`}>
          {brandName}
        </a>
        <nav className="nav__right" aria-label="Điều hướng chính">
          <a className="nav__hide-sm" href={`#${ids.finish}`}>
            Chọn phiên bản
          </a>
          <button
            type="button"
            className="nav__heart nav__hide-sm"
            aria-pressed={liked}
            onClick={toggleLike}
            aria-label={`Yêu thích, ${liked ? 1 : 0}`}
          >
            <span aria-hidden="true">{liked ? '♥' : '♡'}</span>
            <span aria-hidden="true">{liked ? 1 : 0}</span>
          </button>
          <a className="btn notch" href={`#${ids.booking}`}>
            <span className="nav__hide-sm">Đặt lịch nghe thử</span>
            <span className="nav__show-sm">Liên hệ</span>
          </a>
        </nav>
      </header>
      <div className="menu" id="menu" ref={menuRef} data-open={open} aria-hidden={!open}>
        <ol>
          {MENU.map(([id, label], i) => (
            <li key={id}>
              <a href={`#${id}`} className="statement-type" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>
                <span className="label">{String(i + 1).padStart(2, '0')}</span>
                {label}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </>
  )
}
