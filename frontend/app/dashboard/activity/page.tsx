'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  Boxes,
  FileText,
  Filter,
  Package,
  Palette,
  ReceiptText,
  RefreshCcw,
} from 'lucide-react'
import {
  DashboardFilters,
  DashboardHero,
  DashboardPage,
  DashboardPanel,
} from '@/components/dashboard-page'
import { getStoredUser, isStaffOrAdmin } from '@/lib/auth'
import { ActivityItem, activityApi } from '@/lib/resources'
import { showToast } from '@/lib/toast'

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'quotation', label: 'Quotations' },
  { id: 'artwork', label: 'Artwork' },
  { id: 'order', label: 'Orders' },
  { id: 'invoice', label: 'Invoices' },
  { id: 'call-off', label: 'Call-offs' },
] as const

type CategoryId = (typeof CATEGORIES)[number]['id']

function iconFor(category: string) {
  switch (category) {
    case 'quotation':
      return FileText
    case 'artwork':
      return Palette
    case 'order':
      return Package
    case 'invoice':
      return ReceiptText
    case 'call-off':
      return Boxes
    default:
      return Activity
  }
}

function categoryLabel(category: string) {
  return CATEGORIES.find((item) => item.id === category)?.label || category
}

export default function ActivityPage() {
  const staff = isStaffOrAdmin(getStoredUser())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [items, setItems] = useState<ActivityItem[]>([])
  const [category, setCategory] = useState<CategoryId>('all')

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (opts?.soft) setRefreshing(true)
      else setLoading(true)
      try {
        const response = await activityApi.list({
          category: category === 'all' ? undefined : category,
          limit: 200,
        })
        setItems(response.data)
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to load activity', 'error')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [category],
  )

  useEffect(() => {
    void load()
  }, [load])

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const item of items) {
      map[item.category] = (map[item.category] || 0) + 1
    }
    return map
  }, [items])

  const stats = useMemo(
    () => [
      {
        label: 'Events',
        value: String(items.length),
        hint: category === 'all' ? 'All categories' : categoryLabel(category),
        icon: Activity,
      },
      {
        label: 'Quotations',
        value: String(counts.quotation || 0),
        hint: 'Quotes & messages',
        icon: FileText,
      },
      {
        label: 'Orders',
        value: String(counts.order || 0),
        hint: 'Production pipeline',
        icon: Package,
      },
      {
        label: 'Other',
        value: String((counts.artwork || 0) + (counts.invoice || 0) + (counts['call-off'] || 0)),
        hint: 'Artwork · invoices · call-offs',
        icon: Boxes,
      },
    ],
    [items.length, category, counts],
  )

  return (
    <DashboardPage maxWidth="full">
      <DashboardHero
        eyebrow={staff ? 'Operations' : 'Your account'}
        title={staff ? 'Customer activity' : 'Your activity'}
        description={
          staff
            ? 'Events across all customers — quotations, artwork, orders, invoices, and call-offs.'
            : 'Only your quotations, artwork, orders, invoices, and call-offs.'
        }
        actions={
          <button
            type="button"
            onClick={() => void load({ soft: true })}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/15 disabled:opacity-50"
          >
            <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
        stats={stats}
      />

      <DashboardFilters>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Filter className="h-3.5 w-3.5" />
            Filter
          </span>
          {CATEGORIES.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategory(tab.id)}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                category === tab.id
                  ? 'bg-[#2d6a5f] text-white'
                  : 'bg-[#f8fbfa] text-slate-600 hover:bg-[#e8f3f1]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </DashboardFilters>

      <DashboardPanel
        title="Timeline"
        description={
          loading ? 'Loading…' : `${items.length} event${items.length === 1 ? '' : 's'}`
        }
        noPadding
      >
        <div className="rx-scroll max-h-[32rem] overflow-auto">
          {loading && <p className="p-8 text-sm text-slate-500">Loading activity…</p>}

          {!loading && items.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-500">
              No activity yet. Quotation, artwork, order, invoice, and call-off events will appear here.
            </p>
          )}

          <div className="space-y-0 px-6 py-2 sm:px-8">
            {!loading &&
              items.map((item, index) => {
                const Icon = iconFor(item.category)
                return (
                  <div key={item.id} className="relative flex gap-5 pb-8 last:pb-0">
                    {index < items.length - 1 && (
                      <div className="absolute left-[21px] top-11 h-[calc(100%-2.25rem)] w-px bg-[#e2eeeb]" />
                    )}
                    <div className="z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e8f3f1] text-[#2d6a5f]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.href ? (
                          <Link
                            href={item.href}
                            className="text-sm font-bold text-slate-900 hover:underline"
                          >
                            {item.title}
                          </Link>
                        ) : (
                          <p className="text-sm font-bold text-slate-900">{item.title}</p>
                        )}
                        <span className="rounded-full bg-[#f8fbfa] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          {categoryLabel(item.category)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm text-slate-500">{item.detail}</p>
                      <p className="mt-2 text-xs font-medium text-slate-400">
                        {item.dateLabel || item.date || '—'}
                        {item.date && item.dateLabel && item.date !== item.dateLabel ? (
                          <span className="text-slate-300"> · {item.date}</span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </DashboardPanel>
    </DashboardPage>
  )
}
