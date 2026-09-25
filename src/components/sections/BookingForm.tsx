'use client'

import { useState } from 'react'
import { showrooms } from '@/content/site'

type Status = { kind: 'idle' | 'sending' | 'ok' | 'error'; message?: string }

/**
 * Form đặt lịch nghe thử: input chỉ có viền dưới 1px, không bo góc.
 * Gửi tới /api/booking (route handler chuyển tiếp sang webhook cấu hình ở server — không lộ khoá ra trình duyệt).
 */
export function BookingForm() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>
    const next: Record<string, string> = {}
    if (!data.name?.trim()) next.name = 'Vui lòng nhập họ tên'
    if (!/^[0-9+\s().-]{8,20}$/.test(data.phone ?? '')) next.phone = 'Số điện thoại chưa hợp lệ'
    setErrors(next)
    if (Object.keys(next).length) {
      form.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`)?.focus()
      return
    }
    setStatus({ kind: 'sending' })
    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      })
      const body = (await res.json().catch(() => ({}))) as { message?: string }
      if (res.ok) {
        setStatus({ kind: 'ok', message: 'Đã nhận thông tin. Showroom sẽ liên hệ lại.' })
        form.reset()
      } else setStatus({ kind: 'error', message: body.message ?? 'Chưa gửi được, vui lòng thử lại.' })
    } catch {
      setStatus({ kind: 'error', message: 'Mất kết nối, vui lòng thử lại.' })
    }
  }

  return (
    <form className="contact__form" id="dat-lich-form" onSubmit={onSubmit} noValidate aria-describedby="form-status">
      <div className="field">
        <label className="label" htmlFor="f-name">
          Họ tên
        </label>
        <input
          id="f-name"
          name="name"
          autoComplete="name"
          required
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'e-name' : undefined}
        />
        {errors.name && (
          <span className="field__error label" id="e-name">
            {errors.name}
          </span>
        )}
      </div>
      <div className="field">
        <label className="label" htmlFor="f-phone">
          Số điện thoại
        </label>
        <input
          id="f-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          required
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? 'e-phone' : undefined}
        />
        {errors.phone && (
          <span className="field__error label" id="e-phone">
            {errors.phone}
          </span>
        )}
      </div>
      <div className="field">
        <label className="label" htmlFor="f-showroom">
          Showroom
        </label>
        <select id="f-showroom" name="showroom" defaultValue="">
          <option value="">{showrooms.length ? 'Chọn showroom' : 'Danh sách showroom · cần cung cấp'}</option>
          {showrooms.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {/* Bẫy spam: người thật không thấy ô này. */}
      <div className="hp" aria-hidden="true">
        <label htmlFor="f-web">Website</label>
        <input id="f-web" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <button className="btn btn--solid notch" type="submit" disabled={status.kind === 'sending'}>
        <span>{status.kind === 'sending' ? 'Đang gửi…' : 'Gửi yêu cầu'}</span>
      </button>
      <p
        id="form-status"
        className={`form__status label${status.kind === 'error' ? ' field__error' : ''}`}
        role="status"
        aria-live="polite"
      >
        {status.message}
      </p>
    </form>
  )
}
