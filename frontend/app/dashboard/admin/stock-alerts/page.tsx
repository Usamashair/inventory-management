'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Building2,
  Eye,
  FilterX,
  Package,
  PackageX,
  Pencil,
  RefreshCcw,
  Search,
} from 'lucide-react'
import TableLoader from '@/components/table-loader'
import {
  DashboardFilters,
  DashboardHero,
  DashboardPage,
  DashboardPanel,
  heroCtaClass,
  tableHeadCellClass,
  tableHeadRow,
  tableRowClass,
} from '@/components/dashboard-page'
import { ProductItem, productsApi } from '@/lib/resources'
import { loadWarehouses } from '@/lib/portal-data'
import type { Warehouse } from '@/lib/portal-data'
import { getStoredUser, isStaffOrAdmin, roleLabel } from '@/lib/auth'
import { showToast } from '@/lib/toast'

function parseQty(value: string | undefined): number {
  const n = Number.parseFloat(String(value || '0').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function isAlertStatus(status: string) {
  return status === 'low-stock' || status === 'out-of-stock'
}

function statusClass(status: string) {
  switch (status) {
    case 'low-stock':
      return 'bg-amber-50 text-amber-800'
    case 'out-of-stock':
      return 'bg-red-50 text-red-700'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

function severityRank(status: string) {
  if (status === 'out-of-stock') return 0
  if (status === 'low-stock') return 1
  return 2
}

export default function StockAlertsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<ProductItem[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'low-stock' | 'out-of-stock'>('all')
  const [warehouseFilter, setWarehouseFilter] = useState('all')

  const load = async () => {
    setLoading(true)
    try {
      const [productList, warehouseList] = await Promise.all([
        productsApi.list(),
        loadWarehouses(),
      ])
      setProducts(productList)
      setWarehouses(warehouseList)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load stock alerts', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isStaffOrAdmin(getStoredUser())) {
      router.replace('/dashboard')
      return
    }
    void load()
  }, [router])

  const alertProducts = useMemo(() => {
    return products
      .filter((item) => isAlertStatus(item.status))
      .sort((a, b) => {
        const byStatus = severityRank(a.status) - severityRank(b.status)
        if (byStatus !== 0) return byStatus
        return parseQty(a.quantity || a.available) - parseQty(b.quantity || b.available)
      })
  }, [products])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return alertProducts.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (warehouseFilter !== 'all' && String(item.warehouseId || '') !== warehouseFilter) {
        return false
      }
      if (!q) return true
      const haystack = [item.sku, item.product, item.warehouse, item.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [alertProducts, query, statusFilter, warehouseFilter])

  const outOfStock = alertProducts.filter((item) => item.status === 'out-of-stock').length
  const lowStock = alertProducts.filter((item) => item.status === 'low-stock').length
  const warehousesAffected = useMemo(() => {
    const ids = new Set(
      alertProducts
        .map((item) => String(item.warehouseId || item.warehouse || '').trim())
        .filter(Boolean),
    )
    return ids.size
  }, [alertProducts])
  const hasActiveFilters =
    query.trim() !== '' || statusFilter !== 'all' || warehouseFilter !== 'all'

  const clearFilters = () => {
    setQuery('')
    setStatusFilter('all')
    setWarehouseFilter('all')
  }

  const warehouseName = (item: ProductItem) =>
    warehouses.find((w) => Number(w.id) === Number(item.warehouseId))?.name ||
    item.warehouse ||
    '—'

  const heroSecondaryClass =
    'inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/15'

  const stats = [
    {
      label: 'Alerting SKUs',
      value: String(alertProducts.length),
      hint: alertProducts.length ? 'Needs attention' : 'All clear',
      icon: AlertTriangle,
      warn: alertProducts.length > 0,
    },
    {
      label: 'Out of stock',
      value: String(outOfStock),
      hint: outOfStock ? 'Zero quantity' : 'None',
      icon: PackageX,
      warn: outOfStock > 0,
    },
    {
      label: 'Low stock',
      value: String(lowStock),
      hint: lowStock ? 'At or below threshold' : 'None',
      icon: Package,
      warn: lowStock > 0,
    },
    {
      label: 'Warehouses affected',
      value: String(warehousesAffected),
      hint: warehousesAffected ? 'Locations with alerts' : 'None',
      icon: Building2,
      warn: warehousesAffected > 0,
    },
  ]

  return (
    <DashboardPage maxWidth="full">
      <DashboardHero
        eyebrow={roleLabel(getStoredUser())}
        title="Stock alerts"
        description="All catalog products currently marked low stock or out of stock."
        actions={
          <>
            <button type="button" onClick={() => void load()} className={heroSecondaryClass}>
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link href="/dashboard/admin/inventory" className={heroCtaClass}>
              <Package className="h-4 w-4" />
              Manage all stock
            </Link>
          </>
        }
        stats={stats}
      />

      <DashboardFilters>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Filters</p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-[#f8fbfa]"
            >
              <FilterX className="h-3.5 w-3.5" />
              Clear all
            </button>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="flex items-center rounded-xl border border-[#d7e8e4] bg-[#f8fbfa] px-3 md:col-span-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search SKU, product, warehouse…"
              className="h-11 w-full bg-transparent px-3 text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'all' | 'low-stock' | 'out-of-stock')
            }
            className="h-11 rounded-xl border border-[#d7e8e4] bg-white px-3 text-sm font-semibold text-slate-700"
          >
            <option value="all">All alert types</option>
            <option value="out-of-stock">Out of stock</option>
            <option value="low-stock">Low stock</option>
          </select>

          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="h-11 rounded-xl border border-[#d7e8e4] bg-white px-3 text-sm font-semibold text-slate-700"
          >
            <option value="all">All warehouses</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={String(warehouse.id)}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </div>
      </DashboardFilters>

      <DashboardPanel
        title="Products needing attention"
        description={
          loading
            ? 'Loading…'
            : `Showing ${filtered.length} of ${alertProducts.length} alert${alertProducts.length === 1 ? '' : 's'}`
        }
        noPadding
        footer={
          !loading
            ? `${outOfStock} out of stock · ${lowStock} low stock`
            : undefined
        }
      >
        <div className="rx-scroll max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[920px] text-left">
            <thead className="sticky top-0 z-10">
              <tr className={tableHeadRow}>
                <th className={tableHeadCellClass}>SKU</th>
                <th className={tableHeadCellClass}>Product</th>
                <th className={tableHeadCellClass}>Warehouse</th>
                <th className={tableHeadCellClass}>Qty</th>
                <th className={tableHeadCellClass}>Low stock</th>
                <th className={tableHeadCellClass}>Status</th>
                <th className={`${tableHeadCellClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoader colSpan={7} />
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className={tableRowClass}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-bold text-slate-900">
                      {item.sku}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <p className="font-semibold text-slate-800">{item.product}</p>
                      {item.notes ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{item.notes}</p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {warehouseName(item)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-bold tabular-nums text-[#2d6a5f]">
                      {item.quantity || item.available || '0'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm tabular-nums text-slate-600">
                      {item.threshold || '0'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusClass(item.status)}`}
                      >
                        {item.status.replace(/-/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/dashboard/inventory/${item.id}/edit`}
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/dashboard/inventory/${item.id}`}
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                    <Package className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    {hasActiveFilters
                      ? 'No alert products match these filters.'
                      : 'No stock alerts right now. All products are above their thresholds.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DashboardPanel>
    </DashboardPage>
  )
}
