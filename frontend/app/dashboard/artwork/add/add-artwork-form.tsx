'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ImageIcon, Upload, UserRound } from 'lucide-react'
import { OrderItem, artworksApi, fileToBase64, ordersApi } from '@/lib/resources'
import { loadCustomers } from '@/lib/portal-data'
import type { Customer } from '@/lib/portal-data'
import { getStoredUser, isStaffOrAdmin } from '@/lib/auth'
import { showToast } from '@/lib/toast'
import {
  DashboardBackLink,
  DashboardPage,
  detailRowClass,
  fieldHintClass,
  fieldLabelClass,
  fieldSelectClass,
  fieldTextareaClass,
  panelCtaClass,
  secondaryBtnClass,
} from '@/components/dashboard-page'

export default function AddArtworkForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const user = getStoredUser()
  const isAdmin = isStaffOrAdmin(user)
  const presetOrderId = searchParams.get('orderId') || ''

  const [saving, setSaving] = useState(false)
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [orderId, setOrderId] = useState(presetOrderId)
  const [customerId, setCustomerId] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [description, setDescription] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        if (isAdmin) {
          setCustomers(await loadCustomers())
        }
        const all = await ordersApi.list()
        const eligible = all.filter(
          (o) => o.status === 'waiting-for-artwork' && !o.artworkId,
        )
        if (!active) return
        setOrders(eligible)

        if (presetOrderId && eligible.some((o) => o.id === presetOrderId)) {
          const preset = eligible.find((o) => o.id === presetOrderId)
          if (preset?.customerId) {
            setCustomerId(String(preset.customerId))
          }
          setOrderId(presetOrderId)
        } else if (!isAdmin && user?.id) {
          setCustomerId(String(user.id))
        }
      } catch (error) {
        if (!active) return
        const message = error instanceof Error ? error.message : 'Failed to load orders'
        showToast(message, 'error')
      } finally {
        if (active) setLoadingOrders(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [isAdmin, presetOrderId, user?.id])

  const customerOrders = useMemo(() => {
    if (!customerId) return []
    return orders.filter((o) => String(o.customerId) === String(customerId))
  }, [orders, customerId])

  const customersWithPendingArtwork = useMemo(() => {
    const ids = new Set(orders.map((o) => String(o.customerId)).filter(Boolean))
    return customers.filter((c) => ids.has(String(c.id)))
  }, [customers, orders])

  const selectedOrder = useMemo(
    () => customerOrders.find((o) => o.id === orderId) || null,
    [customerOrders, orderId],
  )

  const selectedCustomer = useMemo(
    () =>
      customersWithPendingArtwork.find((c) => String(c.id) === customerId) ||
      customers.find((c) => String(c.id) === customerId) ||
      null,
    [customersWithPendingArtwork, customers, customerId],
  )

  const handleCustomerChange = (nextCustomerId: string) => {
    setCustomerId(nextCustomerId)
    setOrderId('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orderId) {
      showToast('Please select the order this artwork belongs to', 'error')
      return
    }
    if (!imageFile) {
      showToast('Please select an artwork file', 'error')
      return
    }
    if (isAdmin && !customerId && !selectedOrder?.customerId) {
      showToast('Please select a customer', 'error')
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        description,
        image: await fileToBase64(imageFile),
      }
      if (isAdmin && customerId) {
        payload.customerId = Number(customerId)
      }
      const created = await artworksApi.createForOrder(orderId, payload)
      showToast(
        isAdmin
          ? 'Artwork uploaded and approved — order moved to In Production'
          : 'Artwork uploaded — awaiting admin approval',
        'success',
      )
      router.push(`/dashboard/artwork/${created.id}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload artwork'
      showToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardPage>
      <DashboardBackLink href="/dashboard/artwork">Back to Artwork</DashboardBackLink>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
          <div className="relative overflow-hidden border-b border-[#d7e8e4] bg-gradient-to-br from-[#0b1722] via-[#14302b] to-[#1f4f47] px-6 py-7 text-white sm:px-8">
            <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/5" />
            <div className="pointer-events-none absolute bottom-0 right-24 h-28 w-28 rounded-full bg-[#3d8a7c]/20" />

            <div className="relative">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold tracking-wide text-white/90">
                  Artwork
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  Upload
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Upload artwork
              </h1>
              <p className="mt-2 text-sm text-white/70">
                Artwork must be linked to an order that is waiting for artwork.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3 sm:p-8">
            <Metric
              label="Customer"
              value={selectedCustomer?.name || (customerId ? user?.name || '—' : '—')}
            />
            <Metric label="Order" value={selectedOrder?.orderId || '—'} />
            <Metric label="File" value={imageFile?.name || '—'} highlight />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
              <div className="border-b border-[#e2eeeb] px-6 py-5">
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">
                  <ImageIcon className="h-4 w-4" />
                  Artwork file
                </h2>
                <p className="mt-1 text-sm text-slate-500">Upload the image or PDF for this order.</p>
              </div>
              <div className="p-6 sm:p-8">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#d7e8e4] bg-[#f8fbfa] px-6 py-10 transition hover:border-[#2d6a5f] hover:bg-[#e8f3f1]/50">
                  <Upload className="mb-2 h-8 w-8 text-slate-400" />
                  <span className="text-sm text-slate-600">
                    {imageFile ? imageFile.name : 'Click to select image or PDF'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
              <div className="border-b border-[#e2eeeb] px-6 py-5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">Description</h2>
                <p className="mt-1 text-sm text-slate-500">Optional notes about this artwork.</p>
              </div>
              <div className="p-6 sm:p-8">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  className={fieldTextareaClass}
                  placeholder="Notes about this artwork…"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="sticky top-8 space-y-6">
              <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
                <div className="border-b border-[#e2eeeb] bg-gradient-to-r from-[#e8f3f1] to-white px-6 py-5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">
                  Artwork & customer
                </h3>
                </div>
                <div className="space-y-4 p-6">
                  {isAdmin ? (
                    <div>
                      <label className={fieldLabelClass}>Customer *</label>
                      {loadingOrders ? (
                        <p className="text-sm text-slate-500">Loading customers…</p>
                      ) : customersWithPendingArtwork.length === 0 ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          No customers currently have an order waiting for artwork.
                        </div>
                      ) : (
                        <select
                          value={customerId}
                          onChange={(e) => handleCustomerChange(e.target.value)}
                          required
                          className={fieldSelectClass}
                        >
                          <option value="">Select a customer…</option>
                          {customersWithPendingArtwork.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.email})
                            </option>
                          ))}
                        </select>
                      )}
                      <p className={fieldHintClass}>
                        Only customers with an order waiting for artwork are listed.
                      </p>
                    </div>
                  ) : (
                    <div className={detailRowClass}>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Customer
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {user?.name || 'Your account'}
                      </p>
                    </div>
                  )}

                  {selectedCustomer && (
                    <div className="rounded-2xl border border-[#d7e8e4] bg-[#f8fbfa] p-4">
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2d6a5f] text-white">
                          <UserRound className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {selectedCustomer.name}
                          </p>
                          <p className="truncate text-xs text-slate-500">{selectedCustomer.email}</p>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm text-slate-600">
                        {selectedCustomer.phone ? <p>{selectedCustomer.phone}</p> : null}
                        {[selectedCustomer.address, selectedCustomer.city, selectedCustomer.postCode]
                          .filter(Boolean)
                          .join(', ') ? (
                          <p>
                            {[selectedCustomer.address, selectedCustomer.city, selectedCustomer.postCode]
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className={fieldLabelClass}>Order *</label>
                    {!customerId ? (
                      <div className="rounded-xl border border-dashed border-[#d7e8e4] bg-[#f8fbfa] px-4 py-3 text-sm text-slate-500">
                        Select a customer first to see their orders.
                      </div>
                    ) : loadingOrders ? (
                      <p className="text-sm text-slate-500">Loading orders…</p>
                    ) : customerOrders.length === 0 ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        No orders waiting for artwork for this customer.
                        {user?.role === 'customer' ? (
                          <>
                            {' '}
                            Open your{' '}
                            <Link href="/dashboard/orders" className="font-semibold text-[#2d6a5f] underline">
                              orders
                            </Link>{' '}
                            once a quote is approved.
                          </>
                        ) : (
                          <> Approve a quotation for this customer first.</>
                        )}
                      </div>
                    ) : (
                      <select
                        value={orderId}
                        onChange={(e) => setOrderId(e.target.value)}
                        required
                        className={fieldSelectClass}
                      >
                        <option value="">Select an order…</option>
                        {customerOrders.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.orderId}
                            {o.product ? ` — ${o.product}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    {customerId && (
                      <p className={fieldHintClass}>
                        Showing {customerOrders.length} order
                        {customerOrders.length === 1 ? '' : 's'} waiting for artwork.
                      </p>
                    )}
                  </div>

                  {selectedOrder ? (
                    <div className="rounded-2xl border border-[#d7e8e4] bg-[#f8fbfa] p-4">
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1f4f47] text-xs font-bold text-white">
                          ORD
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {selectedOrder.orderId}
                          </p>
                          <p className="text-xs font-medium text-[#2d6a5f]">Selected order</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className={detailRowClass}>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Product</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {selectedOrder.product || '—'}
                          </p>
                        </div>
                        <div className={detailRowClass}>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            Waiting for artwork
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : customerId ? (
                    <div className="rounded-2xl border border-dashed border-[#d7e8e4] bg-[#f8fbfa] px-4 py-6 text-center">
                      <p className="text-sm font-semibold text-slate-600">No order selected</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Choose one of this customer’s orders above.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={saving || !customerId || customerOrders.length === 0}
                  className={`${panelCtaClass} w-full justify-center disabled:opacity-60`}
                >
                  {saving ? 'Uploading…' : 'Upload & link to order'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/artwork')}
                  className={`${secondaryBtnClass} w-full`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
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
