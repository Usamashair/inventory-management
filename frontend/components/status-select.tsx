'use client'

type StatusOption = { value: string; label: string }

export const QUOTATION_STATUSES: StatusOption[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'under-review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
]

export const ARTWORK_STATUSES: StatusOption[] = [
  { value: 'awaiting-approval', label: 'Awaiting Approval' },
  { value: 'revision-requested', label: 'Revision requested' },
  { value: 'revision-sent', label: 'Revision Send' },
  { value: 'approved', label: 'Approved' },
]

/** Admin/staff may set these — Revision Send is customer-only. */
export const ADMIN_ARTWORK_STATUSES: StatusOption[] = [
  { value: 'awaiting-approval', label: 'Awaiting Approval' },
  { value: 'revision-requested', label: 'Revision requested' },
  { value: 'approved', label: 'Approved' },
]

/** Display label: admins see revision-sent as Awaiting Approval. */
export function artworkStatusLabel(status: string | null | undefined, forAdmin = false): string {
  const value = String(status || '').trim()
  if (!value) return '—'
  if (forAdmin && value === 'revision-sent') {
    return 'Awaiting Approval'
  }
  return (
    ARTWORK_STATUSES.find((item) => item.value === value)?.label
    || value.replace(/-/g, ' ')
  )
}

/** Normalize status for admin selects (revision-sent → awaiting-approval). */
export function adminArtworkStatusValue(status: string): string {
  return status === 'revision-sent' ? 'awaiting-approval' : status
}

export const STAFF_ARTWORK_ACTIONS: StatusOption[] = [
  { value: 'approved', label: 'Approve' },
  { value: 'revision-requested', label: 'Revision requested' },
]

export const ORDER_STATUSES: StatusOption[] = [
  { value: 'waiting-for-artwork', label: 'Waiting for Artwork' },
  { value: 'in-production', label: 'In Production' },
  { value: 'in-transit', label: 'In transit' },
  { value: 'delivered', label: 'Delivered' },
]

type Props = {
  value: string
  options: StatusOption[]
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

export default function StatusSelect({ value, options, onChange, disabled, className }: Props) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={
        className ||
        'rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2d6a5f]'
      }
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
