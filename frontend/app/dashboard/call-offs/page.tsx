'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import {
  DashboardHero,
  DashboardPage,
  DashboardPanel,
  panelCtaClass,
  tableHeadCellClass,
  tableHeadRow,
  tableRowClass,
} from '@/components/dashboard-page'
import { deliveryRequestsApi, DeliveryRequestItem, warehouseStockApi, WarehouseStockItem } from '@/lib/resources'
import { getStoredUser, isStaffOrAdmin } from '@/lib/auth'
import { showToast } from '@/lib/toast'

type CallOffLine = {
  productId: string
  quantity: string
}

type StockWarehouse = {
  id: string
  name: string
  productCount: number
}

/** Show whole numbers without trailing .00 */
function formatQty(value: string | number | null | undefined): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)))
}

function CallOffsContent() {
  const searchParams = useSearchParams()
  const presetWarehouseId = searchParams.get('warehouseId') || ''
  const user = getStoredUser()
  const staff = isStaffOrAdmin(user)
  const profileAddress = [user?.address, user?.city, user?.postCode].filter(Boolean).join(', ')

  const [requests, setRequests] = useState<DeliveryRequestItem[]>([])
  const [stocks, setStocks] = useState<WarehouseStockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [warehouseId, setWarehouseId] = useState(presetWarehouseId)
  const [deliveryAddress, setDeliveryAddress] = useState(profileAddress)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<CallOffLine[]>([{ productId: '', quantity: '1' }])
  const [busy, setBusy] = useState(false)

  const availableStocks = useMemo(
    () => stocks.filter((s) => Number(s.quantity) > 0),
    [stocks],
  )

  const stockWarehouses = useMemo(() => {
    const map = new Map<string, StockWarehouse>()
    for (const stock of availableStocks) {
      const id = String(stock.warehouseId)
      const current = map.get(id)
      if (current) {
        current.productCount += 1
      } else {
        map.set(id, {
          id,
          name: stock.warehouse || `Warehouse #${id}`,
          productCount: 1,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.productCount - a.productCount)
  }, [availableStocks])

  const reload = async () => {
    setLoading(true)
    try {
      const [reqs, stock] = await Promise.all([
        deliveryRequestsApi.list(),
        warehouseStockApi.myStock(),
      ])
      setRequests(reqs)
      setStocks(stock)

      const withQty = stock.filter((s) => Number(s.quantity) > 0)
      const counts = new Map<string, number>()
      for (const row of withQty) {
        const id = String(row.warehouseId)
        counts.set(id, (counts.get(id) || 0) + 1)
      }
      const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])

      setWarehouseId((current) => {
        if (current && counts.has(current)) return current
        if (presetWarehouseId && counts.has(presetWarehouseId)) return presetWarehouseId
        return ranked[0]?.[0] || ''
      })
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!presetWarehouseId) return
    if (stockWarehouses.some((w) => w.id === presetWarehouseId)) {
      setWarehouseId(presetWarehouseId)
    }
  }, [presetWarehouseId, stockWarehouses])

  const stockForWarehouse = useMemo(
    () => availableStocks.filter((s) => String(s.warehouseId) === warehouseId),
    [availableStocks, warehouseId],
  )

  const selectedProductIds = useMemo(
    () => items.map((item) => item.productId).filter(Boolean),
    [items],
  )

  const stockByProductId = useMemo(() => {
    const map = new Map<string, WarehouseStockItem>()
    for (const stock of stockForWarehouse) {
      map.set(String(stock.productId), stock)
    }
    return map
  }, [stockForWarehouse])

  const updateItem = (index: number, field: keyof CallOffLine, value: string) => {
    if (field === 'productId' && value) {
      const alreadyUsed = items.some((item, i) => i !== index && item.productId === value)
      if (alreadyUsed) {
        showToast('This product is already added to the request', 'error')
        return
      }
    }

    setItems((current) =>
      current.map((item, i) => {
        if (i !== index) return item
        const next = { ...item, [field]: value }
        if (field === 'productId') {
          const stock = stockByProductId.get(value)
          if (stock && (!next.quantity || Number(next.quantity) <= 0)) {
            next.quantity = '1'
          }
        }
        return next
      }),
    )
  }

  const addItem = () => {
    setItems((current) => [...current, { productId: '', quantity: '1' }])
  }

  const removeItem = (index: number) => {
    setItems((current) => {
      if (current.length <= 1) return [{ productId: '', quantity: '1' }]
      return current.filter((_, i) => i !== index)
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const payloadItems = items
      .filter((item) => item.productId && Number(item.quantity) > 0)
      .map((item) => ({
        productId: Number(item.productId),
        quantity: Number(item.quantity),
      }))

    if (!warehouseId || payloadItems.length === 0) {
      showToast('Select a warehouse and add at least one product', 'error')
      return
    }
    if (new Set(payloadItems.map((i) => i.productId)).size !== payloadItems.length) {
      showToast('Each product can only be added once per request', 'error')
      return
    }
    if (!deliveryAddress.trim()) {
      showToast('Enter the address where products should be delivered', 'error')
      return
    }

    for (const item of payloadItems) {
      const stock = stockByProductId.get(String(item.productId))
      const available = Number(stock?.quantity || 0)
      if (!stock || item.quantity > available) {
        showToast(
          `Requested qty for ${stock?.product || `product #${item.productId}`} exceeds available stock (${formatQty(available)})`,
          'error',
        )
        return
      }
    }

    setBusy(true)
    try {
      await deliveryRequestsApi.create({
        warehouseId: Number(warehouseId),
        deliveryAddress: deliveryAddress.trim(),
        notes,
        items: payloadItems,
      })
      showToast('Delivery request submitted — waiting for admin to fulfill', 'success')
      setItems([{ productId: '', quantity: '1' }])
      setNotes('')
      await reload()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Request failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleFulfill = async (id: string) => {
    try {
      await deliveryRequestsApi.fulfill(id)
      showToast('Request fulfilled — stock deducted', 'success')
      await reload()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Fulfill failed', 'error')
    }
  }

  const handleReject = async (id: string) => {
    try {
      await deliveryRequestsApi.reject(id)
      showToast('Request rejected', 'success')
      await reload()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Reject failed', 'error')
    }
  }

  return (
    <DashboardPage maxWidth="full">
      <DashboardHero
        eyebrow="Call-off"
        title="Warehouse delivery requests"
        description="Request one or more products from your warehouse stock. Quantities are deducted when admin/staff fulfills the request."
      />

      {!staff && (
        <DashboardPanel title="New request — deliver to my address">
          <form onSubmit={(e) => void handleSubmit(e)}>
            {!loading && availableStocks.length > 0 && (
              <p className="mb-4 text-sm text-slate-500">
                You have <strong className="text-slate-800">{availableStocks.length}</strong> product
                {availableStocks.length === 1 ? '' : 's'} across{' '}
                <strong className="text-slate-800">{stockWarehouses.length}</strong> warehouse
                {stockWarehouses.length === 1 ? '' : 's'}. Switch warehouse below to see each list.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold">From warehouse</label>
                <select
                  value={warehouseId}
                  onChange={(e) => {
                    setWarehouseId(e.target.value)
                    setItems([{ productId: '', quantity: '1' }])
                  }}
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
                  disabled={stockWarehouses.length === 0}
                >
                  {stockWarehouses.length === 0 ? (
                    <option value="">No warehouse stock</option>
                  ) : (
                    stockWarehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.productCount} product{w.productCount === 1 ? '' : 's'})
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold">Notes</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
                  placeholder="Optional delivery notes"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-semibold">Deliver to address *</label>
                <textarea
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  rows={2}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Street, city, post code"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Pre-filled from your profile. Edit if this delivery should go somewhere else.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Request items</h3>
                  <p className="text-xs text-slate-500">
                    {stockForWarehouse.length > 0
                      ? `${stockForWarehouse.length} product${stockForWarehouse.length === 1 ? '' : 's'} available in this warehouse.`
                      : 'Add multiple products and quantities from your stock in this warehouse.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  disabled={stockForWarehouse.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#e8f3f1] px-3 py-2 text-sm font-semibold text-[#2d6a5f] disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Add Item
                </button>
              </div>

              {stockForWarehouse.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  {loading
                    ? 'Loading stock…'
                    : availableStocks.length > 0
                      ? 'No stock in this warehouse. Choose another warehouse above.'
                      : 'No stock in any warehouse yet. Finish warehouse-delivery orders to delivered first.'}
                </div>
              ) : (
                items.map((item, index) => {
                  const stock = item.productId ? stockByProductId.get(item.productId) : undefined
                  const available = stock ? Number(stock.quantity) : 0

                  return (
                    <div
                      key={index}
                      className="grid grid-cols-12 gap-3 rounded-xl border border-slate-200 bg-[#fafbfb] p-4"
                    >
                      <div className="col-span-12 md:col-span-6">
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Product</label>
                        <select
                          value={item.productId}
                          onChange={(e) => updateItem(index, 'productId', e.target.value)}
                          required
                          className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                        >
                          <option value="">Select product</option>
                          {stockForWarehouse.map((s) => (
                            <option
                              key={s.id}
                              value={String(s.productId)}
                              disabled={
                                selectedProductIds.includes(String(s.productId)) &&
                                item.productId !== String(s.productId)
                              }
                            >
                              {s.product || `Product #${s.productId}`} ({s.sku || '—'}) — avail {formatQty(s.quantity)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-5 md:col-span-2">
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Available</label>
                        <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-[#206e64]">
                          {stock ? formatQty(stock.quantity) : '—'}
                        </div>
                      </div>

                      <div className="col-span-5 md:col-span-3">
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Request qty</label>
                        <input
                          type="number"
                          min={1}
                          max={available || undefined}
                          step={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                          required
                          className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                          placeholder="Qty"
                        />
                      </div>

                      <div className="col-span-2 flex items-end md:col-span-1">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="flex h-11 w-full items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <button
              type="submit"
              disabled={busy || stockForWarehouse.length === 0}
              className={`mt-5 ${panelCtaClass} disabled:opacity-60`}
            >
              {busy ? 'Submitting…' : 'Submit delivery request'}
            </button>
          </form>
        </DashboardPanel>
      )}

      <DashboardPanel title={staff ? 'All requests' : 'My requests'} noPadding>
        <div className="rx-scroll max-h-[32rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className={tableHeadRow}>
                <th className={tableHeadCellClass}>Request</th>
                {staff && <th className={tableHeadCellClass}>Customer</th>}
                <th className={tableHeadCellClass}>Warehouse</th>
                <th className={tableHeadCellClass}>Deliver to</th>
                <th className={tableHeadCellClass}>Items</th>
                <th className={tableHeadCellClass}>Status</th>
                {staff && <th className={tableHeadCellClass}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className={tableRowClass}>
                  <td className="px-6 py-4 font-semibold">{req.requestId}</td>
                  {staff && <td className="px-6 py-4">{req.customer}</td>}
                  <td className="px-6 py-4">{req.warehouse}</td>
                  <td className="px-6 py-4 text-slate-600">{req.deliveryAddress || '—'}</td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {req.items.map((item) => (
                        <p key={item.id}>
                          <span className="font-medium text-slate-800">{item.product}</span>
                          <span className="text-slate-500"> × {formatQty(item.quantity)}</span>
                        </p>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 capitalize">{req.status}</td>
                  {staff && (
                    <td className="px-6 py-4">
                      {req.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => void handleFulfill(req.id)}
                            className="rounded-lg bg-[#2d6a5f] px-3 py-1.5 text-xs font-bold text-white"
                          >
                            Fulfill
                          </button>
                          <button
                            onClick={() => void handleReject(req.id)}
                            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-600"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {!loading && requests.length === 0 && (
                <tr>
                  <td colSpan={staff ? 7 : 5} className="px-6 py-10 text-center text-slate-500">
                    No delivery requests yet.
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

export default function CallOffsPage() {
  return (
    <Suspense
      fallback={
        <DashboardPage maxWidth="full">
          <p className="text-sm text-slate-500">Loading call-offs…</p>
        </DashboardPage>
      }
    >
      <CallOffsContent />
    </Suspense>
  )
}
