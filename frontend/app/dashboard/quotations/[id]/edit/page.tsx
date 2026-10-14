'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Calendar, Package, Plus, Trash2, UserRound } from 'lucide-react'
import { ProductItem, QuotationItem, productsApi, quotationsApi } from '@/lib/resources'
import { loadCustomers, loadWarehouses } from '@/lib/portal-data'
import type { Customer, Warehouse } from '@/lib/portal-data'
import { showToast } from '@/lib/toast'
import {
  DashboardBackLink,
  DashboardLoading,
  DashboardPage,
  detailRowClass,
  fieldInputClass,
  fieldLabelClass,
  fieldSelectClass,
  fieldTextareaClass,
  lineItemCardClass,
  panelCtaClass,
  secondaryBtnClass,
  softTealBtnClass,
  totalBannerClass,
} from '@/components/dashboard-page'

type LineItem = {
  productId: string
  qty: string
  price: string
  warehouseId: string
}

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

export default function EditQuotationPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id ? String(params.id) : ''
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [products, setProducts] = useState<ProductItem[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [quoteMeta, setQuoteMeta] = useState<Pick<QuotationItem, 'quoteId' | 'date' | 'customer' | 'expiresDate'> | null>(
    null,
  )
  const [customerId, setCustomerId] = useState('')
  const [status, setStatus] = useState('draft')
  const [notes, setNotes] = useState('')
  const [expiresDate, setExpiresDate] = useState('')
  const [items, setItems] = useState<LineItem[]>([
    { productId: '', qty: '1', price: '0.00', warehouseId: '' },
  ])

  useEffect(() => {
    if (!id || id === 'undefined') return

    setLoading(true)
    void Promise.all([
      productsApi.list(),
      loadWarehouses(),
      loadCustomers(),
      quotationsApi.get(id),
    ])
      .then(([availableProducts, availableWarehouses, availableCustomers, quote]) => {
        if (quote.orderId) {
          showToast('This quotation already has an order and can no longer be edited', 'error')
          router.replace(`/dashboard/quotations/${id}`)
          return
        }

        setProducts(availableProducts)
        setWarehouses(availableWarehouses)
        setCustomers(availableCustomers)
        setQuoteMeta({
          quoteId: quote.quoteId || '',
          date: quote.date || '',
          customer: quote.customer || '',
          expiresDate: quote.expiresDate || '',
        })
        setCustomerId(quote.customerId ? String(quote.customerId) : '')
        setStatus(quote.status || 'draft')
        setNotes(quote.notes || '')
        setExpiresDate(quote.expiresDate || '')

        if (quote.items && quote.items.length > 0) {
          setItems(
            quote.items.map((item) => {
              const product = availableProducts.find(
                (p) => String(p.id) === String(item.productId || ''),
              )
              return {
                productId: item.productId ? String(item.productId) : '',
                qty: item.qty || item.quantity || '1',
                price: product?.price || item.price || '0.00',
                warehouseId: item.warehouseId ? String(item.warehouseId) : '',
              }
            }),
          )
        } else {
          const matchedProduct =
            availableProducts.find((item) => String(item.id) === String(quote.productId || '')) ||
            availableProducts.find((item) => item.product === quote.product)
          setItems([
            {
              productId: matchedProduct ? String(matchedProduct.id) : '',
              qty: String(quote.quantity || '1'),
              price: matchedProduct?.price || String(quote.unitPrice || '0.00').replace(/[$,]/g, ''),
              warehouseId: matchedProduct?.warehouseId ? String(matchedProduct.warehouseId) : '',
            },
          ])
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id, router])

  const selectedProductIds = useMemo(
    () => items.map((item) => item.productId).filter(Boolean),
    [items],
  )

  const total = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = Number.parseFloat(item.qty) || 0
      const price = Number.parseFloat(item.price) || 0
      return sum + qty * price
    }, 0)
  }, [items])

  const totalQty = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number.parseFloat(item.qty) || 0), 0)
  }, [items])

  const productSummary = useMemo(() => {
    const names = items
      .map((item) => products.find((p) => p.id === item.productId)?.product)
      .filter(Boolean) as string[]
    if (names.length === 0) return '—'
    if (names.length === 1) return names[0]
    return `${names[0]} +${names.length - 1}`
  }, [items, products])

  const selectedCustomer = customers.find((c) => String(c.id) === customerId)

  const updateItem = (index: number, field: keyof LineItem, value: string) => {
    if (field === 'productId' && value) {
      const alreadyUsed = items.some((item, i) => i !== index && item.productId === value)
      if (alreadyUsed) {
        showToast('This product is already added to the quotation', 'error')
        return
      }
    }

    setItems((current) =>
      current.map((item, i) => {
        if (i !== index) return item
        const next = { ...item, [field]: value }
        if (field === 'productId') {
          const product = products.find((p) => p.id === value)
          next.price = product?.price || '0.00'
          next.warehouseId = product?.warehouseId ? String(product.warehouseId) : ''
        }
        return next
      }),
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || id === 'undefined') return

    if (!customerId) {
      showToast('Please select a customer', 'error')
      return
    }

    const productIds = items.map((item) => item.productId).filter(Boolean)
    if (productIds.length === 0) {
      showToast('Add at least one product', 'error')
      return
    }
    if (new Set(productIds).size !== productIds.length) {
      showToast('Each product can only be added once per quotation', 'error')
      return
    }

    setSaving(true)
    try {
      await quotationsApi.update(id, {
        customerId: Number(customerId),
        notes,
        status,
        expiresDate: expiresDate || null,
        items: items.map((item) => ({
          productId: Number(item.productId),
          qty: item.qty,
          price: Number(item.price || 0),
          warehouseId: item.warehouseId ? Number(item.warehouseId) : null,
        })),
      })
      showToast('Quotation updated successfully', 'success')
      router.push(`/dashboard/quotations/${id}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update quotation'
      showToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <DashboardLoading message="Loading quotation…" />
  }

  return (
    <DashboardPage>
      <DashboardBackLink href="/dashboard/quotations">Back to Quotations</DashboardBackLink>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
          <div className="relative overflow-hidden border-b border-[#d7e8e4] bg-gradient-to-br from-[#0b1722] via-[#14302b] to-[#1f4f47] px-6 py-7 text-white sm:px-8">
            <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/5" />
            <div className="pointer-events-none absolute bottom-0 right-24 h-28 w-28 rounded-full bg-[#3d8a7c]/20" />

            <div className="relative">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold tracking-wide text-white/90">
                  Edit quotation
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusStyles(status)}`}>
                  {formatStatus(status)}
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {quoteMeta?.quoteId || 'Quotation'}
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/70">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Generated {quoteMeta?.date || '—'}
                </span>
                {(selectedCustomer?.name || quoteMeta?.customer) && (
                  <>
                    <span className="hidden text-white/30 sm:inline">·</span>
                    <span className="inline-flex items-center gap-1.5">
                      <UserRound className="h-3.5 w-3.5" />
                      {selectedCustomer?.name || quoteMeta?.customer}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3 sm:p-8">
            <Metric label="Products" value={productSummary} />
            <Metric label="Total qty" value={String(totalQty || '—')} />
            <Metric label="Quote total" value={`$${total.toFixed(2)}`} highlight />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-[#e2eeeb] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">
                    <Package className="h-4 w-4" />
                    Line items
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">Each product can only appear once.</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setItems((current) => [
                      ...current,
                      { productId: '', qty: '1', price: '0.00', warehouseId: '' },
                    ])
                  }
                  className={softTealBtnClass}
                >
                  <Plus className="h-4 w-4" />
                  Add item
                </button>
              </div>

              <div className="space-y-4 p-6 sm:p-8">
                {items.map((item, index) => {
                  const lineTotal =
                    (Number.parseFloat(item.qty) || 0) * (Number.parseFloat(item.price) || 0)

                  return (
                    <div key={index} className={lineItemCardClass}>
                      <div className="col-span-12 lg:col-span-3">
                        <label className={fieldLabelClass}>Product</label>
                        <select
                          value={item.productId}
                          onChange={(e) => updateItem(index, 'productId', e.target.value)}
                          required
                          className={fieldSelectClass}
                        >
                          <option value="">Select product</option>
                          {products.map((product) => (
                            <option
                              key={product.id}
                              value={product.id}
                              disabled={
                                selectedProductIds.includes(product.id) &&
                                item.productId !== product.id
                              }
                            >
                              {product.product} ({product.sku})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-6 sm:col-span-3 lg:col-span-2">
                        <label className={fieldLabelClass}>Qty</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={item.qty}
                          onChange={(e) => updateItem(index, 'qty', e.target.value)}
                          required
                          className={fieldInputClass}
                        />
                      </div>
                      <div className="col-span-6 sm:col-span-3 lg:col-span-2">
                        <label className={fieldLabelClass}>Unit price</label>
                        <div className="flex h-11 items-center rounded-xl border border-[#d7e8e4] bg-slate-50 px-4 text-sm font-semibold text-slate-700">
                          ${Number.parseFloat(item.price || '0').toFixed(2)}
                        </div>
                      </div>
                      <div className="col-span-6 sm:col-span-3 lg:col-span-2">
                        <label className={fieldLabelClass}>Line total</label>
                        <div className="flex h-11 items-center rounded-xl border border-[#d7e8e4] bg-white px-4 text-sm font-bold text-slate-900">
                          ${lineTotal.toFixed(2)}
                        </div>
                      </div>
                      <div className="col-span-10 sm:col-span-5 lg:col-span-2">
                        <label className={fieldLabelClass}>Warehouse</label>
                        <select
                          value={item.warehouseId}
                          onChange={(e) => updateItem(index, 'warehouseId', e.target.value)}
                          className={fieldSelectClass}
                        >
                          <option value="">Select</option>
                          {warehouses.map((warehouse) => (
                            <option key={warehouse.id} value={warehouse.id}>
                              {warehouse.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2 flex items-end lg:col-span-1">
                        <button
                          type="button"
                          disabled={items.length === 1}
                          onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-red-600 transition hover:bg-red-50 disabled:opacity-40"
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
              <div className="border-b border-[#e2eeeb] px-6 py-5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">Notes</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Optional requirements or message for this quotation.
                </p>
              </div>
              <div className="p-6 sm:p-8">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  placeholder="Any special requirements or notes…"
                  className={fieldTextareaClass}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="sticky top-8 space-y-6">
              <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
                <div className="border-b border-[#e2eeeb] bg-gradient-to-r from-[#e8f3f1] to-white px-6 py-5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">
                    Quotation details
                  </h3>
                </div>
                <div className="space-y-4 p-6">
                  <div>
                    <label className={fieldLabelClass}>Customer</label>
                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      required
                      className={fieldSelectClass}
                    >
                      <option value="">Select a customer</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} ({customer.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={fieldLabelClass}>Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className={fieldSelectClass}
                    >
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="under-review">Under Review</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="expired">Expired</option>
                    </select>
                  </div>

                  <div>
                    <label className={fieldLabelClass}>Expires</label>
                    <input
                      type="date"
                      value={expiresDate}
                      onChange={(e) => setExpiresDate(e.target.value)}
                      className={fieldInputClass}
                    />
                  </div>

                  <div className={detailRowClass}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Quote ID
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {quoteMeta?.quoteId || '—'}
                    </p>
                  </div>

                  <div className={detailRowClass}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Generated
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {quoteMeta?.date || '—'}
                    </p>
                  </div>

                  <div className={totalBannerClass}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Total</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight">${total.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className={`${panelCtaClass} w-full justify-center disabled:opacity-60`}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/quotations/${id}`)}
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
