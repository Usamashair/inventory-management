'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Bell,
  CheckCheck,
  FileText,
  Filter,
  Layers,
  Package,
  Palette,
  ReceiptText,
  Boxes,
} from 'lucide-react'
import {
  DashboardFilters,
  DashboardHero,
  DashboardPage,
  DashboardPanel,
} from '@/components/dashboard-page'
import { getStoredUser, isStaffOrAdmin } from '@/lib/auth'
import {
  NotificationCategory,
  PortalNotificationItem,
  notificationsApi,
} from '@/lib/resources'
import { showToast } from '@/lib/toast'

const CATEGORIES: Array<{ id: 'all' | NotificationCategory; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'quotation', label: 'Quotations' },
  { id: 'artwork', label: 'Artwork' },
  { id: 'order', label: 'Orders' },
  { id: 'invoice', label: 'Invoices' },
  { id: 'call-off', label: 'Call-offs' },
]

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
      return Bell
  }
}

function categoryLabel(category: string) {
  return CATEGORIES.find((c) => c.id === category)?.label || category
}

export default function NotificationsPage() {
  const staff = isStaffOrAdmin(getStoredUser())
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<PortalNotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [category, setCategory] = useState<'all' | NotificationCategory>('all')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await notificationsApi.list({
        category: category === 'all' ? undefined : category,
        unread: unreadOnly || undefined,
        limit: 150,
      })
      setItems(response.data)
      setUnreadCount(response.unreadCount)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load notifications', 'error')
    } finally {
      setLoading(false)
    }
  }, [category, unreadOnly])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    const readCount = items.filter((item) => item.isRead).length
    const categoriesActive = new Set(items.map((item) => item.category).filter(Boolean)).size

    return [
      {
        label: 'Unread',
        value: String(unreadCount),
        hint: unreadCount ? 'Needs attention' : 'All caught up',
        icon: Bell,
        warn: unreadCount > 0,
      },
      {
        label: 'Showing',
        value: String(items.length),
        hint: unreadOnly ? 'Unread only' : category === 'all' ? 'All categories' : categoryLabel(category),
        icon: Filter,
      },
      {
        label: 'Read',
        value: String(readCount),
        hint: readCount ? 'In current view' : 'None in view',
        icon: CheckCheck,
      },
      {
        label: 'Categories',
        value: String(categoriesActive),
        hint: categoriesActive ? 'Active in view' : 'No activity',
        icon: Layers,
      },
    ]
  }, [unreadCount, items, unreadOnly, category])

  const handleOpen = async (item: PortalNotificationItem) => {
    if (!item.isRead) {
      try {
        await notificationsApi.markRead(item.id)
        setItems((current) =>
          current.map((row) =>
            row.id === item.id ? { ...row, isRead: true, readAt: new Date().toISOString() } : row,
          ),
        )
        setUnreadCount((count) => Math.max(0, count - 1))
      } catch {
        // Still allow navigation even if mark-read fails.
      }
    }
  }

  const handleMarkAllRead = async () => {
    setMarkingAll(true)
    try {
      await notificationsApi.markAllRead()
      setItems((current) =>
        current.map((row) => ({ ...row, isRead: true, readAt: row.readAt || new Date().toISOString() })),
      )
      setUnreadCount(0)
      showToast('All notifications marked as read', 'success')
      if (unreadOnly) void load()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to mark all as read', 'error')
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <DashboardPage maxWidth="full">
      <DashboardHero
        eyebrow={staff ? 'Communication centre' : 'Your inbox'}
        title="Notifications"
        description={
          staff
            ? 'Live feed of quotations, artwork, orders, invoices, and call-offs across the portal.'
            : 'Only your quotations, artwork, orders, invoices, and call-offs.'
        }
        actions={
          <button
            type="button"
            onClick={() => void handleMarkAllRead()}
            disabled={markingAll || unreadCount === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" />
            {markingAll ? 'Updating…' : 'Mark all read'}
          </button>
        }
        stats={stats}
      />

      <DashboardFilters>
        <div className="flex flex-wrap items-center gap-2">
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
          <button
            type="button"
            onClick={() => setUnreadOnly((value) => !value)}
            className={`ml-auto rounded-xl px-3 py-2 text-xs font-bold transition ${
              unreadOnly
                ? 'bg-amber-100 text-amber-900'
                : 'bg-[#f8fbfa] text-slate-600 hover:bg-[#e8f3f1]'
            }`}
          >
            Unread only
          </button>
        </div>
      </DashboardFilters>

      <DashboardPanel
        title="Activity feed"
        description={
          loading
            ? 'Loading…'
            : `${items.length} notification${items.length === 1 ? '' : 's'} · ${unreadCount} unread`
        }
        noPadding
      >
        <div className="rx-scroll max-h-[32rem] overflow-auto">
          {loading && <p className="p-8 text-sm text-slate-500">Loading notifications…</p>}

          {!loading &&
            items.map((notification) => {
              const Icon = iconFor(notification.category)
              const content = (
                <>
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      notification.isRead ? 'bg-slate-100 text-slate-500' : 'bg-[#e8f3f1] text-[#2d6a5f]'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p
                          className={`text-sm ${notification.isRead ? 'font-semibold text-slate-700' : 'font-bold text-slate-900'}`}
                        >
                          {notification.title}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">{notification.message}</p>
                      </div>
                      {!notification.isRead ? (
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#2d6a5f]" />
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                      <span className="capitalize">{categoryLabel(notification.category)}</span>
                      <span>•</span>
                      <span>{notification.createdAtLabel || notification.createdAt || '—'}</span>
                    </div>
                  </div>
                </>
              )

              const className = `flex w-full gap-4 border-b border-[#eef3f1] p-5 text-left last:border-0 hover:bg-white ${
                notification.isRead ? 'bg-white' : 'bg-[#f8fbfa]'
              }`

              if (notification.href) {
                return (
                  <Link
                    key={notification.id}
                    href={notification.href}
                    onClick={() => void handleOpen(notification)}
                    className={className}
                  >
                    {content}
                  </Link>
                )
              }

              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void handleOpen(notification)}
                  className={className}
                >
                  {content}
                </button>
              )
            })}

          {!loading && items.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-500">
              {unreadOnly
                ? 'No unread notifications.'
                : 'No notifications yet. Activity from quotations, artwork, orders, invoices, and call-offs will appear here.'}
            </p>
          )}
        </div>
      </DashboardPanel>
    </DashboardPage>
  )
}
