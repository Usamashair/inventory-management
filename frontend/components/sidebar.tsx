'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Activity,
  Bell,
  Boxes,
  Building2,
  ChevronRight,
  FileCog,
  Home,
  MessageSquare,
  Palette,
  ShoppingCart,
  Package,
  FileText,
  RefreshCcw,
  LogOut,
  Settings,
  UserRound,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { logout, getStoredUser, PortalUser, isStaffOrAdmin, isAdmin, roleInitials } from '@/lib/auth'

type SidebarProps = {
  open?: boolean
  onClose?: () => void
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const [user, setUser] = useState<PortalUser | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  useEffect(() => setUser(getStoredUser()), [])

  useEffect(() => {
    setUser(getStoredUser())
    onClose?.()
    setUserMenuOpen(false)
    // Close the mobile drawer after navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (!userMenuOpen) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-user-menu]')) return
      setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [userMenuOpen])

  const isActive = (path: string) =>
    path === '/dashboard' ? pathname === path : pathname.startsWith(path)

  const navItems = [
    { icon: Home, label: 'Dashboard', href: '/dashboard', id: 'dashboard' },
    { icon: MessageSquare, label: 'Quotations', href: '/dashboard/quotations', id: 'quotations' },
    { icon: Palette, label: 'Artwork', href: '/dashboard/artwork', id: 'artwork' },
    { icon: ShoppingCart, label: 'Orders', href: '/dashboard/orders', id: 'orders' },
    ...(isStaffOrAdmin(user)
      ? [{ icon: Package, label: 'Inventory', href: '/dashboard/inventory', id: 'inventory' }]
      : []),
    { icon: FileText, label: 'Invoices', href: '/dashboard/invoices', id: 'invoices' },
    ...(isStaffOrAdmin(user)
      ? [{ icon: Building2, label: 'Warehouses', href: '/dashboard/warehouses', id: 'warehouses' }]
      : [
          { icon: Building2, label: 'My Warehouse Stock', href: '/dashboard/my-stock', id: 'my-stock' },
          { icon: Boxes, label: 'Call-offs', href: '/dashboard/call-offs', id: 'call-offs' },
        ]),
  ]

  const adminExtraRestItems = [
    { icon: Boxes, label: 'Call-offs', href: '/dashboard/call-offs', id: 'call-offs' },
    { icon: Boxes, label: 'Manage all stock', href: '/dashboard/admin/inventory', id: 'admin-inventory' },
    { icon: Bell, label: 'Notifications', href: '/dashboard/notifications', id: 'notifications' },
    { icon: Activity, label: 'Customer Activity', href: '/dashboard/activity', id: 'activity' },
    { icon: RefreshCcw, label: 'Odoo Sync', href: '/dashboard/admin/odoo', id: 'odoo' },
    { icon: FileCog, label: 'Stock Alerts', href: '/dashboard/admin/stock-alerts', id: 'stock-alerts' },
  ]

  const adminExtraItems = [
    { icon: Users, label: 'Customers', href: '/dashboard/admin/customers', id: 'customers' },
    ...(isAdmin(user)
      ? [{ icon: UserCog, label: 'Staff', href: '/dashboard/admin/staff', id: 'staff' }]
      : []),
    ...adminExtraRestItems,
  ]

  const customerExtraItems = [
    { icon: Bell, label: 'Notifications', href: '/dashboard/notifications', id: 'notifications' },
    { icon: Activity, label: 'Activity', href: '/dashboard/activity', id: 'activity' },
  ]

  const extraItems = isStaffOrAdmin(user) ? adminExtraItems : customerExtraItems

  const handleLogout = async () => {
    setUserMenuOpen(false)
    await logout()
    window.location.assign('/')
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => {
          setUserMenuOpen(false)
          onClose?.()
        }}
        aria-hidden={!open}
      />

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-64 flex-col overflow-visible bg-[#0b1722] text-white transition-transform duration-300 lg:z-40 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-4 pt-5">
          <Link href="/dashboard" className="flex min-w-0 items-center" onClick={onClose}>
            <img
              src="/rexapack-logo.png"
              alt="Rexapack"
              className="h-8 w-auto max-w-[170px] object-contain object-left"
            />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] transition ${
                    active
                      ? 'bg-[#2d6a5f] font-semibold text-white'
                      : 'font-medium text-slate-400 hover:bg-white/6 hover:text-white'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>

          {extraItems.length > 0 && (
            <div className="mt-5 space-y-1 border-t border-white/8 pt-4">
              {extraItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] transition ${
                      active
                        ? 'bg-[#2d6a5f] font-semibold text-white'
                        : 'font-medium text-slate-400 hover:bg-white/6 hover:text-white'
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          )}

          {isStaffOrAdmin(user) && (
            <div className="mt-5 space-y-1 border-t border-white/8 pt-4">
              <Link
                href="/dashboard/settings"
                onClick={onClose}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] transition ${
                  isActive('/dashboard/settings')
                    ? 'bg-[#2d6a5f] font-semibold text-white'
                    : 'font-medium text-slate-400 hover:bg-white/6 hover:text-white'
                }`}
              >
                <Settings className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                <span>Settings</span>
              </Link>
            </div>
          )}
        </nav>

        <div className="relative shrink-0 border-t border-white/8 bg-[#0b1722] p-3" data-user-menu>
          <button
            type="button"
            onClick={() => setUserMenuOpen((current) => !current)}
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
              userMenuOpen ? 'bg-white/10' : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2d6a5f] text-xs font-bold">
              {roleInitials(user)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold">{user?.name}</p>
              <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
            </div>
            <ChevronRight
              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                userMenuOpen ? 'rotate-90' : ''
              }`}
            />
          </button>

          {userMenuOpen && (
            <div
              role="menu"
              className="absolute bottom-3 left-[calc(100%+0.5rem)] z-[80] w-56 overflow-hidden rounded-xl border border-white/10 bg-[#132333] shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
            >
              <p className="border-b border-white/8 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Account
              </p>
              <Link
                href="/dashboard/settings?tab=profile"
                role="menuitem"
                onClick={() => {
                  setUserMenuOpen(false)
                  onClose?.()
                }}
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-[13px] font-medium text-slate-200 transition hover:bg-white/8 hover:text-white"
              >
                <UserRound className="h-4 w-4 text-[#7eb8ac]" />
                <span>Profile settings</span>
              </Link>
              <div className="h-px bg-white/8" />
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleLogout()}
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-[13px] font-medium text-red-400 transition hover:bg-red-900/25 hover:text-red-300"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
