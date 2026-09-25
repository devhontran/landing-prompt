import { PLACEHOLDER_LABEL } from '@/content/product'

/** Giá trị chưa có dữ liệu thật: hiển thị nhãn rõ ràng thay vì bịa số liệu. */
export function Value({ value }: { value: string | null }) {
  if (value) return <>{value}</>
  return <span className="missing">{PLACEHOLDER_LABEL}</span>
}
