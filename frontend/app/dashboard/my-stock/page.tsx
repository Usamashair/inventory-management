'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Boxes, ChevronDown, Package, Truck } from 'lucide-react'
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
import { OrderItem, WarehouseStockItem, ordersApi, warehouseStockApi } from '@/lib/resources'
import { showToast } from '@/lib/toast'

export default function MyStockReportPage() {
  const [stocks, setStocks] = useState<WarehouseStockItem[]>([])
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'warehouse' | 'customer_address'>('all')
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    void Promise.all([warehouseStockApi.myStock(), ordersApi.list()])
      .then(([stock, orderList]) => {
        setStocks(stock)
        setOrders(orderList)
      })
      .catch((error) => showToast(error instanceof Error ? error.message : 'Failed to load report', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const filteredOrders = useMemo(() => {
    if (filter === 'all') return orders
    return orders.filter((order) => order.deliveryType === filter)
  }, [orders, filter])

  const stocksByWarehouse = useMemo(() => {
    const map = new Map<string, WarehouseStockItem[]>()
    for (const stock of stocks) {
      const key = stock.warehouse || `Warehouse #${stock.warehouseId}`
      const list = map.get(key) || []
      list.push(stock)
      map.set(key, list)
    }
    return Array.from(map.entries())
  }, [stocks])

  const totalQty = stocks.reduce((sum, item) => sum + Number(item.quantity || 0), 0)

  const stats = [
    {
      label: 'Warehouses',
      value: loading ? '…' : String(stocksByWarehouse.length),
      hint: 'With your stock',
      icon: Boxes,
    },
    {
      label: 'SKU lines',
      value: loading ? '…' : String(stocks.length),
      hint: 'Across warehouses',
      icon: Package,
    },
    {
      label: 'Total qty',
      value: loading ? '…' : totalQty.toLocaleString(),
      hint: 'Units on hand',
      icon: Package,
    },
    {
      label: 'Orders',
      value: loading ? '…' : String(orders.length),
      hint: 'Delivery history',
      icon: Truck,
    },
  ]

  return (
    <DashboardPage maxWidth="full">
      <DashboardHero
        eyebrow="Customer report"
        title="My warehouse stock"
        description="Products stored in Rexapack warehouses, plus your orders by delivery destination."
        actions={
          <Link href="/dashboard/call-offs" className={heroCtaClass}>
            Request delivery to my address
          </Link>
        }
        stats={stats}
      />

      <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setHelpOpen((open) => !open)}
          aria-expanded={helpOpen}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-sm text-slate-800"
        >
          <span className="font-bold text-[#2d6a5f]">How to request delivery (call-off)</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-[#2d6a5f] transition-transform ${helpOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {helpOpen && (
          <div className="border-t border-[#e2eeeb] bg-[#f8fbfa] px-5 pb-4 pt-3 text-sm text-slate-600">
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Wait until your warehouse-delivery orders are marked <strong>delivered</strong> so stock appears
                above.
              </li>
              <li>
                Click <strong>Request delivery to my address</strong> (or use Call-offs in the sidebar).
              </li>
              <li>Pick the warehouse, enter how many of each product you need, and submit.</li>
              <li>
                Products ship to your profile address. Admin/staff fulfill the request and stock quantity is
                deducted.
              </li>
            </ol>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {loading && (
          <DashboardPanel title="Stock by warehouse" description="Loading…">
            <p className="text-sm text-slate-500">Loading warehouse stock…</p>
          </DashboardPanel>
        )}

        {!loading && stocksByWarehouse.length === 0 && (
          <DashboardPanel title="Stock by warehouse" description="No stock yet">
            <p className="text-sm text-slate-500">
              No warehouse stock yet. Stock appears after orders delivered to a warehouse are completed.
            </p>
          </DashboardPanel>
        )}

        {stocksByWarehouse.map(([warehouse, items]) => (
          <DashboardPanel
            key={warehouse}
            title={warehouse}
            description={`${items.length} product line${items.length === 1 ? '' : 's'}`}
            actions={
              <Link
                href={`/dashboard/call-offs?warehouseId=${items[0]?.warehouseId || ''}`}
                className="text-sm font-bold text-[#2d6a5f] hover:underline"
              >
                Request from this warehouse →
              </Link>
            }
            noPadding
          >
            <div className="rx-scroll max-h-[32rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className={tableHeadRow}>
                    <th className={tableHeadCellClass}>SKU</th>
                    <th className={tableHeadCellClass}>Product</th>
                    <th className={tableHeadCellClass}>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className={tableRowClass}>
                      <td className="px-6 py-4 text-slate-600">{item.sku || '—'}</td>
                      <td className="px-6 py-4 font-semibold text-slate-900">{item.product}</td>
                      <td className="px-6 py-4 font-bold text-[#2d6a5f]">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DashboardPanel>
        ))}
      </div>

      <DashboardFilters>
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-2 text-xs font-bold uppercase tracking-wider text-slate-500">Delivery filter</p>
          {(
            [
              ['all', 'All'],
              ['warehouse', 'To warehouse'],
              ['customer_address', 'To my address'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                filter === value
                  ? 'bg-[#2d6a5f] text-white'
                  : 'bg-[#f8fbfa] text-slate-600 hover:bg-[#e8f3f1]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </DashboardFilters>

      <DashboardPanel
        title="Orders report"
        description={
          loading
            ? 'Loading…'
            : `${filteredOrders.length} order${filteredOrders.length === 1 ? '' : 's'}`
        }
        noPadding
      >
        <div className="rx-scroll max-h-[32rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className={tableHeadRow}>
                <th className={tableHeadCellClass}>Order</th>
                <th className={tableHeadCellClass}>Product</th>
                <th className={tableHeadCellClass}>Delivery</th>
                <th className={tableHeadCellClass}>Destination</th>
                <th className={tableHeadCellClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id} className={tableRowClass}>
                  <td className="px-6 py-4">
                    <Link
                      href={`/dashboard/orders/${order.id}`}
                      className="font-bold text-[#1f4f47] hover:underline"
                    >
                      {order.orderId}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-slate-700">{order.product || '—'}</td>
                  <td className="px-6 py-4 capitalize text-slate-700">
                    {order.deliveryType === 'customer_address' ? 'Own address' : order.deliveryType || '—'}
                  </td>
                  <td className="px-6 py-4 text-slate-700">
                    {order.deliveryType === 'warehouse'
                      ? order.deliveryWarehouse || order.warehouseLocation || '—'
                      : order.deliveryAddress || '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-[#e8f3f1] px-2.5 py-1 text-xs font-bold text-[#2d6a5f]">
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                    No orders for this filter.
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
