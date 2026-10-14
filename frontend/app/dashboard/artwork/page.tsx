'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Trash2, Edit, Eye, Plus, Image, FilterX, Search, Upload } from 'lucide-react'
import ConfirmDialog from '@/components/confirm-dialog'
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
import TableLoader from '@/components/table-loader'
import StatusSelect, {
  ADMIN_ARTWORK_STATUSES,
  ARTWORK_STATUSES,
  adminArtworkStatusValue,
  artworkStatusLabel,
} from '@/components/status-select'
import { ArtworkItem, OrderItem, artworksApi, ordersApi } from '@/lib/resources'
import { loadCustomers } from '@/lib/portal-data'
import type { Customer } from '@/lib/portal-data'
import { getStoredUser, isStaffOrAdmin } from '@/lib/auth'
import { showToast } from '@/lib/toast'

type ArtworkRow = {
  key: string
  artwork: ArtworkItem | null
  order: OrderItem | null
}

function statusLabel(status: string, forAdmin = false) {
  return artworkStatusLabel(status, forAdmin)
}

function statusClass(status: string, forAdmin = false) {
  const display = forAdmin && status === 'revision-sent' ? 'awaiting-approval' : status
  switch (display) {
    case 'approved':
      return 'bg-emerald-50 text-emerald-700'
    case 'revision-requested':
      return 'bg-amber-50 text-amber-800'
    case 'revision-sent':
      return 'bg-blue-50 text-blue-700'
    case 'awaiting-approval':
      return 'bg-slate-100 text-slate-700'
    case 'not-uploaded':
      return 'bg-amber-50 text-amber-800'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

export default function ArtworkPage() {
  const staff = isStaffOrAdmin(getStoredUser())
  const [artworks, setArtworks] = useState<ArtworkItem[]>([])
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<ArtworkItem | null>(null)

  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [customerFilter, setCustomerFilter] = useState('all')

  const hasActiveFilters =
    search !== '' || statusFilter !== 'all' || customerFilter !== 'all'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [artworkList, orderList, customerList] = await Promise.all([
        artworksApi.list(),
        ordersApi.list(),
        staff ? loadCustomers() : Promise.resolve([] as Customer[]),
      ])
      setArtworks(artworkList)
      setOrders(orderList)
      setCustomers(customerList)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load artwork', 'error')
    } finally {
      setLoading(false)
    }
  }, [staff])

  useEffect(() => {
    void load()
  }, [load])

  const ordersById = useMemo(() => {
    const map = new Map<string, OrderItem>()
    for (const order of orders) map.set(String(order.id), order)
    return map
  }, [orders])

  const rows: ArtworkRow[] = useMemo(() => {
    const q = search.trim().toLowerCase()
    const artworkOrderIds = new Set(
      artworks.map((item) => (item.orderId ? String(item.orderId) : '')).filter(Boolean),
    )

    const artworkRows: ArtworkRow[] = artworks.map((artwork) => ({
      key: `art-${artwork.id}`,
      artwork,
      order: artwork.orderId ? ordersById.get(String(artwork.orderId)) || null : null,
    }))

    // Include waiting orders that still have no artwork file.
    const pendingRows: ArtworkRow[] = orders
      .filter((order) => order.status === 'waiting-for-artwork' && !artworkOrderIds.has(String(order.id)))
      .map((order) => ({
        key: `order-${order.id}`,
        artwork: null,
        order,
      }))

    return [...artworkRows, ...pendingRows].filter(({ artwork, order }) => {
      const customerId = String(artwork?.customerId || order?.customerId || '')
      if (customerFilter !== 'all' && customerId !== customerFilter) return false

      const status = artwork?.status || (artwork ? null : 'not-uploaded')
      if (statusFilter === 'not-uploaded') {
        if (artwork) return false
      } else if (statusFilter !== 'all') {
        if (staff && statusFilter === 'awaiting-approval') {
          if (status !== 'awaiting-approval' && status !== 'revision-sent') return false
        } else if (status !== statusFilter) {
          return false
        }
      }

      if (!q) return true
      const haystack = [
        artwork?.id,
        artwork?.description,
        artwork?.name,
        artwork?.status,
        artwork?.orderNumber,
        order?.orderId,
        order?.id,
        order?.customer,
        artwork?.customer,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [artworks, orders, ordersById, search, statusFilter, customerFilter, staff])

  const revisionCount = useMemo(
    () => artworks.filter((item) => item.status === 'revision-requested').length,
    [artworks],
  )

  const clearFilters = () => {
    setSearch('')
    setSearchInput('')
    setStatusFilter('all')
    setCustomerFilter('all')
  }

  const handleDelete = async () => {
    if (!itemToDelete) return
    if (itemToDelete.status === 'approved') {
      showToast('Approved artwork cannot be deleted', 'error')
      setItemToDelete(null)
      return
    }
    setDeleting(true)
    try {
      await artworksApi.remove(itemToDelete.id)
      setArtworks((current) => current.filter((item) => item.id !== itemToDelete.id))
      setItemToDelete(null)
      showToast('Artwork deleted successfully', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete artwork', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleStatusChange = async (artworkId: string, status: string) => {
    const current = artworks.find((item) => String(item.id) === String(artworkId))
    if (current?.status === 'approved' && status !== 'revision-requested') {
      showToast('Approved artwork cannot be changed — request a revision instead', 'error')
      return
    }
    try {
      const updated = await artworksApi.update(artworkId, { status })
      setArtworks((current) =>
        current.map((item) => (String(item.id) === String(artworkId) ? { ...item, ...updated } : item)),
      )
      showToast(
        status === 'approved'
          ? 'Artwork approved — order moved to In Production'
          : status === 'revision-requested'
            ? 'Revision requested — customer can upload a revised file'
            : 'Artwork status updated',
        'success',
      )
      if (status === 'approved') void load()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update status', 'error')
    }
  }

  const colSpan = staff ? 7 : 6

  return (
    <DashboardPage>
      <DashboardHero
        eyebrow="Artwork"
        title="Artwork Gallery"
        description="All artwork files across orders — upload, review, and approve designs."
        actions={
          <Link href="/dashboard/artwork/add" className={heroCtaClass}>
            <Plus className="h-4 w-4" />
            Upload New Artwork
          </Link>
        }
      />

      {!staff && revisionCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950">
          <p className="font-bold">
            {revisionCount === 1
              ? '1 artwork needs your revision'
              : `${revisionCount} artworks need your revision`}
          </p>
          <p className="mt-1 text-sm">
            Admin requested changes. Use <strong>Upload revision</strong> on the highlighted rows below.
          </p>
        </div>
      )}

      <DashboardFilters>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                placeholder="Order, customer, description…"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#2d6a5f]"
              />
            </div>
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Artwork status
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#2d6a5f]"
            >
              <option value="all">All statuses</option>
              <option value="not-uploaded">Not uploaded</option>
              {(staff ? ADMIN_ARTWORK_STATUSES : ARTWORK_STATUSES).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {staff ? (
            <label className="block text-sm">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Customer
              </span>
              <select
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#2d6a5f]"
              >
                <option value="all">All customers</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={String(customer.id)}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="flex items-end">
              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                <FilterX className="h-4 w-4" />
                Reset filters
              </button>
            </div>
          )}
        </div>

        {staff && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              <FilterX className="h-4 w-4" />
              Reset filters
            </button>
          </div>
        )}
      </DashboardFilters>

      <DashboardPanel
        title="All artwork"
        description="Every uploaded design, plus orders still waiting for a file."
        actions={
          <p className="text-sm text-slate-500">
            {loading ? 'Loading…' : `${rows.length} item${rows.length === 1 ? '' : 's'}`}
          </p>
        }
        noPadding
      >
        <div className="rx-scroll max-h-[32rem] overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className={tableHeadRow}>
                <th className={tableHeadCellClass}>Image</th>
                <th className={tableHeadCellClass}>Order</th>
                {staff && <th className={tableHeadCellClass}>Customer</th>}
                <th className={tableHeadCellClass}>Description</th>
                <th className={tableHeadCellClass}>Artwork status</th>
                <th className={tableHeadCellClass}>Updated</th>
                <th className={tableHeadCellClass}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoader colSpan={colSpan} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-6 py-12 text-center text-sm text-slate-500">
                    No artwork found{hasActiveFilters ? ' with these filters' : ''}.
                  </td>
                </tr>
              ) : (
                rows.map(({ key, order, artwork }) => {
                  const artworkId = artwork?.id || order?.artworkId || null
                  const artworkStatus = artwork?.status || null
                  const locked = artworkStatus === 'approved'
                  const needsRevision = artworkStatus === 'revision-requested'
                  const orderHref = order?.id ? `/dashboard/orders/${order.id}` : null
                  const orderLabel = order?.orderId || artwork?.orderNumber || (order ? `#${order.id}` : '—')
                  const customerName = artwork?.customer || order?.customer || '—'

                  return (
                    <tr
                      key={key}
                      className={`${tableRowClass} ${needsRevision ? 'bg-amber-50/70' : ''}`}
                    >
                      <td className="px-6 py-4">
                        {artwork?.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={artwork.imageUrl} alt="" className="h-12 w-12 rounded object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded bg-amber-50">
                            <Image className="h-5 w-5 text-amber-500" />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {orderHref ? (
                          <Link href={orderHref} className="font-semibold text-[#2d6a5f] underline">
                            {orderLabel}
                          </Link>
                        ) : (
                          <span className="font-semibold text-slate-700">{orderLabel}</span>
                        )}
                        {!artwork && (
                          <p className="mt-0.5 text-xs text-amber-700">Waiting for artwork</p>
                        )}
                        {needsRevision && (
                          <p className="mt-0.5 text-xs text-amber-700">Revision requested</p>
                        )}
                      </td>
                      {staff && (
                        <td className="px-6 py-4 text-sm text-slate-700">{customerName}</td>
                      )}
                      <td className="px-6 py-4 text-sm text-slate-900">
                        {artwork
                          ? artwork.description || artwork.name || `Artwork #${artwork.id}`
                          : 'No artwork uploaded yet'}
                        {needsRevision && !staff && (
                          <p className="mt-1 text-xs font-semibold text-amber-800">
                            Please upload a revised file
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {!artworkId || !artworkStatus ? (
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass('not-uploaded')}`}
                          >
                            Not uploaded
                          </span>
                        ) : staff ? (
                          <StatusSelect
                            value={adminArtworkStatusValue(artworkStatus)}
                            options={
                              locked
                                ? ADMIN_ARTWORK_STATUSES.filter(
                                    (o) => o.value === 'approved' || o.value === 'revision-requested',
                                  )
                                : ADMIN_ARTWORK_STATUSES
                            }
                            onChange={(status) => void handleStatusChange(String(artworkId), status)}
                          />
                        ) : (
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(artworkStatus)}`}
                          >
                            {statusLabel(artworkStatus)}
                            {locked ? ' · Locked' : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {artwork?.date || order?.date || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {!artworkId ? (
                            order?.id ? (
                              <Link
                                href={`/dashboard/artwork/add?orderId=${order.id}`}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2d6a5f] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#245750]"
                              >
                                <Upload className="h-3.5 w-3.5" />
                                Upload
                              </Link>
                            ) : null
                          ) : (
                            <>
                              {needsRevision && !staff && (
                                <Link
                                  href={`/dashboard/artwork/${artworkId}/edit`}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
                                >
                                  <Upload className="h-3.5 w-3.5" />
                                  Upload revision
                                </Link>
                              )}
                              <Link
                                href={`/dashboard/artwork/${artworkId}`}
                                className="rounded-lg p-2 hover:bg-slate-200"
                                title="View"
                              >
                                <Eye className="h-4 w-4 text-slate-600" />
                              </Link>
                              {!locked && !needsRevision && (
                                <Link
                                  href={`/dashboard/artwork/${artworkId}/edit`}
                                  className="rounded-lg p-2 hover:bg-slate-200"
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4 text-slate-600" />
                                </Link>
                              )}
                              {staff && !locked && (
                                <button
                                  type="button"
                                  onClick={() => artwork && setItemToDelete(artwork)}
                                  className="rounded-lg p-2 hover:bg-red-100"
                                  title="Delete"
                                  disabled={!artwork}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </DashboardPanel>

      <ConfirmDialog
        open={Boolean(itemToDelete)}
        title="Delete Artwork"
        message="Are you sure you want to delete this artwork? This action cannot be undone."
        confirmLabel="Delete Artwork"
        loading={deleting}
        onCancel={() => setItemToDelete(null)}
        onConfirm={() => void handleDelete()}
      />
    </DashboardPage>
  )
}
