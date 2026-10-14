'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Package, Save } from 'lucide-react'
import { loadWarehouses } from '@/lib/portal-data'
import type { Warehouse } from '@/lib/portal-data'
import { ProductItem, productsApi } from '@/lib/resources'
import { getStoredUser, isStaffOrAdmin } from '@/lib/auth'
import { showToast } from '@/lib/toast'
import {
  DashboardBackLink,
  DashboardLoading,
  DashboardPage,
  detailRowClass,
  fieldHintClass,
  fieldInputClass,
  fieldLabelClass,
  fieldSelectClass,
  fieldTextareaClass,
  panelCtaClass,
  secondaryBtnClass,
  totalBannerClass,
} from '@/components/dashboard-page'

function parseQty(value: string | undefined): number {
  const n = Number.parseFloat(String(value || '0').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function statusFromQty(qty: number, threshold: number): ProductItem['status'] {
  if (qty <= 0) return 'out-of-stock'
  if (threshold > 0 && qty <= threshold) return 'low-stock'
  return 'in-stock'
}

function statusStyles(status: string) {
  switch (status) {
    case 'in-stock':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200'
    case 'low-stock':
      return 'bg-amber-50 text-amber-900 border-amber-200'
    case 'out-of-stock':
      return 'bg-red-50 text-red-700 border-red-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

export default function EditInventoryPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id ? String(params.id) : ''
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    sku: '',
    product: '',
    price: '0.00',
    quantity: '',
    warehouseId: '',
    threshold: '',
    notes: '',
  })

  useEffect(() => {
    if (!isStaffOrAdmin(getStoredUser())) {
      router.replace('/dashboard')
      return
    }
    if (!id || id === 'undefined') return

    setLoading(true)
    void Promise.all([productsApi.get(id), loadWarehouses()])
      .then(([product, availableWarehouses]) => {
        setWarehouses(availableWarehouses)

        const matchedWarehouse =
          availableWarehouses.find((w) => String(w.id) === String(product.warehouseId || '')) ||
          availableWarehouses.find((w) => w.name === product.warehouse)

        setFormData({
          sku: product.sku || '',
          product: product.product || '',
          price: product.price || '0.00',
          quantity: product.quantity || product.available || '',
          warehouseId: matchedWarehouse
            ? String(matchedWarehouse.id)
            : product.warehouseId
              ? String(product.warehouseId)
              : availableWarehouses[0]
                ? String(availableWarehouses[0].id)
                : '',
          threshold: product.threshold || '0',
          notes: product.notes || '',
        })
      })
      .catch((error) => {
        showToast(error instanceof Error ? error.message : 'Failed to load item', 'error')
        router.replace('/dashboard/inventory')
      })
      .finally(() => setLoading(false))
  }, [id, router])

  const selectedWarehouse = useMemo(
    () => warehouses.find((w) => String(w.id) === formData.warehouseId) || null,
    [warehouses, formData.warehouseId],
  )

  const previewStatus = useMemo(
    () => statusFromQty(parseQty(formData.quantity), parseQty(formData.threshold)),
    [formData.quantity, formData.threshold],
  )

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || id === 'undefined') return

    setSaving(true)
    try {
      const warehouseId = formData.warehouseId ? Number(formData.warehouseId) : null
      const selectedWarehouseName = warehouses.find((w) => w.id === warehouseId)
      const qty = parseQty(formData.quantity)
      const threshold = parseQty(formData.threshold)
      const status = statusFromQty(qty, threshold)

      await productsApi.update(id, {
        sku: formData.sku,
        product: formData.product,
        price: formData.price || '0.00',
        quantity: String(qty),
        available: String(qty),
        threshold: String(threshold),
        notes: formData.notes,
        warehouseId,
        warehouse: selectedWarehouseName?.name,
        status,
      })
      showToast('Inventory item updated successfully', 'success')
      router.push('/dashboard/inventory')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update inventory item'
      showToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <DashboardLoading message="Loading inventory item…" />
  }

  return (
    <DashboardPage>
      <DashboardBackLink href="/dashboard/inventory">Back to Inventory</DashboardBackLink>

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-6">
        <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
          <div className="relative overflow-hidden border-b border-[#d7e8e4] bg-gradient-to-br from-[#0b1722] via-[#14302b] to-[#1f4f47] px-6 py-7 text-white sm:px-8">
            <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/5" />
            <div className="pointer-events-none absolute bottom-0 right-24 h-28 w-28 rounded-full bg-[#3d8a7c]/20" />

            <div className="relative">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold tracking-wide text-white/90">
                  Edit inventory
                </span>
                {formData.sku ? (
                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 font-mono text-xs font-bold tracking-wide text-white/90">
                    {formData.sku}
                  </span>
                ) : null}
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold capitalize ${statusStyles(previewStatus)}`}
                >
                  {previewStatus.replace(/-/g, ' ')}
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {formData.product || 'Edit inventory item'}
              </h1>
              <p className="mt-2 text-sm text-white/70">
                Update product, stock levels, warehouse, and low-stock threshold.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3 sm:p-8">
            <Metric label="Quantity" value={formData.quantity || '0'} />
            <Metric label="Low stock" value={formData.threshold || '0'} />
            <Metric
              label="Unit price"
              value={`$${Number.parseFloat(formData.price || '0').toFixed(2)}`}
              highlight
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
              <div className="border-b border-[#e2eeeb] px-6 py-5">
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">
                  <Package className="h-4 w-4" />
                  Product info
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  SKU and product name for catalog identification.
                </p>
              </div>
              <div className="space-y-6 p-6 sm:p-8">
                <div>
                  <label className={fieldLabelClass}>SKU</label>
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    disabled
                    className={fieldInputClass}
                  />
                  <p className={fieldHintClass}>SKU cannot be changed after creation.</p>
                </div>

                <div>
                  <label className={fieldLabelClass}>Product name</label>
                  <input
                    type="text"
                    name="product"
                    value={formData.product}
                    onChange={handleChange}
                    placeholder="e.g., Eco-Corrugated Mailer (Small)"
                    required
                    className={fieldInputClass}
                  />
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
              <div className="border-b border-[#e2eeeb] px-6 py-5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">
                  Stock levels
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Quantity and alert threshold for this catalog item.
                </p>
              </div>
              <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
                <div>
                  <label className={fieldLabelClass}>Total quantity</label>
                  <input
                    type="text"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleChange}
                    required
                    className={fieldInputClass}
                  />
                </div>
                <div>
                  <label className={fieldLabelClass}>Low stock threshold</label>
                  <input
                    type="text"
                    name="threshold"
                    value={formData.threshold}
                    onChange={handleChange}
                    className={fieldInputClass}
                  />
                  <p className={fieldHintClass}>
                    Alert when quantity drops to this level or below.
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
              <div className="border-b border-[#e2eeeb] px-6 py-5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">Notes</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Optional information about this inventory item.
                </p>
              </div>
              <div className="p-6 sm:p-8">
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Any additional information about this inventory item…"
                  rows={5}
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
                    Stock & details
                  </h3>
                </div>
                <div className="space-y-4 p-6">
                  <div>
                    <label className={fieldLabelClass}>Price</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name="price"
                        value={formData.price}
                        onChange={handleChange}
                        required
                        className={`${fieldInputClass} pl-8`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={fieldLabelClass}>Warehouse</label>
                    <select
                      name="warehouseId"
                      value={formData.warehouseId}
                      onChange={handleChange}
                      required
                      className={fieldSelectClass}
                    >
                      {warehouses.length === 0 && <option value="">No warehouses available</option>}
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={String(warehouse.id)}>
                          {warehouse.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={detailRowClass}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Warehouse
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {selectedWarehouse?.name || '—'}
                    </p>
                  </div>

                  <div className={detailRowClass}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Status preview
                    </p>
                    <span
                      className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusStyles(previewStatus)}`}
                    >
                      {previewStatus.replace(/-/g, ' ')}
                    </span>
                  </div>

                  <div className={totalBannerClass}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                      Unit price
                    </p>
                    <p className="mt-1 text-2xl font-bold tracking-tight">
                      ${Number.parseFloat(formData.price || '0').toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className={`${panelCtaClass} w-full justify-center disabled:opacity-60`}
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/inventory')}
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
      <p
        className={`mt-2 font-bold tracking-tight text-slate-900 ${highlight ? 'text-2xl' : 'text-lg'}`}
      >
        {value}
      </p>
    </div>
  )
}
