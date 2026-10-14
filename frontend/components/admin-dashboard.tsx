'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Clock3,
  FileText,
  Palette,
  ShoppingCart,
  Users,
  WalletCards,
} from 'lucide-react'
import {
  DashboardHero,
  DashboardPage,
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
} from '@/lib/resources'
import { getStoredUser, roleLabel } from '@/lib/auth'
import { loadCustomers } from '@/lib/portal-data'

type Props = {
  loading: boolean
  quotations: QuotationItem[]
  orders: OrderItem[]
  artworks: ArtworkItem[]
  invoices: InvoiceItem[]
  products: ProductItem[]
}

type FeedItem = { id: string; title: string; detail: string; date: string; href: string }

const heroSecondaryClass =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/15'

export default function AdminDashboard({
  loading,
  quotations,
  orders,
  artworks,
  invoices,
  products,
}: Props) {
  const [customerCount, setCustomerCount] = useState(0)

  useEffect(() => {
    void loadCustomers()
      .then((customers) => setCustomerCount(customers.length))
      .catch(() => setCustomerCount(0))
  }, [])

  const openQuotes = quotations.filter((q) => ['sent', 'under-review', 'draft'].includes(q.status)).length
  const inProduction = orders.filter((o) =>
    ['in-production', 'in-transit', 'waiting-for-artwork'].includes(o.status),
  ).length
  const artworkReviews = artworks.filter((a) =>
    ['awaiting-approval', 'revision-sent', 'waiting', 'review', 'in-design'].includes(a.status),
  ).length
  const outstanding = invoices.filter((i) =>
    ['pending', 'partially-paid', 'overdue', 'draft'].includes(i.status),
  )
  const outstandingTotal = outstanding.reduce(
    (sum, i) => sum + Number(String(i.amount).replace(/[^0-9.-]/g, '') || 0),
    0,
  )
  const overdue = invoices.filter((i) => i.status === 'overdue').length
  const lowStock = products.filter((p) => p.status === 'low-stock' || p.status === 'out-of-stock').length
  const waitingArtwork = orders.filter((o) => o.status === 'waiting-for-artwork').length

  const heroStats = [
    {
      label: 'Customers',
      value: loading ? '…' : String(customerCount),
      hint: 'Portal accounts',
      icon: Users,
    },
    {
      label: 'Open quotations',
      value: loading ? '…' : String(openQuotes),
      hint: `${quotations.length} total`,
      icon: FileText,
    },
    {
      label: 'Orders in pipeline',
      value: loading ? '…' : String(inProduction),
      hint: `${orders.length} total`,
      icon: ShoppingCart,
      warn: waitingArtwork > 0,
    },
    {
      label: 'Outstanding',
      value: loading
        ? '…'
        : `$${outstandingTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      hint: `${overdue} overdue · ${outstanding.length} open`,
      icon: WalletCards,
      warn: overdue > 0,
    },
  ]

  const quickLinks = [
    {
      label: 'Inventory items',
      value: loading ? '…' : String(products.length),
      detail: `${lowStock} low / out of stock`,
      icon: Boxes,
      href: '/dashboard/inventory',
      warn: lowStock > 0,
    },
    {
      label: 'Artwork reviews',
      value: loading ? '…' : String(artworkReviews),
      detail: `${artworks.length} total artwork`,
      icon: Palette,
      href: '/dashboard/artwork',
      warn: artworkReviews > 0,
    },
    {
      label: 'Customers',
      value: loading ? '…' : String(customerCount),
      detail: 'Manage portal accounts',
      icon: Users,
      href: '/dashboard/admin/customers',
    },
  ]

  const feed = useMemo(() => {
    const items: FeedItem[] = []
    for (const q of quotations.slice(0, 6)) {
      items.push({
        id: `q-${q.id}`,
        title: `Quotation ${q.quoteId} · ${q.status}`,
        detail: q.customer || q.product || 'Quotation',
        date: q.date || '',
        href: `/dashboard/quotations/${q.id}`,
      })
    }
    for (const o of orders.slice(0, 6)) {
      items.push({
        id: `o-${o.id}`,
        title: `Order ${o.orderId} · ${o.status}`,
        detail: o.customer || o.product || 'Order',
        date: o.date || '',
        href: `/dashboard/orders/${o.id}`,
      })
    }
    for (const a of artworks.slice(0, 4)) {
      items.push({
        id: `a-${a.id}`,
        title: `${a.description || a.name || `Artwork #${a.id}`} · ${a.status}`,
        detail: a.customer || a.orderNumber || 'Artwork',
        date: a.date || '',
        href: `/dashboard/artwork/${a.id}`,
      })
    }
    for (const inv of invoices.slice(0, 4)) {
      items.push({
        id: `i-${inv.id}`,
        title: `Invoice ${inv.invoiceNo} · ${inv.status}`,
        detail: inv.customer || inv.amount || 'Invoice',
        date: inv.date || '',
        href: `/dashboard/invoices/${inv.id}`,
      })
    }
    return items.slice(0, 10)
  }, [quotations, orders, artworks, invoices])

  const attention = [
    lowStock > 0
      ? {
          title: `${lowStock} product${lowStock === 1 ? '' : 's'} below threshold / out of stock`,
          href: '/dashboard/admin/stock-alerts',
          tone: 'critical' as const,
          label: 'Critical',
        }
      : null,
    overdue > 0
      ? {
          title: `${overdue} overdue invoice${overdue === 1 ? '' : 's'}`,
          href: '/dashboard/invoices',
          tone: 'critical' as const,
          label: 'Overdue',
        }
      : null,
    artworkReviews > 0
      ? {
          title: `${artworkReviews} artwork file${artworkReviews === 1 ? '' : 's'} awaiting review`,
          href: '/dashboard/artwork',
          tone: 'warning' as const,
          label: 'Review',
        }
      : null,
    waitingArtwork > 0
      ? {
          title: `${waitingArtwork} order${waitingArtwork === 1 ? '' : 's'} waiting for artwork`,
          href: '/dashboard/orders',
          tone: 'warning' as const,
          label: 'Pending',
        }
      : null,
  ].filter(Boolean) as Array<{
    title: string
    href: string
    tone: 'critical' | 'warning'
    label: string
  }>

  const hasCritical = attention.some((item) => item.tone === 'critical')

  return (
    <DashboardPage>
      <DashboardHero
        eyebrow={roleLabel(getStoredUser())}
        title="Operations dashboard"
        description={
          loading
            ? 'Loading live data…'
            : `Live customers, orders, stock and invoices · ${new Date().toLocaleDateString(undefined, { dateStyle: 'medium' })}`
        }
        actions={
          <>
            <Link href="/dashboard/quotations/add" className={heroCtaClass}>
              New quotation
            </Link>
            <Link href="/dashboard/orders" className={heroSecondaryClass}>
              View orders
            </Link>
          </>
        }
        stats={heroStats}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {quickLinks.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.label}
              href={item.href}
              className="group rounded-2xl border border-[#d7e8e4] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#1f4f47] to-[#2d6a5f] text-white shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-[#2d6a5f]" />
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">{item.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{item.value}</p>
              <p className={`mt-2 text-xs font-medium ${item.warn ? 'text-amber-700' : 'text-slate-500'}`}>
                {item.detail}
              </p>
            </Link>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <DashboardPanel
          title="Recent activity"
          description={loading ? 'Loading…' : `${feed.length} recent updates`}
          actions={
            <Link href="/dashboard/activity" className="text-sm font-bold text-[#2d6a5f] hover:underline">
              View all →
            </Link>
          }
          noPadding
        >
          <div className="rx-scroll max-h-[28rem] divide-y divide-[#eef3f1]">
            {loading && <p className="px-6 py-8 text-sm text-slate-500">Loading…</p>}
            {!loading &&
              feed.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center gap-4 px-6 py-4 transition hover:bg-[#f8fbfa]"
                >
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#2d6a5f]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-slate-400">{item.date || '—'}</span>
                </Link>
              ))}
            {!loading && feed.length === 0 && (
              <p className="px-6 py-8 text-sm text-slate-500">No records yet.</p>
            )}
          </div>
        </DashboardPanel>

        <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f3f1] text-[#2d6a5f]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">
                Attention required
              </h2>
              <p className="mt-0.5 text-sm text-slate-600">
                {loading
                  ? 'Checking…'
                  : attention.length
                    ? `${attention.length} item${attention.length === 1 ? '' : 's'}${
                        hasCritical ? ' · includes critical' : ''
                      }`
                    : 'All clear'}
              </p>
            </div>
          </div>
          <div className="rx-scroll mt-5 max-h-[22rem] space-y-3 overflow-y-auto pr-1">
            {loading && <p className="text-sm text-slate-500">Loading…</p>}
            {!loading &&
              attention.map((item) => {
                const critical = item.tone === 'critical'
                const Icon = critical ? AlertTriangle : Clock3
                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    className={`block rounded-xl border border-[#e2eeeb] p-4 transition ${
                      critical
                        ? 'border-l-[3px] border-l-red-500 bg-red-50 hover:bg-red-100/80'
                        : 'border-l-[3px] border-l-amber-400 bg-[#f8fbfa] hover:border-amber-300 hover:bg-amber-50/80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          critical ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            critical
                              ? 'bg-red-600 text-white'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.label}
                        </span>
                        <p className="mt-1.5 text-sm font-semibold text-slate-900">{item.title}</p>
                        <p
                          className={`mt-1 text-xs font-semibold ${
                            critical ? 'text-red-700' : 'text-amber-700'
                          }`}
                        >
                          Open →
                        </p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            {!loading && attention.length === 0 && (
              <p className="rounded-xl border border-[#d7e8e4] bg-[#f8fbfa] p-4 text-sm text-slate-600">
                Nothing needs attention right now.
              </p>
            )}
          </div>
        </div>
      </div>

      <DashboardPanel
        title="Orders in pipeline"
        description={loading ? 'Loading…' : `${inProduction} active`}
        actions={
          <Link href="/dashboard/orders" className="text-sm font-bold text-[#2d6a5f] hover:underline">
            View all →
          </Link>
        }
        noPadding
      >
        <div className="rx-scroll max-h-[22rem] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className={tableHeadRow}>
                <th className={tableHeadCellClass}>Order</th>
                <th className={tableHeadCellClass}>Customer</th>
                <th className={tableHeadCellClass}>Status</th>
                <th className={tableHeadCellClass}>Value</th>
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
                orders
                  .filter((o) => !['delivered', 'completed'].includes(o.status))
                  .map((order) => (
                    <tr key={order.id} className={tableRowClass}>
                      <td className="px-6 py-4">
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          className="font-bold text-[#1f4f47] hover:underline"
                        >
                          {order.orderId}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{order.customer || '—'}</td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-[#e8f3f1] px-2.5 py-1 text-xs font-bold text-[#2d6a5f]">
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">{order.value || '—'}</td>
                    </tr>
                  ))}
              {!loading &&
                orders.filter((o) => !['delivered', 'completed'].includes(o.status)).length === 0 && (
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
    </DashboardPage>
  )
}
