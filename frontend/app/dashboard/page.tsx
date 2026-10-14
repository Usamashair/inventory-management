'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, FileText, Package, TrendingUp } from 'lucide-react'
import {
  DashboardHero,
  DashboardPage as DashboardShell,
  DashboardPanel,
  heroCtaClass,
  tableHeadCellClass,
  tableHeadRow,
  tableRowClass,
} from '@/components/dashboard-page'
import {
  ArtworkItem,
  InvoiceItem,
  OrderItem,
  ProductItem,
  QuotationItem,
  WarehouseStockItem,
  artworksApi,
  invoicesApi,
  ordersApi,
  productsApi,
  quotationsApi,
  warehouseStockApi,
} from '@/lib/resources'
import { getStoredUser, isStaffOrAdmin } from '@/lib/auth'
import { showToast } from '@/lib/toast'
import AdminDashboard from '@/components/admin-dashboard'

type FeedItem = {
  id: string
  title: string
  detail: string
  date: string
  href?: string
}

function buildFeed(input: {
  quotations: QuotationItem[]
  orders: OrderItem[]
  artworks: ArtworkItem[]
  invoices: InvoiceItem[]
}): FeedItem[] {
  const items: FeedItem[] = []

  for (const q of input.quotations.slice(0, 8)) {
    items.push({
      id: `q-${q.id}`,
      title: `Quotation ${q.quoteId}`,
      detail: `${q.product || 'Product'} · ${q.status}${q.customer ? ` · ${q.customer}` : ''}`,
      date: q.date || '',
      href: `/dashboard/quotations/${q.id}`,
    })
  }
  for (const o of input.orders.slice(0, 8)) {
    items.push({
      id: `o-${o.id}`,
      title: `Order ${o.orderId}`,
      detail: `${o.product || 'Order'} · ${o.status}${o.customer ? ` · ${o.customer}` : ''}`,
      date: o.date || o.deliveryDate || '',
      href: `/dashboard/orders/${o.id}`,
    })
  }
  for (const a of input.artworks.slice(0, 8)) {
    items.push({
      id: `a-${a.id}`,
      title: a.description || a.name || `Artwork #${a.id}`,
      detail: `Artwork · ${a.status}${a.orderNumber ? ` · ${a.orderNumber}` : ''}`,
      date: a.date || '',
      href: `/dashboard/artwork/${a.id}`,
    })
  }
  for (const inv of input.invoices.slice(0, 8)) {
    items.push({
      id: `i-${inv.id}`,
      title: `Invoice ${inv.invoiceNo}`,
      detail: `${inv.amount || '—'} · ${inv.status}${inv.customer ? ` · ${inv.customer}` : ''}`,
      date: inv.date || inv.issueDate || '',
      href: `/dashboard/invoices/${inv.id}`,
    })
  }

  return items.slice(0, 12)
}

const heroSecondaryClass =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/15'

