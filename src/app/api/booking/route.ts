/**
 * Nhận form đặt lịch nghe thử và chuyển tiếp sang hệ thống của showroom.
 * [CẦN CẤU HÌNH] BOOKING_WEBHOOK_URL (biến môi trường phía server, KHÔNG có tiền tố NEXT_PUBLIC → không lộ ra trình duyệt).
 * Chưa cấu hình → trả 503 kèm thông báo rõ ràng, không giả vờ thành công.
 */
import { NextResponse } from 'next/server'

const MAX = { name: 120, phone: 20, showroom: 80 }

export async function POST(req: Request) {
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) {
    return NextResponse.json({ message: 'Định dạng không hợp lệ.' }, { status: 415 })
  }
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Dữ liệu không hợp lệ.' }, { status: 400 })
  }
  // Bẫy spam: trả về như thành công nhưng không chuyển tiếp.
  if (typeof body.website === 'string' && body.website) return NextResponse.json({ ok: true })

  const name = String(body.name ?? '')
    .trim()
    .slice(0, MAX.name)
  const phone = String(body.phone ?? '')
    .trim()
    .slice(0, MAX.phone)
  const showroom = String(body.showroom ?? '')
    .trim()
    .slice(0, MAX.showroom)
  if (!name || !/^[0-9+\s().-]{8,20}$/.test(phone)) {
    return NextResponse.json({ message: 'Vui lòng kiểm tra họ tên và số điện thoại.' }, { status: 422 })
  }

  const hook = process.env.BOOKING_WEBHOOK_URL
  if (!hook) {
    return NextResponse.json({ message: 'Hệ thống đặt lịch chưa được kết nối (cần cấu hình BOOKING_WEBHOOK_URL).' }, { status: 503 })
  }
  try {
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, phone, showroom, source: 'landing', at: new Date().toISOString() }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(String(res.status))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ message: 'Chưa gửi được, vui lòng thử lại sau.' }, { status: 502 })
  }
}
