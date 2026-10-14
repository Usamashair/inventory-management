'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  Calendar,
  Mail,
  MapPin,
  Package,
  Phone,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react'
import { ProductItem, productsApi, quotationsApi } from '@/lib/resources'
import { loadCustomers, loadWarehouses } from '@/lib/portal-data'
import type { Customer, Warehouse } from '@/lib/portal-data'
import { getStoredUser, isStaffOrAdmin } from '@/lib/auth'
import { showToast } from '@/lib/toast'
import {
  DashboardBackLink,
  DashboardPage,
  detailRowClass,
  fieldInputClass,
  fieldLabelClass,
  fieldSelectClass,
  fieldTextareaClass,
  lineItemCardClass,
  outlineTealBtnClass,
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export default function AddQuotationPage() {
  const router = useRouter()
  const user = getStoredUser()
  const canCreate = isStaffOrAdmin(user)
  const [products, setProducts] = useState<ProductItem[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerId, setCustomerId] = useState('')
  const [notes, setNotes] = useState('')
  const [expiresDate, setExpiresDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<LineItem[]>([
    { productId: '', qty: '1', price: '0.00', warehouseId: '' },
  ])

  useEffect(() => {
    if (!canCreate) {
      showToast('Only admin or staff can create quotations', 'error')
      router.replace('/dashboard/quotations')
      return
    }
    void productsApi.list().then(setProducts).catch(console.error)
    void loadWarehouses().then(setWarehouses).catch(console.error)
    void loadCustomers().then(setCustomers).catch(console.error)
  }, [canCreate, router])

  const selectedCustomer = useMemo(
    () => customers.find((customer) => String(customer.id) === customerId) || null,
    [customers, customerId],
  )

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

  const customerAddress = useMemo(() => {
    if (!selectedCustomer) return ''
    return [selectedCustomer.address, selectedCustomer.city, selectedCustomer.postCode]
      .filter(Boolean)
      .join(', ')
  }, [selectedCustomer])

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

  const handleSubmit = async (e: React.FormEvent, sendNow = false) => {
    e.preventDefault()
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
      const created = await quotationsApi.create({
        customerId: Number(customerId),
        notes,
        expiresDate: expiresDate || null,
        status: 'draft',
        items: items.map((item) => ({
          productId: Number(item.productId),
          qty: item.qty,
          price: Number(item.price || 0),
          warehouseId: item.warehouseId ? Number(item.warehouseId) : null,
        })),
      })
      if (sendNow) {
        await quotationsApi.send(created.id)
        showToast('Quotation created and sent to customer', 'success')
      } else {
        showToast('Draft created. Click Send on the list so the customer can accept it.', 'success')
      }
      router.push('/dashboard/quotations')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create quotation'
      showToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!canCreate) return null

  const todayLabel = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <DashboardPage>
      <DashboardBackLink href="/dashboard/quotations">Back to Quotations</DashboardBackLink>

      <form onSubmit={(e) => void handleSubmit(e, false)} className="space-y-6">
        <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
          <div className="relative overflow-hidden border-b border-[#d7e8e4] bg-gradient-to-br from-[#0b1722] via-[#14302b] to-[#1f4f47] px-6 py-7 text-white sm:px-8">
            <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/5" />
            <div className="pointer-events-none absolute bottom-0 right-24 h-28 w-28 rounded-full bg-[#3d8a7c]/20" />

            <div className="relative">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold tracking-wide text-white/90">
                  New quotation
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  Draft
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Create quotation
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/70">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {todayLabel}
                </span>
                {selectedCustomer ? (
                  <>
                    <span className="hidden text-white/30 sm:inline">·</span>
                    <span className="inline-flex items-center gap-1.5">
                      <UserRound className="h-3.5 w-3.5" />
                      {selectedCustomer.name}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="hidden text-white/30 sm:inline">·</span>
                    <span>Select a customer to continue</span>
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
                    Customer & summary
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

                  {selectedCustomer ? (
                    <div className="rounded-2xl border border-[#d7e8e4] bg-[#f8fbfa] p-4">
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2d6a5f] text-sm font-bold text-white">
                          {initials(selectedCustomer.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {selectedCustomer.name}
                          </p>
                          <p className="text-xs font-medium text-[#2d6a5f]">Customer profile</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <DetailIconRow
                          icon={Mail}
                          label="Email"
                          value={selectedCustomer.email || '—'}
                        />
                        <DetailIconRow
                          icon={Phone}
                          label="Phone"
                          value={selectedCustomer.phone || '—'}
                        />
                        <DetailIconRow
                          icon={MapPin}
                          label="Address"
                          value={customerAddress || '—'}
                        />
                        <DetailIconRow
                          icon={Building2}
                          label="City / Postcode"
                          value={
                            [selectedCustomer.city, selectedCustomer.postCode]
                              .filter(Boolean)
                              .join(' · ') || '—'
                          }
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#d7e8e4] bg-[#f8fbfa] px-4 py-6 text-center">
                      <UserRound className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-2 text-sm font-semibold text-slate-600">No customer selected</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Choose a customer to fill contact and address details here.
                      </p>
                    </div>
                  )}

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
                      Status
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">Draft</p>
                  </div>

                  <div className={detailRowClass}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Line items
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {items.filter((item) => item.productId).length} product
                      {items.filter((item) => item.productId).length === 1 ? '' : 's'} · qty {totalQty || 0}
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
                  className={`${outlineTealBtnClass} w-full justify-center disabled:opacity-60`}
                >
                  {saving ? 'Saving…' : 'Save draft'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={(e) => void handleSubmit(e, true)}
                  className={`${panelCtaClass} w-full justify-center disabled:opacity-60`}
                >
                  {saving ? 'Saving…' : 'Create & send'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/quotations')}
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

function DetailIconRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail
  label: string
  value: string
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#2d6a5f] shadow-sm">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="mt-0.5 break-words text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  )
}
