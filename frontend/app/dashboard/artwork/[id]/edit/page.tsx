'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ImageIcon, Trash2, Upload, UserRound } from 'lucide-react'
import { OrderItem, artworksApi, fileToBase64, ordersApi } from '@/lib/resources'
import { loadCustomers } from '@/lib/portal-data'
import type { Customer } from '@/lib/portal-data'
import { getStoredUser, isStaffOrAdmin } from '@/lib/auth'
import { showToast } from '@/lib/toast'
import { ADMIN_ARTWORK_STATUSES, adminArtworkStatusValue } from '@/components/status-select'
import {
  DashboardBackLink,
  DashboardPage,
  detailRowClass,
  fieldHintClass,
  fieldLabelClass,
  fieldSelectClass,
  fieldTextareaClass,
  panelCtaClass,
  secondaryBtnClass,
} from '@/components/dashboard-page'

export default function EditArtworkPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id ? String(params.id) : ''
  const user = getStoredUser()
  const isAdmin = isStaffOrAdmin(user)
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [eligibleOrders, setEligibleOrders] = useState<OrderItem[]>([])
  const [customerId, setCustomerId] = useState('')
  const [linkedOrderId, setLinkedOrderId] = useState<string | null>(null)
  const [linkedOrderNumber, setLinkedOrderNumber] = useState('')
  const [assignOrderId, setAssignOrderId] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('awaiting-approval')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [locked, setLocked] = useState(false)
  const isRevision = status === 'revision-requested' && !isAdmin
  const imagePreviewUrl = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : null),
    [imageFile],
  )

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    }
  }, [imagePreviewUrl])

  useEffect(() => {
    if (!id || id === 'undefined') return

    const load = async () => {
      try {
        if (isAdmin) {
          setCustomers(await loadCustomers())
        }
        const artwork = await artworksApi.get(id)
        if (artwork.status === 'approved') {
          setLocked(true)
          showToast('Approved artwork cannot be changed', 'error')
          router.replace(`/dashboard/artwork/${id}`)
          return
        }
        setDescription(artwork.description || '')
        setStatus(artwork.status || 'awaiting-approval')
        setImageUrl(artwork.imageUrl || null)
        setCustomerId(artwork.customerId ? String(artwork.customerId) : '')
        setLinkedOrderId(artwork.orderId || null)
        setLinkedOrderNumber(artwork.orderNumber || '')

        if (!artwork.orderId) {
          const all = await ordersApi.list()
          setEligibleOrders(all.filter((o) => o.status === 'waiting-for-artwork' && !o.artworkId))
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load artwork'
        showToast(message, 'error')
      }
    }

    void load()
  }, [id, isAdmin, router])

  const selectedCustomer = useMemo(
    () => customers.find((c) => String(c.id) === customerId) || null,
    [customers, customerId],
  )

  const assignedOrder = useMemo(
    () => eligibleOrders.find((o) => o.id === assignOrderId) || null,
    [eligibleOrders, assignOrderId],
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || id === 'undefined' || locked) return
    if (status === 'approved') {
      showToast('Approved artwork cannot be changed', 'error')
      return
    }
    if (isAdmin && !customerId && !assignOrderId) {
      showToast('Please select a customer', 'error')
      return
    }
    if (!linkedOrderId && !assignOrderId) {
      showToast('Please assign this artwork to an order waiting for artwork', 'error')
      return
    }
    if (isRevision && !imageFile) {
      showToast('Please upload the revised artwork file', 'error')
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        description,
        remove_image: removeImage,
      }
      if (isAdmin) {
        payload.customerId = Number(customerId)
        payload.status = status
      }
      if (!linkedOrderId && assignOrderId) {
        payload.orderId = Number(assignOrderId)
      }
      if (imageFile) {
        payload.image = await fileToBase64(imageFile)
      }
      await artworksApi.update(id, payload)
      showToast(
        isRevision
          ? 'Revision sent — waiting for admin review'
          : !linkedOrderId && assignOrderId
            ? 'Artwork linked to order successfully'
            : 'Artwork updated successfully',
        'success',
      )
      router.push(`/dashboard/artwork/${id}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update artwork'
      showToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const statusLabel =
    ADMIN_ARTWORK_STATUSES.find((option) => option.value === adminArtworkStatusValue(status))?.label ||
    status.replace(/-/g, ' ')

  return (
    <DashboardPage>
      <DashboardBackLink href="/dashboard/artwork">Back to Artwork</DashboardBackLink>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
          <div className="relative overflow-hidden border-b border-[#d7e8e4] bg-gradient-to-br from-[#0b1722] via-[#14302b] to-[#1f4f47] px-6 py-7 text-white sm:px-8">
            <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/5" />
            <div className="pointer-events-none absolute bottom-0 right-24 h-28 w-28 rounded-full bg-[#3d8a7c]/20" />

            <div className="relative">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold tracking-wide text-white/90">
                  Artwork
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {isRevision ? 'Revision' : 'Edit'}
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {isRevision ? 'Send artwork revision' : 'Edit artwork'}
              </h1>
              <p className="mt-2 text-sm text-white/70">
                {isRevision
                  ? 'Upload the revised file. Your status will show as Revision Send.'
                  : isAdmin
                    ? 'Update image, description and status.'
                    : 'Update image and description.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3 sm:p-8">
            <Metric label="Order" value={linkedOrderNumber || assignedOrder?.orderId || '—'} />
            <Metric label="Customer" value={selectedCustomer?.name || '—'} />
            <Metric label="Status" value={statusLabel} highlight />
          </div>
        </div>

        {isRevision && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Admin requested a revision. Upload a new file to mark this as{' '}
            <strong>Revision Send</strong>.
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
              <div className="border-b border-[#e2eeeb] px-6 py-5">
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">
                  <ImageIcon className="h-4 w-4" />
                  Artwork image
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {isRevision ? 'Upload the revised artwork file.' : 'Replace or remove the current image.'}
                </p>
              </div>
              <div className="space-y-4 p-6 sm:p-8">
                <div>
                  <label className={fieldLabelClass}>
                    {imageFile ? 'New image preview' : 'Current image'}
                  </label>
                  {(imagePreviewUrl || (imageUrl && !removeImage)) ? (
                    <div className="mb-3 flex items-start gap-3">
                      <img
                        src={imagePreviewUrl || imageUrl!}
                        alt="Artwork"
                        className="h-28 w-28 rounded-xl object-cover"
                      />
                      {!imageFile && (
                        <button
                          type="button"
                          onClick={() => {
                            setRemoveImage(true)
                            setImageUrl(null)
                          }}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="mb-3 text-sm text-slate-500">No image attached.</p>
                  )}
                </div>

                <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#d7e8e4] bg-[#f8fbfa] px-6 py-10 transition hover:border-[#2d6a5f] hover:bg-[#e8f3f1]/50">
                  <Upload className="mb-2 h-7 w-7 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-900">
                    {isRevision ? 'Upload revised artwork *' : 'Upload new image'}
                  </p>
                  {imageFile && <p className="mt-2 text-sm text-slate-600">{imageFile.name}</p>}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null
                      setImageFile(file)
                      setRemoveImage(false)
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
              <div className="border-b border-[#e2eeeb] px-6 py-5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">Description</h2>
              </div>
              <div className="p-6 sm:p-8">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  className={fieldTextareaClass}
                  placeholder="Notes about this artwork…"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="sticky top-8 space-y-6">
              <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
                <div className="border-b border-[#e2eeeb] bg-gradient-to-r from-[#e8f3f1] to-white px-6 py-5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">
                    Order & details
                  </h3>
                </div>
                <div className="space-y-4 p-6">
                  {linkedOrderId ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                      Linked to order{' '}
                      <Link
                        href={`/dashboard/orders/${linkedOrderId}`}
                        className="font-semibold text-[#2d6a5f] underline"
                      >
                        {linkedOrderNumber || `#${linkedOrderId}`}
                      </Link>
                    </div>
                  ) : (
                    <div>
                      <label className={fieldLabelClass}>Assign to order *</label>
                      <p className="mb-2 text-xs text-amber-700">
                        This artwork is not linked to any order yet.
                      </p>
                      {eligibleOrders.length === 0 ? (
                        <p className="text-sm text-slate-500">No orders are currently waiting for artwork.</p>
                      ) : (
                        <select
                          value={assignOrderId}
                          onChange={(e) => setAssignOrderId(e.target.value)}
                          required
                          className={fieldSelectClass}
                        >
                          <option value="">Select an order…</option>
                          {eligibleOrders.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.orderId}
                              {o.product ? ` — ${o.product}` : ''}
                              {o.customer ? ` (${o.customer})` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {isAdmin && (
                    <div>
                      <label className={fieldLabelClass}>Customer</label>
                      <select
                        value={customerId}
                        onChange={(e) => setCustomerId(e.target.value)}
                        required={!assignOrderId}
                        className={fieldSelectClass}
                      >
                        <option value="">Select a customer</option>
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name} ({customer.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {isAdmin && (
                    <div>
                      <label className={fieldLabelClass}>Status</label>
                      <select
                        value={adminArtworkStatusValue(status)}
                        onChange={(e) => setStatus(e.target.value)}
                        className={fieldSelectClass}
                      >
                        {ADMIN_ARTWORK_STATUSES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className={fieldHintClass}>Changing status may affect the linked order workflow.</p>
                    </div>
                  )}

                  {(linkedOrderId || assignedOrder) && (
                    <div className="rounded-2xl border border-[#d7e8e4] bg-[#f8fbfa] p-4">
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2d6a5f] text-white">
                          <UserRound className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {linkedOrderNumber || assignedOrder?.orderId || 'Order'}
                          </p>
                          <p className="text-xs font-medium text-[#2d6a5f]">Order summary</p>
                        </div>
                      </div>
                      <div className={detailRowClass}>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Product</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {assignedOrder?.product || '—'}
                        </p>
                      </div>
                    </div>
                  )}

                  {!isAdmin && (
                    <div className={detailRowClass}>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{statusLabel}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className={`${panelCtaClass} w-full justify-center disabled:opacity-60`}
                >
                  {saving ? 'Saving…' : isRevision ? 'Send revision' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/artwork/${id}`)}
                  className={`${secondaryBtnClass} w-full`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
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
      <p className={`mt-2 font-bold tracking-tight text-slate-900 ${highlight ? 'text-2xl' : 'text-lg'}`}>
        {value}
      </p>
    </div>
  )
}
