'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check,
  Eye,
  Plus,
  Trash2,
  Edit,
  X,
  Send,
  FileText,
  Clock3,
  DollarSign,
  BadgeCheck,
  Lock,
} from 'lucide-react'
import ConfirmDialog from '@/components/confirm-dialog'
import TableLoader from '@/components/table-loader'
import StatusSelect, { QUOTATION_STATUSES } from '@/components/status-select'
import {
  DashboardHero,
  DashboardPage,
  DashboardPanel,
  heroCtaClass,
  tableHeadCellClass,
  tableHeadRow,
  tableRowClass,
} from '@/components/dashboard-page'
import { QuotationItem, quotationsApi } from '@/lib/resources'
import { loadWarehouses } from '@/lib/portal-data'
import type { Warehouse } from '@/lib/portal-data'
import { getStoredUser, isStaffOrAdmin, PortalUser } from '@/lib/auth'
import { showToast } from '@/lib/toast'

export default function QuotationsPage() {
  const router = useRouter()
  const [user, setUser] = useState<PortalUser | null>(null)
  const staff = isStaffOrAdmin(user)
  const isCustomer = user?.role === 'customer'

  const [quotations, setQuotations] = useState<QuotationItem[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<QuotationItem | null>(null)
  const [busy, setBusy] = useState(false)

  const [approveQuote, setApproveQuote] = useState<QuotationItem | null>(null)
  const [deliveryType, setDeliveryType] = useState<'warehouse' | 'customer_address'>('customer_address')
  const [deliveryWarehouseId, setDeliveryWarehouseId] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')

  useEffect(() => {
    setUser(getStoredUser())
  }, [])

  useEffect(() => {
    if (!user) return
    setDeliveryAddress([user.address, user.city, user.postCode].filter(Boolean).join(', '))
  }, [user])

  useEffect(() => {
    let active = true
    void quotationsApi
      .list()
      .then((data) => {
        if (active) setQuotations(data)
      })
      .catch((err) => {
        if (active) {
          const message = err instanceof Error ? err.message : 'Failed to load quotations'
          showToast(message, 'error')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!isCustomer) return
    void loadWarehouses().then(setWarehouses).catch(console.error)
  }, [isCustomer])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200'
      case 'sent':
        return 'bg-[#e8f3f1] text-[#1f4a45] border-[#c5e4de]'
      case 'under-review':
        return 'bg-amber-50 text-amber-900 border-amber-200'
      case 'draft':
        return 'bg-slate-100 text-slate-700 border-slate-200'
      case 'rejected':
        return 'bg-red-50 text-red-800 border-red-200'
      case 'expired':
        return 'bg-orange-50 text-orange-800 border-orange-200'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  const canDecide = (quote: QuotationItem) =>
    isCustomer && ['sent', 'under-review'].includes(String(quote.status || '').toLowerCase())

  const canSend = (quote: QuotationItem) =>
    staff && ['draft', 'under-review'].includes(String(quote.status || '').toLowerCase())

  const handleSend = async (quote: QuotationItem) => {
    setBusy(true)
    try {
      const updated = await quotationsApi.send(quote.id)
      setQuotations((current) => current.map((q) => (q.id === quote.id ? { ...q, ...updated } : q)))
      showToast(`Quotation ${quote.quoteId} sent to customer`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to send quotation', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!itemToDelete) return
    if (itemToDelete.orderId) {
      showToast('This quotation already has an order and cannot be deleted', 'error')
      setItemToDelete(null)
      return
    }
    setDeleting(true)

    try {
      await quotationsApi.remove(itemToDelete.id)
      setQuotations((current) => current.filter((q) => q.id !== itemToDelete.id))
      setItemToDelete(null)
      showToast('Quotation deleted successfully', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete quotation'
      showToast(message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleStatusChange = async (quoteId: string, status: string) => {
    try {
      const updated = await quotationsApi.update(quoteId, { status })
      setQuotations((current) =>
        current.map((quote) => (quote.id === quoteId ? { ...quote, ...updated } : quote)),
      )
      showToast('Quotation status updated', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update status'
      showToast(message, 'error')
    }
  }

  const openApprove = (quote: QuotationItem) => {
    setApproveQuote(quote)
    setDeliveryType(warehouses.length > 0 ? 'warehouse' : 'customer_address')
    setDeliveryWarehouseId(warehouses[0] ? String(warehouses[0].id) : '')
  }

  const handleReject = async (quote: QuotationItem) => {
    setBusy(true)
    try {
      const updated = await quotationsApi.reject(quote.id)
      setQuotations((current) => current.map((q) => (q.id === quote.id ? { ...q, ...updated } : q)))
      showToast('Quotation rejected', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to reject', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleApprove = async () => {
    if (!approveQuote) return
    if (deliveryType === 'warehouse' && !deliveryWarehouseId) {
      showToast('Please select a warehouse', 'error')
      return
    }
    if (deliveryType === 'customer_address' && !deliveryAddress.trim()) {
      showToast('Please enter your delivery address', 'error')
      return
    }

    setBusy(true)
    try {
      const response = await quotationsApi.approve(approveQuote.id, {
        deliveryType,
        deliveryWarehouseId: deliveryType === 'warehouse' ? Number(deliveryWarehouseId) : null,
        deliveryAddress: deliveryType === 'customer_address' ? deliveryAddress.trim() : undefined,
      })
      const updated = response.data.quotation
      setQuotations((current) =>
        current.map((q) => (q.id === approveQuote.id ? { ...q, ...updated } : q)),
      )
      setApproveQuote(null)
      showToast('Quotation approved — order waiting for artwork', 'success')
      if (response.data.order?.id) {
        router.push(`/dashboard/orders/${response.data.order.id}`)
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to approve quotation', 'error')
    } finally {
      setBusy(false)
    }
  }

  const parseMoney = (value: string) => {
    const amount = Number.parseFloat(value.replace(/[^0-9.-]/g, ''))
    return Number.isFinite(amount) ? amount : 0
  }

  const totalActive = quotations.filter((q) => !['rejected', 'expired'].includes(q.status)).length
  const pendingApproval = quotations.filter((q) => ['sent', 'under-review'].includes(q.status)).length
  const averageValue =
    quotations.length === 0
      ? 0
      : quotations.reduce((sum, q) => sum + parseMoney(q.value), 0) / quotations.length
  const approvedCount = quotations.filter((q) => q.status === 'approved').length

  const stats = [
    {
      label: 'Total active',
      value: String(totalActive),
      hint: `${quotations.length} total quotes`,
      icon: FileText,
    },
    {
      label: 'Pending approval',
      value: String(pendingApproval),
      hint: pendingApproval ? 'Action required' : 'All clear',
      icon: Clock3,
      warn: pendingApproval > 0,
    },
    {
      label: 'Average value',
      value: `$${averageValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      hint: 'Per quote',
      icon: DollarSign,
    },
    {
      label: 'Approved',
      value: String(approvedCount),
      hint: 'Quotes accepted',
      icon: BadgeCheck,
    },
  ]

  return (
    <DashboardPage>
      <DashboardHero
        eyebrow="Quotations"
        title="Quote management"
        description={
          isCustomer
            ? 'Accept or reject quotations after Rexapack sends them (status must be Sent).'
            : 'Create a draft, then click Send so the customer can accept it.'
        }
        actions={
          staff ? (
            <Link href="/dashboard/quotations/add" className={heroCtaClass}>
              <Plus className="h-4 w-4" />
              New quotation
            </Link>
          ) : undefined
        }
        stats={stats}
      />

      <DashboardPanel
        title="All quotations"
        description={
          loading ? 'Loading…' : `${quotations.length} quote${quotations.length === 1 ? '' : 's'}`
        }
        noPadding
      >
            <div className="rx-scroll max-h-[32rem] overflow-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10">
                  <tr className={tableHeadRow}>
                    <th className={tableHeadCellClass}>Quote ID</th>
                    {staff && <th className={tableHeadCellClass}>Customer</th>}
                    <th className={tableHeadCellClass}>Date</th>
                    <th className={tableHeadCellClass}>Total value</th>
                    <th className={tableHeadCellClass}>Status</th>
                    <th className={tableHeadCellClass}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableLoader colSpan={staff ? 6 : 5} />
                  ) : (
                    quotations.map((quote) => (
                      <tr
                        key={quote.id}
                        className={tableRowClass}
                      >
                        <td className="px-6 py-4">
                          <Link
                            href={`/dashboard/quotations/${quote.id}`}
                            className="font-bold text-[#1f4f47] hover:underline"
                          >
                            {quote.quoteId}
                          </Link>
                        </td>
                        {staff && (
                          <td className="px-6 py-4 text-sm text-slate-600">{quote.customer || '—'}</td>
                        )}
                        <td className="px-6 py-4 text-sm text-slate-600">{quote.date}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900">{quote.value}</td>
                        <td className="px-6 py-4">
                          {staff && !quote.orderId ? (
                            <StatusSelect
                              value={quote.status}
                              options={QUOTATION_STATUSES}
                              onChange={(status) => void handleStatusChange(quote.id, status)}
                            />
                          ) : (
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${getStatusColor(quote.status)}`}
                            >
                              {quote.status}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/dashboard/quotations/${quote.id}`}
                              className="rounded-lg p-2 text-slate-600 transition hover:bg-[#e8f3f1] hover:text-[#2d6a5f]"
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>

                            {canSend(quote) && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleSend(quote)}
                                className="inline-flex items-center gap-1 rounded-lg bg-[#2d6a5f] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#245750] disabled:opacity-60"
                                title="Send to customer"
                              >
                                <Send className="h-3.5 w-3.5" />
                                Send
                              </button>
                            )}

                            {canDecide(quote) && (
                              <>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => openApprove(quote)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-[#2d6a5f] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#245750] disabled:opacity-60"
                                  title="Accept quote"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleReject(quote)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"
                                  title="Reject quote"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Reject
                                </button>
                              </>
                            )}

                            {isCustomer && quote.status === 'draft' && (
                              <span className="text-xs font-medium text-amber-700">
                                Waiting for Rexapack to send
                              </span>
                            )}

                            {quote.status === 'approved' && quote.orderId && (
                              <Link
                                href={`/dashboard/orders/${quote.orderId}`}
                                className="rounded-lg bg-[#2d6a5f] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#245750]"
                              >
                                Order
                              </Link>
                            )}

                            {staff && !quote.orderId && (
                              <>
                                <Link
                                  href={`/dashboard/quotations/${quote.id}/edit`}
                                  className="rounded-lg p-2 text-slate-600 transition hover:bg-[#e8f3f1] hover:text-[#2d6a5f]"
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </Link>
                                <button
                                  onClick={() => setItemToDelete(quote)}
                                  className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            {staff && quote.orderId && (
                              <span
                                className="inline-flex items-center gap-1 rounded-lg border border-[#c5e4de] bg-[#e8f3f1] px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#2d6a5f]"
                                title="Order already created — locked"
                              >
                                <Lock className="h-3 w-3" />
                                Locked
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                  {!loading && quotations.length === 0 && (
                    <tr>
                      <td colSpan={staff ? 6 : 5} className="px-6 py-14 text-center text-sm text-slate-500">
                        {isCustomer
                          ? 'No quotations yet. When admin sends you a quote, it will appear here.'
                          : 'No quotations found. Create one and send it to a customer.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
      </DashboardPanel>

      <ConfirmDialog
        open={Boolean(itemToDelete)}
        title="Delete Quotation"
        message={`Are you sure you want to delete ${itemToDelete?.quoteId || 'this quotation'}? This action cannot be undone.`}
        confirmLabel="Delete Quotation"
        loading={deleting}
        onCancel={() => setItemToDelete(null)}
        onConfirm={handleDelete}
      />

      {approveQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#d7e8e4] bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Accept {approveQuote.quoteId}</h3>
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
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#2d6a5f]"
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
                  <span className="text-xs text-slate-500">Enter or confirm the delivery address</span>
                </span>
              </label>
              {deliveryType === 'customer_address' && (
                <textarea
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  rows={3}
                  placeholder="Street, city, post code"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#2d6a5f]"
                />
              )}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleApprove()}
                className="flex-1 rounded-xl bg-[#2d6a5f] py-2.5 text-sm font-bold text-white hover:bg-[#245750] disabled:opacity-60"
              >
                {busy ? 'Approving…' : 'Confirm & create order'}
              </button>
              <button
                type="button"
                onClick={() => setApproveQuote(null)}
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
