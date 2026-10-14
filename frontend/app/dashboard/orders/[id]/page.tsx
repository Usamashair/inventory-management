'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Calendar, ChevronRight, Package, Upload, UserRound } from 'lucide-react'
import { OrderItem, artworksApi, fileToBase64, ordersApi } from '@/lib/resources'
import {
  advanceOrderLabel,
  formatOrderStatus,
  jumpTargets,
  nextOrderStatus,
} from '@/lib/order-status'
import { getStoredUser, isStaffOrAdmin } from '@/lib/auth'
import { showToast } from '@/lib/toast'
import {
  DashboardBackLink,
  DashboardLoading,
  DashboardPage,
  detailRowClass,
  fieldTextareaClass,
  heroCtaClass,
  heroSecondaryBtnClass,
  panelCtaClass,
  tableHeadCellClass,
  tableHeadRow,
  totalBannerClass,
} from '@/components/dashboard-page'

function orderStatusStyles(status: string) {
  switch (String(status || '').toLowerCase()) {
    case 'delivered':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200'
    case 'in-transit':
      return 'bg-sky-50 text-sky-800 border-sky-200'
    case 'in-production':
      return 'bg-amber-50 text-amber-900 border-amber-200'
    case 'waiting-for-artwork':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    default:
      return 'bg-amber-50 text-amber-900 border-amber-200'
  }
}

