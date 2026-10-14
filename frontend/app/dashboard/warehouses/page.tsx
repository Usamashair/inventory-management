'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react'
import ConfirmDialog from '@/components/confirm-dialog'
import {
  DashboardHero,
  DashboardPage,
  DashboardPanel,
  heroCtaClass,
  panelCtaClass,
  tableHeadCellClass,
  tableHeadRow,
  tableRowClass,
} from '@/components/dashboard-page'
import TableLoader from '@/components/table-loader'
import {
  createWarehouse,
  deleteWarehouse,
  loadWarehouses,
  updateWarehouse,
} from '@/lib/portal-data'
import type { Warehouse } from '@/lib/portal-data'
import { ProductItem, WarehouseStockItem, productsApi, warehouseStockApi } from '@/lib/resources'
import { getStoredUser, isStaffOrAdmin } from '@/lib/auth'
import { showToast } from '@/lib/toast'

type StockTab = 'customer' | 'company'

export default function WarehousesPage() {
  const user = getStoredUser()
  const staff = isStaffOrAdmin(user)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [warehouseToDelete, setWarehouseToDelete] = useState<Warehouse | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<StockTab>('company')
  const [stocks, setStocks] = useState<WarehouseStockItem[]>([])
  const [stocksLoading, setStocksLoading] = useState(false)
  const [companyProducts, setCompanyProducts] = useState<ProductItem[]>([])
  const [companyLoading, setCompanyLoading] = useState(false)

  useEffect(() => {
    void loadWarehouses()
      .then((data) => {
        setWarehouses(data)
        if (data[0]) setSelectedId(data[0].id)
      })
      .catch((err) => showToast(err instanceof Error ? err.message : 'Failed to load warehouses', 'error'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setStocks([])
      return
    }
    setStocksLoading(true)
    void warehouseStockApi
      .forWarehouse(selectedId)
      .then(setStocks)
      .catch(console.error)
      .finally(() => setStocksLoading(false))
  }, [selectedId])

  useEffect(() => {
    if (!selectedId || activeTab !== 'company') return
    setCompanyLoading(true)
    void productsApi
      .list()
      .then(setCompanyProducts)
      .catch((err) => showToast(err instanceof Error ? err.message : 'Failed to load company stock', 'error'))
      .finally(() => setCompanyLoading(false))
  }, [selectedId, activeTab])

  const companyInWarehouse = useMemo(() => {
    if (!selectedId) return []
    return companyProducts.filter((product) => Number(product.warehouseId) === Number(selectedId))
  }, [companyProducts, selectedId])

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

  const openCreateModal = () => {
    setEditingWarehouse(null)
    setName('')
    setShowModal(true)
  }

  const openEditModal = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse)
    setName(warehouse.name)
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      if (editingWarehouse) {
        const updated = await updateWarehouse(editingWarehouse.id, name.trim())
        setWarehouses((current) =>
          current.map((warehouse) => (warehouse.id === editingWarehouse.id ? updated : warehouse)),
        )
        showToast('Warehouse updated', 'success')
      } else {
        const created = await createWarehouse(name.trim())
        setWarehouses((current) => [created, ...current])
        showToast('Warehouse created', 'success')
      }
      setShowModal(false)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save warehouse', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!warehouseToDelete) return
    try {
      await deleteWarehouse(warehouseToDelete.id)
      setWarehouses((current) => current.filter((warehouse) => warehouse.id !== warehouseToDelete.id))
      if (selectedId === warehouseToDelete.id) setSelectedId(null)
      setWarehouseToDelete(null)
      showToast('Warehouse deleted', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete warehouse', 'error')
    }
  }

  return (
    <DashboardPage>
      <DashboardHero
        eyebrow="Warehouses"
        title="Warehouse stock"
        description={
          staff
            ? 'View each customer’s products and quantities stored in Rexapack warehouses.'
            : 'See your products stored in Rexapack warehouses.'
        }
        actions={
          staff ? (
            <button type="button" onClick={openCreateModal} className={heroCtaClass}>
              <Plus className="h-4 w-4" /> Add warehouse
            </button>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <DashboardPanel title="Locations" noPadding>
          {loading ? (
            <p className="p-4 text-sm text-slate-500">Loading…</p>
          ) : warehouses.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No warehouses yet.</p>
          ) : (
            <ul>
              {warehouses.map((warehouse) => (
                <li key={warehouse.id} className="border-b border-[#eef3f1] last:border-0">
                  <button
                    type="button"
                    onClick={() => setSelectedId(warehouse.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm ${
                      selectedId === warehouse.id ? 'bg-[#eef7f5] font-bold text-[#206e64]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{warehouse.name}</span>
                    {staff && (
                      <span className="flex gap-1">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditModal(warehouse)
                          }}
                          className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation()
                            setWarehouseToDelete(warehouse)
                          }}
                          className="rounded p-1 text-slate-400 hover:bg-white hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </span>
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>

        <DashboardPanel
          title={warehouses.find((w) => w.id === selectedId)?.name || 'Select a warehouse'}
          actions={
            <Link href="/dashboard/call-offs" className="text-sm font-semibold text-[#2d6a5f] hover:underline">
              Request delivery (call-off)
            </Link>
          }
          noPadding
        >
          <div className="flex gap-1 border-b border-[#e2eeeb] px-4 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('company')}
              className={`rounded-t-lg px-4 py-2.5 text-sm font-bold transition ${
                activeTab === 'company'
                  ? 'border-b-2 border-[#2d6a5f] text-[#206e64]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Company
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('customer')}
              className={`rounded-t-lg px-4 py-2.5 text-sm font-bold transition ${
                activeTab === 'customer'
                  ? 'border-b-2 border-[#2d6a5f] text-[#206e64]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Customer stock
            </button>
          </div>

          {activeTab === 'customer' ? (
            <div className="rx-scroll max-h-[32rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className={tableHeadRow}>
                    {staff && <th className={tableHeadCellClass}>Customer</th>}
                    <th className={tableHeadCellClass}>SKU</th>
                    <th className={tableHeadCellClass}>Product</th>
                    <th className={tableHeadCellClass}>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {stocksLoading && <TableLoader colSpan={staff ? 4 : 3} />}
                  {!stocksLoading &&
                    stocks.map((stock) => (
                      <tr key={stock.id} className={tableRowClass}>
                        {staff && <td className="px-6 py-3 font-medium text-slate-800">{stock.customer}</td>}
                        <td className="px-6 py-3 text-slate-600">{stock.sku || '—'}</td>
                        <td className="px-6 py-3 text-slate-800">{stock.product}</td>
                        <td className="px-6 py-3 font-bold text-[#206e64]">{stock.quantity}</td>
                      </tr>
                    ))}
                  {!stocksLoading && stocks.length === 0 && (
                    <tr>
                      <td colSpan={staff ? 4 : 3} className="px-6 py-10 text-center text-slate-500">
                        <p>No customer stock in this warehouse yet.</p>
                        <p className="mt-2 text-sm">
                          Artwork / in-production does not add stock. For warehouse-delivery orders, advance status to{' '}
                          <strong>In transit → Delivered</strong>; quantity is credited at{' '}
                          <strong>Delivered</strong>.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rx-scroll max-h-[32rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className={tableHeadRow}>
                    <th className={tableHeadCellClass}>SKU</th>
                    <th className={tableHeadCellClass}>Product</th>
                    <th className={tableHeadCellClass}>Qty</th>
                    <th className={tableHeadCellClass}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {companyLoading && <TableLoader colSpan={4} />}
                  {!companyLoading &&
                    companyInWarehouse.map((product) => (
                      <tr key={product.id} className={tableRowClass}>
                        <td className="px-6 py-3 font-medium text-slate-800">{product.sku}</td>
                        <td className="px-6 py-3 text-slate-800">{product.product}</td>
                        <td className="px-6 py-3 font-bold text-[#206e64]">
                          {product.quantity || product.available || '0'}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(product.status)}`}>
                            {product.status.replace(/-/g, ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  {!companyLoading && companyInWarehouse.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-slate-500">
                        <p>No company products assigned to this warehouse.</p>
                        {staff && (
                          <p className="mt-2 text-sm">
                            Assign a warehouse when adding stock under{' '}
                            <Link
                              href="/dashboard/admin/inventory"
                              className="font-semibold text-[#2d6a5f] hover:underline"
                            >
                              Manage all stock
                            </Link>
                            .
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </DashboardPanel>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleSave} className="w-full max-w-md rounded-2xl border border-[#d7e8e4] bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold">{editingWarehouse ? 'Edit warehouse' : 'Add warehouse'}</h3>
            <label htmlFor="warehouse-name" className="mt-4 mb-2 block text-sm font-semibold">
              Name
            </label>
            <input
              id="warehouse-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rotterdam Warehouse"
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              required
            />
            <div className="mt-5 flex gap-2">
              <button type="submit" disabled={saving} className={`flex-1 ${panelCtaClass}`}>
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(warehouseToDelete)}
        title="Delete warehouse"
        message={`Are you sure you want to delete ${warehouseToDelete?.name || 'this warehouse'}?`}
        onConfirm={() => void handleDelete()}
        onCancel={() => setWarehouseToDelete(null)}
      />
    </DashboardPage>
  )
}
