'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, FilterX, Package, Plus, RefreshCcw, Search, AlertTriangle, Boxes } from 'lucide-react'
import TableLoader from '@/components/table-loader'
import {
  DashboardFilters,
  DashboardHero,
  DashboardPage,
  DashboardPanel,
  tableHeadCellClass,
  tableHeadRow,
  tableRowClass,
} from '@/components/dashboard-page'
import {
  OrderItem,
  ProductItem,
  WarehouseStockItem,
  ordersApi,
  productsApi,
  warehouseStockApi,
} from '@/lib/resources'
import { loadCustomers, loadWarehouses } from '@/lib/portal-data'
import type { Customer, Warehouse } from '@/lib/portal-data'
import { getStoredUser, isStaffOrAdmin, roleLabel } from '@/lib/auth'
import { showToast } from '@/lib/toast'

function parseQty(value: string | undefined): number {
  const n = Number.parseFloat(String(value || '0').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function statusFromQty(qty: number, threshold: number): ProductItem['status'] {
  if (qty <= 0) return 'out-of-stock'
  if (threshold > 0 && qty <= threshold) return 'low-stock'
  return 'in-stock'
}

export default function AdminInventoryPage() {
  const router = useRouter()
  const [products, setProducts] = useState<ProductItem[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [warehouseStocks, setWarehouseStocks] = useState<WarehouseStockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [warehouseFilter, setWarehouseFilter] = useState('all')
  const [productFilter, setProductFilter] = useState('all')
  const [customerFilter, setCustomerFilter] = useState('all')
  const [orderFilter, setOrderFilter] = useState('all')

  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null)
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustMode, setAdjustMode] = useState<'add' | 'set'>('add')

  const load = async () => {
    setLoading(true)
    try {
      const [productList, warehouseList, customerList, orderList, stockList] = await Promise.all([
        productsApi.list(),
        loadWarehouses(),
        loadCustomers(),
        ordersApi.list(),
        warehouseStockApi.all(),
      ])
      setProducts(productList)
      setWarehouses(warehouseList)
      setCustomers(customerList)
      setOrders(orderList)
      setWarehouseStocks(stockList)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load company stock', 'error')
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

  const productOptions = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.product).filter(Boolean))).sort()
  }, [products])

  const warehouseOptions = useMemo(() => {
    return [...warehouses].sort((a, b) => a.name.localeCompare(b.name))
  }, [warehouses])

  const orderOptions = useMemo(() => {
    return [...orders]
      .map((o) => ({ id: o.id, label: o.orderId || `#${o.id}` }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [orders])

  const productIdsByOrder = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const order of orders) {
      const ids = new Set<string>()
      for (const item of order.items || []) {
        if (item.productId != null) ids.add(String(item.productId))
      }
      map.set(order.id, ids)
    }
    return map
  }, [orders])

  const productIdsByCustomer = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const stock of warehouseStocks) {
      const key = String(stock.customerId)
      if (!map.has(key)) map.set(key, new Set())
      map.get(key)!.add(String(stock.productId))
    }
    for (const order of orders) {
      if (!order.customerId) continue
      const key = String(order.customerId)
      if (!map.has(key)) map.set(key, new Set())
      for (const item of order.items || []) {
        if (item.productId != null) map.get(key)!.add(String(item.productId))
      }
    }
    return map
  }, [warehouseStocks, orders])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const orderProductIds = orderFilter !== 'all' ? productIdsByOrder.get(orderFilter) ?? new Set<string>() : null
    const customerProductIds =
      customerFilter !== 'all' ? productIdsByCustomer.get(customerFilter) ?? new Set<string>() : null

    return products.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (warehouseFilter !== 'all') {
        const selectedId = Number(warehouseFilter)
        if (item.warehouseId != null) {
          if (Number(item.warehouseId) !== selectedId) return false
        } else {
          const selected = warehouses.find((w) => w.id === selectedId)
          if (!selected || item.warehouse !== selected.name) return false
        }
      }
      if (productFilter !== 'all' && item.product !== productFilter) return false

      if (orderProductIds && !orderProductIds.has(String(item.id))) return false
      if (customerProductIds && !customerProductIds.has(String(item.id))) return false

      if (!q) return true
      return [item.sku, item.product, item.warehouse, item.quantity, item.available, item.status, item.notes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    })
  }, [
    products,
    warehouses,
    query,
    statusFilter,
    warehouseFilter,
    productFilter,
    customerFilter,
    orderFilter,
    productIdsByOrder,
    productIdsByCustomer,
  ])

  const hasActiveFilters =
    query.trim() !== '' ||
    statusFilter !== 'all' ||
    warehouseFilter !== 'all' ||
    productFilter !== 'all' ||
    customerFilter !== 'all' ||
    orderFilter !== 'all'

  const clearFilters = () => {
    setQuery('')
    setStatusFilter('all')
    setWarehouseFilter('all')
    setProductFilter('all')
    setCustomerFilter('all')
    setOrderFilter('all')
  }

  const totalQty = filtered.reduce((sum, item) => sum + parseQty(item.quantity || item.available), 0)
  const lowStock = filtered.filter((item) => item.status === 'low-stock' || item.status === 'out-of-stock').length
  const inStock = filtered.filter((item) => item.status === 'in-stock').length

  const openAdjustModal = (item: ProductItem) => {
    setEditingProduct(item)
    setAdjustQty('')
    setAdjustMode('add')
    setShowAdjustModal(true)
  }

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct) return

    const delta = parseQty(adjustQty)
    if (adjustMode === 'add' && delta <= 0) {
      showToast('Enter a quantity greater than 0 to add', 'error')
      return
    }
    if (adjustMode === 'set' && delta < 0) {
      showToast('Quantity cannot be negative', 'error')
      return
    }

    const currentQty = parseQty(editingProduct.quantity || editingProduct.available)
    const nextQty = adjustMode === 'add' ? currentQty + delta : delta
    const threshold = parseQty(editingProduct.threshold)
    const status = statusFromQty(nextQty, threshold)

    setSaving(true)
    try {
      const updated = await productsApi.update(editingProduct.id, {
        sku: editingProduct.sku,
        product: editingProduct.product,
        price: editingProduct.price || '0.00',
        quantity: String(nextQty),
        available: String(nextQty),
        warehouseId: editingProduct.warehouseId ?? null,
        warehouse: editingProduct.warehouse || undefined,
        threshold: editingProduct.threshold || '0',
        notes: editingProduct.notes || undefined,
        status,
      })
      setProducts((current) => current.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
      showToast(adjustMode === 'add' ? `Added ${delta} to stock` : 'Stock quantity updated', 'success')
      setShowAdjustModal(false)
      setEditingProduct(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update stock', 'error')
    } finally {
      setSaving(false)
    }
  }

  const statusClass = (status: string) => {
    switch (status) {
      case 'in-stock':
        return 'bg-emerald-50 text-emerald-700'
      case 'low-stock':
        return 'bg-amber-50 text-amber-700'
      case 'out-of-stock':
        return 'bg-red-50 text-red-700'
      default:
        return 'bg-slate-100 text-slate-600'
    }
  }

  const heroSecondaryClass =
    'inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/15'

  const stats = [
    {
      label: 'SKUs',
      value: String(filtered.length),
      hint: `${products.length} total`,
      icon: Package,
    },
    {
      label: 'Total catalog qty',
      value: totalQty.toLocaleString(),
      hint: 'Across filtered rows',
      icon: Boxes,
    },
    {
      label: 'In stock',
      value: String(inStock),
      hint: 'Healthy levels',
      icon: Package,
    },
    {
      label: 'Low / out of stock',
      value: String(lowStock),
      hint: lowStock ? 'Needs attention' : 'All clear',
      icon: AlertTriangle,
      warn: lowStock > 0,
    },
  ]

  return (
    <DashboardPage maxWidth="full">
      <DashboardHero
        eyebrow={roleLabel(getStoredUser())}
        title="Company stock"
        description="View company stock and adjust quantities. Edit product details on the Inventory page."
        actions={
          <>
            <button type="button" onClick={() => void load()} className={heroSecondaryClass}>
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link href="/dashboard/inventory" className={heroSecondaryClass}>
              <Boxes className="h-4 w-4" />
              Manage inventory
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
          <div className="flex items-center rounded-xl border border-[#d7e8e4] bg-[#f8fbfa] px-3 md:col-span-2 xl:col-span-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search SKU, product, notes…"
              className="h-11 w-full bg-transparent px-3 text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="h-11 rounded-xl border border-[#d7e8e4] bg-white px-3 text-sm font-semibold text-slate-700"
          >
            <option value="all">All warehouses</option>
            {warehouseOptions.map((warehouse) => (
              <option key={warehouse.id} value={String(warehouse.id)}>
                {warehouse.name}
              </option>
            ))}
          </select>

          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="h-11 rounded-xl border border-[#d7e8e4] bg-white px-3 text-sm font-semibold text-slate-700"
          >
            <option value="all">All products</option>
            {productOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 rounded-xl border border-[#d7e8e4] bg-white px-3 text-sm font-semibold text-slate-700"
          >
            <option value="all">All statuses</option>
            <option value="in-stock">In stock</option>
            <option value="low-stock">Low stock</option>
            <option value="out-of-stock">Out of stock</option>
          </select>

          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="h-11 rounded-xl border border-[#d7e8e4] bg-white px-3 text-sm font-semibold text-slate-700"
          >
            <option value="all">All customers</option>
            {customers.map((customer) => (
              <option key={customer.id} value={String(customer.id)}>
                {customer.name}
              </option>
            ))}
          </select>

          <select
            value={orderFilter}
            onChange={(e) => setOrderFilter(e.target.value)}
            className="h-11 rounded-xl border border-[#d7e8e4] bg-white px-3 text-sm font-semibold text-slate-700"
          >
            <option value="all">All order numbers</option>
            {orderOptions.map((order) => (
              <option key={order.id} value={order.id}>
                {order.label}
              </option>
            ))}
          </select>
        </div>
      </DashboardFilters>

      <DashboardPanel
        title="Catalog"
        description={
          loading
            ? 'Loading…'
            : `Showing ${filtered.length} of ${products.length} company product${products.length === 1 ? '' : 's'}${hasActiveFilters ? ' (filtered)' : ''}`
        }
        noPadding
        footer={
          <>
            Showing {filtered.length} of {products.length} company product
            {products.length === 1 ? '' : 's'}
            {hasActiveFilters ? ' (filtered)' : ''}
          </>
        }
      >
        <div className="rx-scroll max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead className="sticky top-0 z-10">
              <tr className={tableHeadRow}>
                <th className={tableHeadCellClass}>SKU</th>
                <th className={tableHeadCellClass}>Product</th>
                <th className={tableHeadCellClass}>Warehouse</th>
                <th className={tableHeadCellClass}>Qty</th>
                <th className={tableHeadCellClass}>Low stock</th>
                <th className={tableHeadCellClass}>Status</th>
                <th className={`${tableHeadCellClass} text-center`}>+ Qty</th>
                <th className={`${tableHeadCellClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoader colSpan={8} />
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className={tableRowClass}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-bold text-slate-900">{item.sku}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{item.product}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {warehouses.find((w) => Number(w.id) === Number(item.warehouseId))?.name ||
                        item.warehouse ||
                        '—'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-bold text-[#2d6a5f]">
                      {item.quantity || '0'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm tabular-nums text-slate-600">
                      {item.threshold || '0'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(item.status)}`}>
                        {item.status.replace(/-/g, ' ')}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => openAdjustModal(item)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#e8f3f1] px-2.5 py-1.5 text-xs font-bold text-[#2d6a5f] hover:bg-[#d7ebe5]"
                        title="Add / set quantity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Qty
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1">
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
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                    <Package className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    {hasActiveFilters
                      ? 'No products match the selected filters.'
                      : 'No company stock yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DashboardPanel>

      {showAdjustModal && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleAdjustStock} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Adjust stock</h3>
            <p className="mt-1 text-sm text-slate-500">
              {editingProduct.product} ({editingProduct.sku}) · current qty{' '}
              <strong>{editingProduct.quantity || '0'}</strong>
            </p>

            <div className="mt-5 space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustMode('add')}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${
                    adjustMode === 'add' ? 'bg-[#277f73] text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Add quantity
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustMode('set')}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${
                    adjustMode === 'set' ? 'bg-[#277f73] text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Set quantity
                </button>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">
                  {adjustMode === 'add' ? 'Quantity to add *' : 'New quantity *'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  required
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
                  placeholder={adjustMode === 'add' ? 'e.g. 50' : 'e.g. 100'}
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-[#277f73] py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Update stock'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdjustModal(false)
                  setEditingProduct(null)
                }}
                className="flex-1 rounded-lg border py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </DashboardPage>
  )
}
