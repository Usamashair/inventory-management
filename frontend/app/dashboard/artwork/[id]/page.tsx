'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Calendar, ImageIcon, Pencil } from 'lucide-react'
import { artworkStatusLabel } from '@/components/status-select'
import { ArtworkItem, artworksApi } from '@/lib/resources'
import { getStoredUser, isStaffOrAdmin } from '@/lib/auth'
import { showToast } from '@/lib/toast'
import {
  DashboardBackLink,
  DashboardLoading,
  DashboardPage,
  detailRowClass,
  heroCtaClass,
  heroSecondaryBtnClass,
  panelCtaClass,
} from '@/components/dashboard-page'

function statusStyles(status: string, forAdmin = false) {
  const display = forAdmin && status === 'revision-sent' ? 'awaiting-approval' : status
  switch (display) {
    case 'approved':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200'
    case 'revision-requested':
      return 'bg-amber-50 text-amber-900 border-amber-200'
    case 'revision-sent':
      return 'bg-sky-50 text-sky-800 border-sky-200'
    case 'awaiting-approval':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

export default function ViewArtworkPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ? String(params.id) : ''
  const user = getStoredUser()
  const staff = isStaffOrAdmin(user)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [artwork, setArtwork] = useState<ArtworkItem | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!id || id === 'undefined') return
    setLoading(true)
    setLoadError('')
    void artworksApi
      .get(id)
      .then(setArtwork)
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Failed to load artwork'
        setArtwork(null)
        setLoadError(message)
        showToast(message, 'error')
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleStatusChange = async (status: string) => {
    if (!artwork || !staff) return
    setBusy(true)
    try {
      const updated = await artworksApi.update(artwork.id, { status })
      setArtwork(updated)
      showToast(
        status === 'approved'
          ? 'Artwork approved — order moved to In Production'
          : status === 'revision-requested'
            ? 'Revision requested — customer can upload a revised file'
            : 'Artwork status updated',
        'success',
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update status'
      showToast(message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <DashboardLoading message="Loading artwork…" />
  }

  if (!artwork) {
    return (
      <DashboardPage>
        <DashboardBackLink href="/dashboard/artwork">Back to Artwork</DashboardBackLink>
        <div className="rounded-2xl border border-[#d7e8e4] bg-white p-8 shadow-sm">
          <p className="text-sm text-red-600">{loadError || 'Artwork not found.'}</p>
        </div>
      </DashboardPage>
    )
  }

  const locked = artwork.status === 'approved'
  const canDecide =
    staff &&
    !locked &&
    ['awaiting-approval', 'revision-sent', 'waiting', 'review', 'in-design'].includes(artwork.status)
  const canRequestRevisionFromApproved = staff && locked
  const needsCustomerRevision = !staff && !locked && artwork.status === 'revision-requested'

  return (
    <DashboardPage>
      <DashboardBackLink href="/dashboard/artwork">Back to Artwork</DashboardBackLink>

      {needsCustomerRevision && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-bold">Revision requested</p>
          <p className="mt-1">
            Admin asked for changes. Upload a revised file, then status becomes{' '}
            <strong>Revision Send</strong>.
          </p>
          <Link
            href={`/dashboard/artwork/${artwork.id}/edit`}
            className="mt-2 inline-block font-semibold text-[#2d6a5f] underline"
          >
            Upload revision
          </Link>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
        <div className="relative overflow-hidden border-b border-[#d7e8e4] bg-gradient-to-br from-[#0b1722] via-[#14302b] to-[#1f4f47] px-6 py-7 text-white sm:px-8">
          <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute bottom-0 right-24 h-28 w-28 rounded-full bg-[#3d8a7c]/20" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold tracking-wide text-white/90">
                  Artwork
                </span>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${statusStyles(artwork.status, staff)}`}
                >
                  {artworkStatusLabel(artwork.status, staff)}
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {artwork.description || artwork.name || `Artwork #${artwork.id}`}
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/70">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Updated {artwork.date || '—'}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canDecide && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleStatusChange('approved')}
                    className={heroCtaClass}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleStatusChange('revision-requested')}
                    className={heroSecondaryBtnClass}
                  >
                    Revision requested
                  </button>
                </>
              )}
              {canRequestRevisionFromApproved && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleStatusChange('revision-requested')}
                  className={heroSecondaryBtnClass}
                >
                  Request revision
                </button>
              )}
              {!locked && (
                <Link href={`/dashboard/artwork/${id}/edit`} className={heroCtaClass}>
                  <Pencil className="h-4 w-4" />
                  {needsCustomerRevision ? 'Upload revision' : 'Edit'}
                </Link>
              )}
              {locked && !canRequestRevisionFromApproved && (
                <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800">
                  Approved — locked
                </span>
              )}
              {locked && canRequestRevisionFromApproved && (
                <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800">
                  Approved
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 sm:p-8">
          <Metric label="Status" value={artworkStatusLabel(artwork.status, staff)} />
          <Metric
            label="Order"
            value={artwork.orderNumber || (artwork.orderId ? `#${artwork.orderId}` : 'Not linked')}
            highlight={!!artwork.orderId}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
            <div className="flex h-96 items-center justify-center overflow-hidden bg-gradient-to-br from-[#f8fbfa] to-[#e8f3f1]">
              {artwork.imageUrl ? (
                <img
                  src={artwork.imageUrl}
                  alt="Artwork"
                  className="h-full w-full object-contain bg-white"
                />
              ) : (
                <ImageIcon className="h-24 w-24 text-slate-400" />
              )}
            </div>
            <div className="border-t border-[#e2eeeb] p-6 sm:p-8">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">
                Description
              </h2>
              <p className="leading-relaxed text-slate-700">{artwork.description || '—'}</p>
            </div>
          </div>
        </div>

        <div>
          <div className="sticky top-8 overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
            <div className="border-b border-[#e2eeeb] bg-gradient-to-r from-[#e8f3f1] to-white px-6 py-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">
                Artwork details
              </h3>
            </div>
            <div className="space-y-4 p-6">
              <DetailRow label="Status" value={artworkStatusLabel(artwork.status, staff)} />
              <DetailRow label="Last updated" value={artwork.date || '—'} />
              <div className={detailRowClass}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Order</p>
                {artwork.orderId ? (
                  <Link
                    href={`/dashboard/orders/${artwork.orderId}`}
                    className="mt-1 inline-block text-sm font-semibold text-[#2d6a5f] underline"
                  >
                    {artwork.orderNumber || `#${artwork.orderId}`}
                  </Link>
                ) : (
                  <p className="mt-1 text-sm font-medium text-amber-700">Not linked to an order</p>
                )}
              </div>

              {staff && artwork.status === 'approved' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
                  This artwork is approved and locked. It cannot be changed or replaced for this order.
                </div>
              )}

              {!artwork.orderId && !locked && (
                <Link
                  href={`/dashboard/artwork/${artwork.id}/edit`}
                  className={`${panelCtaClass} w-full`}
                >
                  Assign to order
                </Link>
              )}

              {canDecide && (
                <div className="space-y-2 border-t border-[#eef3f1] pt-4">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleStatusChange('approved')}
                    className={`${panelCtaClass} w-full disabled:opacity-60`}
                  >
                    Approve artwork
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleStatusChange('revision-requested')}
                    className="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
                  >
                    Request revision
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardPage>
  )
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        highlight
          ? 'border-[#c5e4de] bg-gradient-to-br from-[#e8f3f1] to-white'
          : 'border-[#e2eeeb] bg-[#f8fbfa]'
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 font-bold tracking-tight text-slate-900 ${highlight ? 'text-xl' : 'text-lg'}`}>
        {value}
      </p>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={detailRowClass}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}
