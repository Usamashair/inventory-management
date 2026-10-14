'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  DollarSign,
  Package,
  Pencil,
  Warehouse,
} from 'lucide-react'
import { ProductItem, productsApi } from '@/lib/resources'
import { loadWarehouses } from '@/lib/portal-data'
import { getStoredUser, isStaffOrAdmin } from '@/lib/auth'
import {
  DashboardBackLink,
  DashboardLoading,
  DashboardPage,
  detailRowClass,
  panelCtaClass,
} from '@/components/dashboard-page'

type InventoryView = {
  sku: string
  product: string
  price: string
  totalQuantity: string
  available: string
  reserved: string
  warehouse: string
  statusRaw: string
  status: string
  threshold: string
  notes: string
}

function statusStyles(status: string) {
  switch (status) {
    case 'in-stock':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200'
    case 'low-stock':
      return 'bg-amber-50 text-amber-900 border-amber-200'
    case 'out-of-stock':
      return 'bg-red-50 text-red-800 border-red-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

export default function ViewInventoryPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [loading, setLoading] = useState(true)
  const [item, setItem] = useState<InventoryView | null>(null)

  useEffect(() => {
    if (!isStaffOrAdmin(getStoredUser())) {
      router.replace('/dashboard')
      return
    }
    if (!id) return

    setLoading(true)
    void Promise.all([productsApi.get(String(id)), loadWarehouses()])
      .then(([product, warehouses]: [ProductItem, Awaited<ReturnType<typeof loadWarehouses>>]) => {
        const liveName =
          product.warehouseId != null
            ? warehouses.find((w) => Number(w.id) === Number(product.warehouseId))?.name
            : undefined

        const statusRaw = product.status || 'in-stock'
        setItem({
          sku: product.sku || '',
          product: product.product || '',
          price: product.price || '0.00',
          totalQuantity: product.quantity || '0',
          available: product.available || product.quantity || '0',
          reserved: product.reserved || '0',
          warehouse: liveName || product.warehouse || '',
          statusRaw,
          status: statusRaw.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          threshold: product.threshold || '',
          notes: product.notes || '',
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id, router])

  if (loading || !item) {
    return <DashboardLoading message="Loading product…" />
  }

  const metrics = [
    {
      label: 'Catalog qty',
      value: item.totalQuantity || '—',
      hint: 'Current inventory',
      icon: Boxes,
      accent: 'from-[#1f4f47] to-[#2d6a5f]',
    },
    {
      label: 'Available',
      value: item.available || '—',
      hint: 'Ready to allocate',
      icon: Package,
      accent: 'from-[#245750] to-[#3d8a7c]',
    },
    {
      label: 'Reserved',
      value: item.reserved || '—',
      hint: 'Allocated to orders',
      icon: ClipboardList,
      accent: 'from-[#3d6b63] to-[#5a9a8e]',
    },
  ]

  return (
    <DashboardPage>
      <DashboardBackLink href="/dashboard/inventory">Back to Inventory</DashboardBackLink>

      <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
        <div className="relative overflow-hidden border-b border-[#d7e8e4] bg-gradient-to-br from-[#0b1722] via-[#14302b] to-[#1f4f47] px-6 py-7 text-white sm:px-8">
          <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute bottom-0 right-24 h-28 w-28 rounded-full bg-[#3d8a7c]/20" />

          <div className="relative">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold tracking-wide text-white/90">
                {item.sku || 'No SKU'}
              </span>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-bold ${statusStyles(item.statusRaw)}`}
              >
                {item.status}
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {item.product || 'Product'}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/70">
              <span className="inline-flex items-center gap-1.5">
                <Warehouse className="h-3.5 w-3.5" />
                {item.warehouse || 'No warehouse'}
              </span>
              <span className="hidden text-white/30 sm:inline">·</span>
              <span className="inline-flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                ${item.price || '0.00'}
              </span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3 sm:p-8">
          {metrics.map((metric) => {
            const Icon = metric.icon
            return (
              <div
                key={metric.label}
                className="rounded-2xl border border-[#e2eeeb] bg-[#f8fbfa] p-5"
              >
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {metric.label}
                  </p>
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${metric.accent} text-white shadow-sm`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-3xl font-bold tracking-tight text-slate-900">{metric.value}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">{metric.hint}</p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
            <div className="border-b border-[#e2eeeb] px-6 py-5">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">
                <Package className="h-4 w-4" />
                Product overview
              </h2>
            </div>
            <div className="p-6 sm:p-8">
              <p className="text-lg font-bold text-slate-900">{item.product || 'Product'}</p>
              <p className="mt-2 text-sm text-slate-600">
                SKU <span className="font-semibold text-slate-900">{item.sku || '—'}</span>
                {' · '}
                Unit price{' '}
                <span className="font-semibold text-slate-900">${item.price || '0.00'}</span>
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StockChip label="Catalog qty" value={item.totalQuantity || '—'} />
                <StockChip label="Available" value={item.available || '—'} />
                <StockChip label="Reserved" value={item.reserved || '—'} />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
            <div className="border-b border-[#e2eeeb] px-6 py-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">Notes</h2>
            </div>
            <div className="p-6 sm:p-8">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {item.notes?.trim() || 'No notes added.'}
              </p>
            </div>
          </div>
        </div>

        <div>
          <div className="sticky top-8 space-y-6">
            <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
              <div className="border-b border-[#e2eeeb] bg-gradient-to-r from-[#e8f3f1] to-white px-6 py-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">
                  Product details
                </h3>
              </div>
              <div className="space-y-4 p-6">
                <DetailRow label="SKU" value={item.sku || '—'} />
                <DetailRow label="Warehouse" value={item.warehouse || '—'} />
                <DetailRow label="Price" value={`$${item.price || '0.00'}`} />
                <DetailRow label="Status" value={item.status || '—'} />
                <DetailRow
                  label="Low stock threshold"
                  value={item.threshold || '—'}
                  icon={AlertTriangle}
                />
                <DetailRow label="Catalog qty" value={item.totalQuantity || '—'} />
                <DetailRow label="Available" value={item.available || '—'} />
                <DetailRow label="Reserved" value={item.reserved || '—'} />

                <div className="rounded-xl bg-gradient-to-br from-[#1f4f47] to-[#2d6a5f] px-4 py-4 text-white">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Unit price</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">${item.price || '0.00'}</p>
                </div>
              </div>
            </div>

            <Link href={`/dashboard/inventory/${id}/edit`} className={`${panelCtaClass} w-full justify-center`}>
              <Pencil className="h-4 w-4" />
              Edit item
            </Link>
          </div>
        </div>
      </div>
    </DashboardPage>
  )
}

function StockChip({ label, value }: { label: string; value: string }) {
  return (
    <div className={detailRowClass}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-base font-bold text-slate-900">{value}</p>
    </div>
  )
}

function DetailRow({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon?: typeof AlertTriangle
}) {
  return (
    <div className={detailRowClass}>
      <div className="mb-1 flex items-center gap-1.5">
        {Icon ? <Icon className="h-3.5 w-3.5 text-amber-600" /> : null}
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      </div>
      <p className="font-semibold text-slate-900">{value}</p>
    </div>
  )
}
