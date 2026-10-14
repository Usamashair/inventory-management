/**
 * Order production pipeline helpers (matches backend Order::TRANSITIONS).
 */

export const ORDER_PIPELINE = [
  'waiting-for-artwork',
  'in-production',
  'in-transit',
  'delivered',
] as const

export type OrderPipelineStatus = (typeof ORDER_PIPELINE)[number]

const NEXT: Record<string, string | null> = {
  pending: 'waiting-for-artwork',
  'waiting-for-artwork': 'in-production',
  'in-production': 'in-transit',
  ready: 'in-transit',
  shipped: 'delivered',
  'in-transit': 'delivered',
  delivered: null,
  completed: null,
}

const LABELS: Record<string, string> = {
  pending: 'Waiting for Artwork',
  'waiting-for-artwork': 'Waiting for Artwork',
  'in-production': 'In Production',
  ready: 'In transit',
  shipped: 'In transit',
  'in-transit': 'In transit',
  delivered: 'Delivered',
  completed: 'Delivered',
}

export function normalizeOrderStatus(status: string): string {
  switch (status) {
    case 'pending':
      return 'waiting-for-artwork'
    case 'ready':
    case 'shipped':
      return 'in-transit'
    case 'completed':
      return 'delivered'
    default:
      return status
  }
}

export function formatOrderStatus(status: string): string {
  return LABELS[status] || status.replace(/-/g, ' ')
}

export function nextOrderStatus(status: string): string | null {
  return NEXT[normalizeOrderStatus(status)] ?? null
}

export function advanceOrderLabel(status: string): string | null {
  const next = nextOrderStatus(status)
  if (!next) return null
  return `Mark ${formatOrderStatus(next)}`
}

/** Jump targets available from current status (forward only on main pipeline). */
export function jumpTargets(status: string): Array<{ value: string; label: string }> {
  const current = normalizeOrderStatus(status)
  if (current === 'in-production') {
    return [{ value: 'delivered', label: 'Jump to Delivered' }]
  }
  const idx = ORDER_PIPELINE.indexOf(current as OrderPipelineStatus)
  if (idx < 0) return []
  return ORDER_PIPELINE.slice(idx + 2).map((value) => ({
    value,
    label: `Jump to ${formatOrderStatus(value)}`,
  }))
}
