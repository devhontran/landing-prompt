import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import CaptureClient from './CaptureClient'

export const metadata: Metadata = { robots: { index: false, follow: false } }

/** Công cụ nội bộ: render cảnh 3D thành ảnh tĩnh (scripts/capture.mjs). Chỉ có ở chế độ dev. */
export default function CapturePage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <CaptureClient />
}