export default function DashboardPage() {
  const user = getStoredUser()
  const staff = isStaffOrAdmin(user)

  const [loading, setLoading] = useState(true)
  const [quotations, setQuotations] = useState<QuotationItem[]>([])
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [artworks, setArtworks] = useState<ArtworkItem[]>([])
  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [products, setProducts] = useState<ProductItem[]>([])
  const [stocks, setStocks] = useState<WarehouseStockItem[]>([])

  useEffect(() => {
    let active = true
    void Promise.all([
      quotationsApi.list(),
      ordersApi.list(),
      artworksApi.list(),
      invoicesApi.list(),
      ...(staff
        ? [productsApi.list(), Promise.resolve([] as WarehouseStockItem[])]
        : [Promise.resolve([] as ProductItem[]), warehouseStockApi.myStock()]),
    ])
      .then(([q, o, a, inv, p, stock]) => {
        if (!active) return
        setQuotations(q)
        setOrders(o)
        setArtworks(a)
        setInvoices(inv)
        setProducts(p)
        setStocks(stock)
      })
      .catch((error) => {
        if (active) showToast(error instanceof Error ? error.message : 'Failed to load dashboard', 'error')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [staff])

  const feed = useMemo(
    () => buildFeed({ quotations, orders, artworks, invoices }),
    [quotations, orders, artworks, invoices],
  )

  const activeQuotes = quotations.filter((q) => ['sent', 'under-review', 'draft'].includes(q.status)).length
  const pendingArtwork = orders.filter((o) => o.status === 'waiting-for-artwork').length
  const outstandingInvoices = invoices.filter((i) =>
    ['pending', 'partially-paid', 'overdue', 'draft'].includes(i.status),
  )
  const activeOrders = orders.filter((o) => !['delivered', 'completed'].includes(o.status)).slice(0, 8)
  const totalStockQty = stocks.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  const warehouseCount = new Set(stocks.map((s) => String(s.warehouseId))).size

  if (staff) {
    return (
      <AdminDashboard
        loading={loading}
        quotations={quotations}
        orders={orders}
        artworks={artworks}
        invoices={invoices}
        products={products}
      />
    )
  }

  const stats = [
    {
      label: 'Active quotations',
      value: loading ? '…' : String(activeQuotes),
      hint: `${quotations.length} total`,
      icon: FileText,
    },
    {
      label: 'Waiting for artwork',
      value: loading ? '…' : String(pendingArtwork),
      hint: pendingArtwork ? 'Action required' : 'All clear',
      icon: AlertTriangle,
      warn: pendingArtwork > 0,
    },
    {
      label: 'Active orders',
      value: loading ? '…' : String(activeOrders.length),
      hint: `${orders.length} total`,
      icon: TrendingUp,
    },
    {
      label: 'Open invoices',
      value: loading ? '…' : String(outstandingInvoices.length),
      hint: `${invoices.length} total`,
      icon: Package,
      warn: outstandingInvoices.length > 0,
    },
  ]

  return (
    <DashboardShell>
      <DashboardHero
        eyebrow="Dashboard"
        title={`Welcome${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        description={
          loading
            ? 'Loading live data…'
            : `${orders.length} orders · ${quotations.length} quotations · track production and stock here.`
        }
        actions={
          <>
            <Link href="/dashboard/call-offs" className={heroCtaClass}>
              Request delivery
            </Link>
            <Link href="/dashboard/my-stock" className={heroSecondaryClass}>
              My stock
            </Link>
          </>
        }
        stats={stats}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <DashboardPanel
            title="Active orders"
            description={loading ? 'Loading…' : `${activeOrders.length} in progress`}
            actions={
              <Link href="/dashboard/orders" className="text-sm font-bold text-[#2d6a5f] hover:underline">
                View all →
              </Link>
            }
            noPadding
          >
            <div className="rx-scroll max-h-[32rem] overflow-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10">
                  <tr className={tableHeadRow}>
                    <th className={tableHeadCellClass}>Order</th>
                    <th className={tableHeadCellClass}>Product</th>
                    <th className={tableHeadCellClass}>Status</th>
                    <th className={tableHeadCellClass}>Delivery</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500">
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    activeOrders.map((order) => (
                      <tr key={order.id} className={tableRowClass}>
                        <td className="px-6 py-4">
                          <Link
                            href={`/dashboard/orders/${order.id}`}
                            className="font-bold text-[#1f4f47] hover:underline"
                          >
                            {order.orderId}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{order.product || '—'}</td>
                        <td className="px-6 py-4">
                          <span className="rounded-full bg-[#e8f3f1] px-2.5 py-1 text-xs font-bold text-[#2d6a5f]">
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {order.deliveryType === 'warehouse'
                            ? order.deliveryWarehouse || 'Warehouse'
                            : order.deliveryAddress || order.deliveryDate || '—'}
                        </td>
                      </tr>
                    ))}
                  {!loading && activeOrders.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500">
                        No active orders.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </DashboardPanel>

          <DashboardPanel
            title="Your warehouse stock"
            description={
              loading
                ? 'Loading…'
                : stocks.length
                  ? `${stocks.length} line${stocks.length === 1 ? '' : 's'} · ${totalStockQty.toLocaleString()} units · ${warehouseCount} warehouse${warehouseCount === 1 ? '' : 's'}`
                  : 'No stock held for you yet'
            }
            actions={
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/dashboard/my-stock"
                  className="rounded-xl bg-[#2d6a5f] px-4 py-2 text-sm font-bold text-white hover:bg-[#245750]"
                >
                  My stock
                </Link>
                <Link
                  href="/dashboard/call-offs"
                  className="rounded-xl border border-[#d7e8e4] bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-[#f8fbfa]"
                >
                  Request delivery
                </Link>
              </div>
            }
            noPadding
          >
            <div className="rx-scroll max-h-[20rem] overflow-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10">
                  <tr className={tableHeadRow}>
                    <th className={`${tableHeadCellClass} text-left text-xs font-bold uppercase tracking-wider text-slate-500`}>
                      Warehouse
                    </th>
                    <th className={`${tableHeadCellClass} text-left text-xs font-bold uppercase tracking-wider text-slate-500`}>
                      Product
                    </th>
                    <th className={`${tableHeadCellClass} text-left text-xs font-bold uppercase tracking-wider text-slate-500`}>
                      Qty
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={3} className="px-6 py-10 text-center text-sm text-slate-500">
                        Loading stock…
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    stocks.slice(0, 12).map((item) => (
                      <tr key={item.id} className={tableRowClass}>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {item.warehouse || `Warehouse #${item.warehouseId}`}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-slate-900">{item.product}</p>
                          {item.sku ? <p className="mt-0.5 text-xs text-slate-500">{item.sku}</p> : null}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-[#2d6a5f]">
                          {Number(item.quantity || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  {!loading && stocks.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-10 text-center text-sm text-slate-500">
                        No warehouse stock yet. It appears after warehouse-delivery orders are marked delivered.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </DashboardPanel>
        </div>

        <DashboardPanel
          title="Recent activity"
          description={loading ? 'Loading…' : 'Your latest quotes, orders & invoices'}
          actions={
            <Link href="/dashboard/activity" className="text-sm font-bold text-[#2d6a5f] hover:underline">
              Full history →
            </Link>
          }
          noPadding
        >
          <div className="rx-scroll max-h-[28rem] space-y-0 divide-y divide-[#eef3f1]">
            {loading && <p className="px-6 py-8 text-sm text-slate-500">Loading…</p>}
            {!loading &&
              feed.map((activity) => (
                <div key={activity.id} className="px-6 py-4">
                  <div className="flex gap-3">
                    <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#2d6a5f]" />
                    <div className="min-w-0 flex-1">
                      {activity.href ? (
                        <Link
                          href={activity.href}
                          className="text-sm font-semibold text-slate-900 hover:underline"
                        >
                          {activity.title}
                        </Link>
                      ) : (
                        <p className="text-sm font-semibold text-slate-900">{activity.title}</p>
                      )}
                      <p className="mt-1 text-xs text-slate-500">{activity.detail}</p>
                      <p className="mt-1 text-xs text-slate-400">{activity.date || '—'}</p>
                    </div>
                  </div>
                </div>
              ))}
            {!loading && feed.length === 0 && (
              <p className="px-6 py-8 text-sm text-slate-500">No activity yet.</p>
            )}
          </div>
        </DashboardPanel>
      </div>
    </DashboardShell>
  )
}
