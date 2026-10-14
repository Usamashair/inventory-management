'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  Package,
  Pencil,
  Send,
  UserRound,
} from 'lucide-react'
import { QuotationItem, quotationsApi } from '@/lib/resources'
import { loadWarehouses } from '@/lib/portal-data'
import type { Warehouse } from '@/lib/portal-data'
import { getStoredUser, isStaffOrAdmin, PortalUser } from '@/lib/auth'
import { showToast } from '@/lib/toast'
import QuotationChat from '@/components/quotation-chat'
import {
  DashboardBackLink,
  DashboardLoading,
  DashboardPage,
  detailRowClass,
  fieldSelectClass,
  heroSecondaryBtnClass,
  panelCtaClass,
  tableHeadCellClass,
  tableHeadRow,
} from '@/components/dashboard-page'

function formatStatus(status: string) {
  return status.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function statusStyles(status: string) {
  switch (String(status || '').toLowerCase()) {
    case 'accepted':
    case 'approved':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200'
    case 'sent':
    case 'under-review':
      return 'bg-sky-50 text-sky-800 border-sky-200'
    case 'rejected':
      return 'bg-red-50 text-red-800 border-red-200'
    case 'draft':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    default:
      return 'bg-amber-50 text-amber-900 border-amber-200'
  }
}

export default function ViewQuotationPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id ? String(params.id) : ''
  const [user, setUser] = useState<PortalUser | null>(null)
  const staff = isStaffOrAdmin(user)
  const isCustomer = user?.role === 'customer'

  const [loading, setLoading] = useState(true)
  const [quotation, setQuotation] = useState<QuotationItem | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [showApprove, setShowApprove] = useState(false)
  const [deliveryType, setDeliveryType] = useState<'warehouse' | 'customer_address'>('customer_address')
  const [deliveryWarehouseId, setDeliveryWarehouseId] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setUser(getStoredUser())
  }, [])

  const reload = () => {
    if (!id) return
    setLoading(true)
    void quotationsApi
      .get(id)
      .then(setQuotation)
      .catch((error) => showToast(error instanceof Error ? error.message : 'Failed to load', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!isCustomer) return
    void loadWarehouses()
      .then((list) => {
        setWarehouses(list)
        if (list[0]) setDeliveryWarehouseId(String(list[0].id))
      })
      .catch(console.error)
  }, [isCustomer])

  const handleSend = async () => {
    if (!quotation) return
    setBusy(true)
    try {
      const updated = await quotationsApi.send(quotation.id)
      setQuotation(updated)
      showToast('Quotation sent to customer', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to send', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleReject = async () => {
    if (!quotation) return
    setBusy(true)
    try {
      const updated = await quotationsApi.reject(quotation.id)
      setQuotation(updated)
      showToast('Quotation rejected', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to reject', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleApprove = async () => {
    if (!quotation) return
    if (deliveryType === 'warehouse' && !deliveryWarehouseId) {
      showToast('Please select a warehouse', 'error')
      return
    }
    const address =
      deliveryType === 'customer_address'
        ? [user?.address, user?.city, user?.postCode].filter(Boolean).join(', ')
        : ''
    if (deliveryType === 'customer_address' && !address) {
      showToast('Your profile address is empty. Update address or choose warehouse delivery.', 'error')
      return
    }
    setBusy(true)
    try {
      const response = await quotationsApi.approve(quotation.id, {
        deliveryType,
        deliveryWarehouseId: deliveryType === 'warehouse' ? Number(deliveryWarehouseId) : null,
        deliveryAddress: deliveryType === 'customer_address' ? address : undefined,
      })
      setQuotation(response.data.quotation)
      setShowApprove(false)
      showToast('Quotation approved — order waiting for artwork', 'success')
      if (response.data.order?.id) {
        router.push(`/dashboard/orders/${response.data.order.id}`)
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to approve', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading || !quotation) {
    return <DashboardLoading message="Loading quotation…" />
  }

  const canSend = staff && ['draft', 'under-review'].includes(String(quotation.status || '').toLowerCase())
  const canDecide = isCustomer && ['sent', 'under-review'].includes(String(quotation.status || '').toLowerCase())
  const canChat = staff || isCustomer
  const lineItems =
    quotation.items && quotation.items.length > 0
      ? quotation.items
      : [
          {
            id: 'legacy',
            product: quotation.product,
            sku: '',
            qty: quotation.quantity,
            price: quotation.unitPrice || '0.00',
            warehouse: '',
            subTotal: quotation.value?.replace(/^\$/, '') || '0.00',
          },
        ]

  return (
    <DashboardPage>
          <DashboardBackLink href="/dashboard/quotations">Back to Quotations</DashboardBackLink>

          <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
            <div className="relative overflow-hidden border-b border-[#d7e8e4] bg-gradient-to-br from-[#0b1722] via-[#14302b] to-[#1f4f47] px-6 py-7 text-white sm:px-8">
              <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/5" />
              <div className="pointer-events-none absolute bottom-0 right-24 h-28 w-28 rounded-full bg-[#3d8a7c]/20" />

              <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold tracking-wide text-white/90">
                      Quotation
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${statusStyles(quotation.status)}`}
                    >
                      {formatStatus(quotation.status)}
                    </span>
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    {quotation.quoteId}
                  </h1>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/70">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Generated {quotation.date || '—'}
                    </span>
                    {quotation.customer ? (
                      <>
                        <span className="hidden text-white/30 sm:inline">·</span>
                        <span className="inline-flex items-center gap-1.5">
                          <UserRound className="h-3.5 w-3.5" />
                          {quotation.customer}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {canSend && (
                    <button
                      disabled={busy}
                      onClick={() => void handleSend()}
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#1f4f47] shadow-sm transition hover:bg-[#e8f3f1] disabled:opacity-60"
                    >
                      <Send className="h-4 w-4" />
                      Send to customer
                    </button>
                  )}
                  {canDecide && (
                    <>
                      <button
                        disabled={busy}
                        onClick={() => setShowApprove(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#1f4f47] shadow-sm transition hover:bg-[#e8f3f1]"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Accept quote
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void handleReject()}
                        className="rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {staff && !quotation.orderId && (
                    <Link href={`/dashboard/quotations/${id}/edit`} className={heroSecondaryBtnClass}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Link>
                  )}
                  {quotation.orderId && (
                    <Link href={`/dashboard/orders/${quotation.orderId}`} className={heroSecondaryBtnClass}>
                      <ExternalLink className="h-4 w-4" />
                      View order
                    </Link>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3 sm:p-8">
              <Metric label="Products" value={quotation.product || '—'} />
              <Metric label="Total qty" value={quotation.quantity || '—'} />
              <Metric label="Quote total" value={quotation.value || '—'} highlight />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
                <div className="border-b border-[#e2eeeb] px-6 py-5">
                  <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">
                    <Package className="h-4 w-4" />
                    Line items
                  </h2>
                </div>
                <div className="rx-scroll max-h-[32rem] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className={tableHeadRow}>
                        <th className={tableHeadCellClass}>SKU</th>
                        <th className={tableHeadCellClass}>Product</th>
                        <th className={tableHeadCellClass}>Qty</th>
                        <th className={tableHeadCellClass}>Unit price</th>
                        <th className={tableHeadCellClass}>Warehouse</th>
                        <th className={`${tableHeadCellClass} text-right`}>Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item) => (
                        <tr key={item.id} className="border-b border-[#eef3f1] last:border-0">
                          <td className="px-6 py-4 text-slate-500">{item.sku || '—'}</td>
                          <td className="px-6 py-4 font-semibold text-slate-900">{item.product || '—'}</td>
                          <td className="px-6 py-4 text-slate-700">{item.qty || item.quantity || '—'}</td>
                          <td className="px-6 py-4 text-slate-700">${item.price || '0.00'}</td>
                          <td className="px-6 py-4 text-slate-600">{item.warehouse || '—'}</td>
                          <td className="px-6 py-4 text-right font-bold text-slate-900">
                            ${item.subTotal || '0.00'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
                <div className="border-b border-[#e2eeeb] px-6 py-5">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">Notes</h2>
                </div>
                <div className="p-6 sm:p-8">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {quotation.notes?.trim() || 'No initial notes.'}
                  </p>
                </div>
              </div>

              <QuotationChat
                quotationId={quotation.id}
                quoteLabel={quotation.quoteId}
                peerName={staff ? quotation.customer || 'Customer' : 'Rexapack'}
                user={user}
                canChat={canChat}
                isStaff={staff}
              />
            </div>

            <div>
              <div className="sticky top-8 overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
                <div className="border-b border-[#e2eeeb] bg-gradient-to-r from-[#e8f3f1] to-white px-6 py-5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">
                    Quotation details
                  </h3>
                </div>
                <div className="space-y-4 p-6">
                  <DetailRow label="Status" value={formatStatus(quotation.status)} />
                  <DetailRow label="Customer" value={quotation.customer || '—'} />
                  <DetailRow label="Expires" value={quotation.expiresDate || '—'} />
                  <div className="rounded-xl border border-[#e2eeeb] bg-[#f8fbfa] px-4 py-3.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Linked order
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {quotation.orderId ? (
                        <Link
                          href={`/dashboard/orders/${quotation.orderId}`}
                          className="text-[#2d6a5f] underline"
                        >
                          View order
                        </Link>
                      ) : (
                        <span className="font-medium text-slate-500">Created when customer accepts</span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-[#1f4f47] to-[#2d6a5f] px-4 py-4 text-white">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Total</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight">{quotation.value || '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        {showApprove && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl border border-[#d7e8e4] bg-white p-6 shadow-xl">
              <h3 className="text-lg font-bold text-slate-900">Approve quotation</h3>
              <p className="mt-1 text-sm text-slate-500">
                Choose where finished products should be delivered. This creates an order waiting for artwork.
              </p>

              <div className="mt-5 space-y-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-[#2d6a5f]/40">
                  <input
                    type="radio"
                    checked={deliveryType === 'warehouse'}
                    onChange={() => setDeliveryType('warehouse')}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-semibold">Store in Rexapack warehouse</span>
                    <span className="text-xs text-slate-500">Select which warehouse will hold your stock</span>
                  </span>
                </label>
                {deliveryType === 'warehouse' && (
                  <select
                    value={deliveryWarehouseId}
                    onChange={(e) => setDeliveryWarehouseId(e.target.value)}
                    className={fieldSelectClass}
                  >
                    <option value="">Select warehouse</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                )}
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-[#2d6a5f]/40">
                  <input
                    type="radio"
                    checked={deliveryType === 'customer_address'}
                    onChange={() => setDeliveryType('customer_address')}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-semibold">Deliver to my address</span>
                    <span className="text-xs text-slate-500">
                      {[user?.address, user?.city, user?.postCode].filter(Boolean).join(', ') ||
                        'Uses your profile address'}
                    </span>
                  </span>
                </label>
              </div>

              <div className="mt-6 flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => void handleApprove()}
                  className={`${panelCtaClass} flex-1 disabled:opacity-60`}
                >
                  Confirm & create order
                </button>
                <button
                  onClick={() => setShowApprove(false)}
                  className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
    </DashboardPage>
  )
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        highlight
          ? 'border-[#c5e4de] bg-gradient-to-br from-[#e8f3f1] to-white'
          : 'border-[#e2eeeb] bg-[#f8fbfa]'
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 font-bold tracking-tight text-slate-900 ${highlight ? 'text-2xl' : 'text-lg'}`}>
        {value}
      </p>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={detailRowClass}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}