export default function ViewOrderPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ? String(params.id) : ''
  const user = getStoredUser()
  const staff = isStaffOrAdmin(user)
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<OrderItem | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [advancing, setAdvancing] = useState(false)

  const reload = () => {
    if (!id || id === 'undefined') return
    setLoading(true)
    void ordersApi
      .get(id)
      .then(setOrder)
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Failed to load order'
        showToast(message, 'error')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const toastForStatus = (previous: OrderItem, nextStatus: string) => {
    if (nextStatus === 'delivered') {
      showToast(
        previous.deliveryType === 'warehouse'
          ? `Marked ${formatOrderStatus(nextStatus)} — stock/invoice updated if needed`
          : `Marked ${formatOrderStatus(nextStatus)} — invoice created if needed`,
        'success',
      )
      return
    }
    showToast(`Marked ${formatOrderStatus(nextStatus)}`, 'success')
  }

  const handleAdvance = async (to?: string) => {
    if (!order || !staff) return
    setAdvancing(true)
    try {
      const updated = await ordersApi.advance(order.id, to ? { to } : undefined)
      const reached = to || nextOrderStatus(order.status) || updated.status
      setOrder(updated)
      toastForStatus(order, reached)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to advance status'
      showToast(message, 'error')
    } finally {
      setAdvancing(false)
    }
  }

  if (loading || !order) {
    return <DashboardLoading message="Loading order…" />
  }

  const waitingArtwork = order.status === 'waiting-for-artwork'
  const needsRevision = order.artworkStatus === 'revision-requested'
  const canUpload =
    waitingArtwork &&
    (user?.role === 'customer' || staff) &&
    order.artworkStatus !== 'approved' &&
    (!order.artworkId || needsRevision)
  const advanceLabel = staff ? advanceOrderLabel(order.status) : null
  const canAdvance =
    order.status === 'waiting-for-artwork'
      ? !!(order.artworkId && order.artworkStatus === 'approved')
      : !!advanceLabel
  const jumps = staff ? jumpTargets(order.status) : []
  const orderTotal = order.value || `$${order.total || '0.00'}`

  return (
    <DashboardPage>
      <DashboardBackLink href="/dashboard/orders">Back to Orders</DashboardBackLink>

      {waitingArtwork && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-bold">Waiting for artwork</p>
          <p className="mt-1">
            {needsRevision
              ? 'Revision requested — please upload an updated artwork file.'
              : order.artworkId
                ? order.artworkStatus === 'revision-sent'
                  ? 'Revised artwork was sent and is awaiting admin approval.'
                  : 'Artwork was uploaded and is awaiting admin approval before production.'
                : 'Please upload artwork for this order so production can begin.'}
          </p>
          {order.artworkId && (
            <Link
              href={`/dashboard/artwork/${order.artworkId}`}
              className="mt-2 inline-block font-semibold text-[#2d6a5f] underline"
            >
              {needsRevision ? 'Upload revision' : 'View artwork'}
            </Link>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
        <div className="relative overflow-hidden border-b border-[#d7e8e4] bg-gradient-to-br from-[#0b1722] via-[#14302b] to-[#1f4f47] px-6 py-7 text-white sm:px-8">
          <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute bottom-0 right-24 h-28 w-28 rounded-full bg-[#3d8a7c]/20" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold tracking-wide text-white/90">
                  Order
                </span>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${orderStatusStyles(order.status)}`}
                >
                  {formatOrderStatus(order.status)}
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {order.orderId}
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/70">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Order date {order.date || '—'}
                </span>
                {order.customer ? (
                  <>
                    <span className="hidden text-white/30 sm:inline">·</span>
                    <span className="inline-flex items-center gap-1.5">
                      <UserRound className="h-3.5 w-3.5" />
                      {order.customer}
                    </span>
                  </>
                ) : null}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {staff && canAdvance && (
                <button
                  type="button"
                  disabled={advancing}
                  onClick={() => void handleAdvance()}
                  className={`${heroCtaClass} disabled:opacity-60`}
                >
                  {advancing ? 'Updating…' : advanceLabel}
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
              {staff &&
                jumps.map((jump) => (
                  <button
                    key={jump.value}
                    type="button"
                    disabled={advancing}
                    onClick={() => void handleAdvance(jump.value)}
                    className={`${heroSecondaryBtnClass} disabled:opacity-60`}
                  >
                    {jump.label}
                  </button>
                ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3 sm:p-8">
          <Metric label="Products" value={order.product || '—'} />
          <Metric label="Total qty" value={order.quantity || '—'} />
          <Metric label="Order total" value={orderTotal} highlight />
        </div>
      </div>

      {staff && jumps.length > 0 && (
        <p className="text-sm text-slate-500">
          Jump ahead can go In Production → In transit, or directly to Delivered. Stock and invoice
          apply when Delivered is reached.
        </p>
      )}

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
                    <th className={`${tableHeadCellClass} text-right`}>Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items || []).map((item, idx) => (
                    <tr key={item.id || idx} className="border-b border-[#eef3f1] last:border-0">
                      <td className="px-6 py-4 text-slate-500">{item.sku || '—'}</td>
                      <td className="px-6 py-4 font-semibold text-slate-900">{item.product || '—'}</td>
                      <td className="px-6 py-4 text-slate-700">{item.qty || item.quantity || '—'}</td>
                      <td className="px-6 py-4 text-slate-700">${item.price || '0.00'}</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900">
                        ${item.subTotal || '0.00'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {canUpload && (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!order || !imageFile) {
                  showToast('Please select an artwork file', 'error')
                  return
                }
                setUploading(true)
                try {
                  const image = await fileToBase64(imageFile)
                  if (needsRevision && order.artworkId) {
                    await artworksApi.update(order.artworkId, {
                      image,
                      description: description || `Revision for ${order.orderId}`,
                    })
                    showToast('Revision sent — waiting for admin approval', 'success')
                  } else {
                    await artworksApi.createForOrder(order.id, {
                      image,
                      description: description || `Artwork for ${order.orderId}`,
                    })
                    showToast(
                      staff
                        ? 'Artwork uploaded and approved — order moved to In Production'
                        : 'Artwork uploaded. Waiting for admin approval.',
                      'success',
                    )
                  }
                  setImageFile(null)
                  setDescription('')
                  reload()
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'Failed to upload artwork'
                  showToast(message, 'error')
                } finally {
                  setUploading(false)
                }
              }}
              className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm"
            >
              <div className="border-b border-[#e2eeeb] bg-gradient-to-r from-[#e8f3f1] to-white px-6 py-5">
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">
                  <Upload className="h-4 w-4" />
                  {needsRevision ? 'Upload revised artwork' : 'Upload artwork for this order'}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {needsRevision
                    ? 'Admin requested changes. Upload a new file to send Revision Send.'
                    : staff
                      ? 'Admin/staff uploads are approved automatically and move the order to In Production.'
                      : 'Your upload will be marked Awaiting Approval until admin approves it.'}
                </p>
              </div>
              <div className="space-y-4 p-6 sm:p-8">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-[#e8f3f1] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#2d6a5f] hover:file:bg-[#d7e8e4]"
                  required
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Artwork notes / version description"
                  rows={3}
                  className={fieldTextareaClass}
                />
                <button
                  type="submit"
                  disabled={uploading}
                  className={`${panelCtaClass} disabled:opacity-60`}
                >
                  {uploading ? 'Uploading…' : needsRevision ? 'Send revision' : 'Submit artwork'}
                </button>
              </div>
            </form>
          )}

          <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
            <div className="border-b border-[#e2eeeb] px-6 py-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">Notes</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {order.notes?.trim() || 'No notes.'}
              </p>
            </div>
          </div>
        </div>

        <div>
          <div className="sticky top-8 overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
            <div className="border-b border-[#e2eeeb] bg-gradient-to-r from-[#e8f3f1] to-white px-6 py-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">
                Order details
              </h3>
            </div>
            <div className="space-y-4 p-6">
              <DetailRow label="Status" value={formatOrderStatus(order.status)} />
              {order.deliveryDate ? (
                <DetailRow label="Delivery date" value={order.deliveryDate} />
              ) : null}
              <div className={detailRowClass}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Delivery
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {order.deliveryType === 'warehouse'
                    ? `Warehouse: ${order.deliveryWarehouse || order.warehouseLocation || '—'}`
                    : order.deliveryType === 'customer_address'
                      ? `Address: ${order.deliveryAddress || '—'}`
                      : '—'}
                </p>
                {order.deliveryType === 'warehouse' && !['delivered'].includes(order.status) && (
                  <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Warehouse stock is added when this order reaches <strong>delivered</strong>. Use
                    Advance or Jump to Delivered.
                  </p>
                )}
                {order.deliveryType === 'warehouse' && ['delivered'].includes(order.status) && (
                  <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                    Qty for this order should now appear under Warehouses →{' '}
                    {order.deliveryWarehouse || 'selected warehouse'}.
                  </p>
                )}
              </div>
              <div className={detailRowClass}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Artwork
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {order.artworkId ? (
                    <Link
                      href={`/dashboard/artwork/${order.artworkId}`}
                      className="text-[#2d6a5f] underline"
                    >
                      {order.artworkStatus || 'Uploaded'}
                    </Link>
                  ) : (
                    <span className="font-medium text-slate-500">Not uploaded</span>
                  )}
                </p>
              </div>
              <div className={detailRowClass}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Invoice
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {order.invoiceId ? (
                    <Link
                      href={`/dashboard/invoices/${order.invoiceId}`}
                      className="text-[#2d6a5f] underline"
                    >
                      {order.invoiceNo || `Invoice #${order.invoiceId}`}
                    </Link>
                  ) : (
                    <span className="font-medium text-slate-500">
                      Created automatically when order is delivered
                    </span>
                  )}
                </p>
              </div>
              <div className={totalBannerClass}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Total</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">{orderTotal}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
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
