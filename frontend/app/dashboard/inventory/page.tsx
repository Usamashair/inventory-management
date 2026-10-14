'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Trash2,
  Edit,
  Eye,
  Plus,
  AlertTriangle,
  FilterX,
  Search,
  Package,
  BadgeCheck,
  XCircle,
} from 'lucide-react'
import ConfirmDialog from '@/components/confirm-dialog'
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
  type DashboardStat,
} from '@/components/dashboard-page'
import { ProductItem, productsApi } from '@/lib/resources'
import { loadWarehouses } from '@/lib/portal-data'
import type { Warehouse } from '@/lib/portal-data'
import { getStoredUser, isStaffOrAdmin } from '@/lib/auth'
import { showToast } from '@/lib/toast'

function warehouseName(item: ProductItem, list: Warehouse[]) {
  if (item.warehouseId != null) {
    const match = list.find((w) => Number(w.id) === Number(item.warehouseId))
    if (match?.name) return match.name
  }
  return item.warehouse || ''
}

export default function InventoryPage() {
  const router = useRouter()
  const [inventory, setInventory] = useState<ProductItem[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<ProductItem | null>(null)

  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [warehouseFilter, setWarehouseFilter] = useState('all')

  useEffect(() => {
    if (!isStaffOrAdmin(getStoredUser())) {
      router.replace('/dashboard')
      return
    }

    let active = true
    void Promise.all([productsApi.list(), loadWarehouses()])
      .then(([products, warehouseList]) => {
        if (!active) return
        setInventory(products)
        setWarehouses(warehouseList)
      })
      .catch((err) => {
        if (active) {
          const message = err instanceof Error ? err.message : 'Failed to load inventory'
          showToast(message, 'error')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [router])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return inventory.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (warehouseFilter !== 'all') {
        const selectedId = Number(warehouseFilter)
        if (item.warehouseId != null) {
          if (Number(item.warehouseId) !== selectedId) return false
        } else {
          const selected = warehouses.find((w) => w.id === selectedId)
          if (!selected || warehouseName(item, warehouses) !== selected.name) return false
        }
      }
      if (!q) return true
      const haystack = [item.sku, item.product, warehouseName(item, warehouses), item.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [inventory, search, statusFilter, warehouseFilter, warehouses])

  const hasActiveFilters =
    search !== '' ||
    statusFilter !== 'all' ||
    warehouseFilter !== 'all'

  const clearFilters = () => {
    setSearch('')
    setSearchInput('')
    setStatusFilter('all')
    setWarehouseFilter('all')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in-stock':
        return 'bg-green-100 text-green-800'
      case 'low-stock':
        return 'bg-yellow-100 text-yellow-800'
      case 'out-of-stock':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleDelete = async () => {
    if (!itemToDelete) return
    setDeleting(true)

    try {
      await productsApi.remove(itemToDelete.id)
      setInventory((current) => current.filter((i) => i.id !== itemToDelete.id))
      setItemToDelete(null)
      showToast('Inventory item deleted successfully', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete inventory item'
      showToast(message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const totalSkus = inventory.length
  const inStock = inventory.filter((i) => i.status === 'in-stock').length
  const lowStock = inventory.filter((i) => i.status === 'low-stock').length
  const outOfStock = inventory.filter((i) => i.status === 'out-of-stock').length
  const alertCount = lowStock + outOfStock

  const stats: DashboardStat[] = [
    {
      label: 'Total SKUs',
      value: String(totalSkus),
      hint: 'Across all warehouses',
      icon: Package,
    },
    {
      label: 'In stock',
      value: String(inStock),
      hint: 'Healthy levels',
      icon: BadgeCheck,
    },
    {
      label: 'Low stock',
      value: String(lowStock),
      hint: lowStock > 0 ? 'Reorder soon' : 'All clear',
      icon: AlertTriangle,
      warn: lowStock > 0,
    },
    {
      label: 'Out of stock',
      value: String(outOfStock),
      hint: outOfStock > 0 ? 'Action needed' : 'All clear',
      icon: XCircle,
      warn: outOfStock > 0,
    },
  ]

  return (
    <DashboardPage>
      <DashboardHero
        eyebrow="Inventory"
        title="Inventory management"
        description="Product catalog for quotations. Catalog qty drops when orders are delivered."
        actions={
          <Link href="/dashboard/inventory/add" className={heroCtaClass}>
            <Plus className="h-4 w-4" />
            Add Item
          </Link>
        }
        stats={stats}
      />

      {alertCount > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-900">Low Stock Alert</p>
            <p className="text-sm text-amber-800">
              {alertCount} item{alertCount === 1 ? '' : 's'} have stock levels below your configured thresholds. Review
              and reorder as needed.
            </p>
          </div>
        </div>
      )}

      <DashboardFilters>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Search
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setSearch(searchInput.trim())
                }}
                onBlur={() => setSearch(searchInput.trim())}
                placeholder="SKU, product, warehouse…"
                className="w-full rounded-lg border border-[#d7e8e4] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#2d6a5f]"
              />
            </div>
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Status
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-[#d7e8e4] bg-white px-3 py-2 text-sm outline-none focus:border-[#2d6a5f]"
            >
              <option value="all">All statuses</option>
              <option value="in-stock">In stock</option>
              <option value="low-stock">Low stock</option>
              <option value="out-of-stock">Out of stock</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Warehouse
            </span>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="w-full rounded-lg border border-[#d7e8e4] bg-white px-3 py-2 text-sm outline-none focus:border-[#2d6a5f]"
            >
              <option value="all">All warehouses</option>
              {warehouses
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((warehouse) => (
                  <option key={warehouse.id} value={String(warehouse.id)}>
                    {warehouse.name}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="inline-flex items-center gap-2 rounded-lg border border-[#d7e8e4] bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-[#f8fbfa] disabled:opacity-40"
          >
            <FilterX className="h-4 w-4" />
            Clear all
          </button>
        </div>
      </DashboardFilters>

      <DashboardPanel
        title="Catalog"
        description={
          loading
            ? 'Loading…'
            : `${filtered.length} of ${inventory.length} item${inventory.length === 1 ? '' : 's'}`
        }
        noPadding
        footer={`Showing ${filtered.length} of ${inventory.length} item${inventory.length === 1 ? '' : 's'}`}
      >
        <div className="rx-scroll max-h-[32rem] overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className={tableHeadRow}>
                <th className={tableHeadCellClass}>SKU</th>
                <th className={tableHeadCellClass}>Product</th>
                <th className={tableHeadCellClass}>Price</th>
                <th className={tableHeadCellClass}>Catalog qty</th>
                <th className={tableHeadCellClass}>Low stock</th>
                <th className={tableHeadCellClass}>Warehouse</th>
                <th className={tableHeadCellClass}>Status</th>
                <th className={tableHeadCellClass}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoader colSpan={8} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                    No inventory items match these filters.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className={tableRowClass}>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{item.sku}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{item.product}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">${item.price || '0.00'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {item.quantity || item.available || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm tabular-nums text-slate-600">
                      {item.threshold || '0'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {warehouseName(item, warehouses) || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(item.status)}`}
                      >
                        {item.status.replace('-', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/inventory/${item.id}`}
                          className="rounded-lg p-2 text-slate-600 transition hover:bg-[#e8f3f1] hover:text-[#2d6a5f]"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/dashboard/inventory/${item.id}/edit`}
                          className="rounded-lg p-2 text-slate-600 transition hover:bg-[#e8f3f1] hover:text-[#2d6a5f]"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setItemToDelete(item)}
                          className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DashboardPanel>

      <ConfirmDialog
        open={Boolean(itemToDelete)}
        title="Delete Inventory Item"
        message={`Are you sure you want to delete ${itemToDelete?.sku || 'this item'}? This action cannot be undone.`}
        confirmLabel="Delete Item"
        loading={deleting}
        onCancel={() => setItemToDelete(null)}
        onConfirm={handleDelete}
      />
    </DashboardPage>
  )
}
