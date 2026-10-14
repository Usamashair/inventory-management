'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Calendar, CheckCircle2, Download, UserRound } from 'lucide-react'
import { InvoiceItem, invoicesApi } from '@/lib/resources'
import { downloadInvoice } from '@/lib/invoice-download'
import { showToast } from '@/lib/toast'
import { getStoredUser, isStaffOrAdmin } from '@/lib/auth'
import {
  DashboardBackLink,
  DashboardLoading,
  DashboardPage,
  detailRowClass,
  panelCtaClass,
  tableHeadCellClass,
  tableHeadRow,
} from '@/components/dashboard-page'

function money(value: string | undefined) {
  const n = Number.parseFloat(String(value || '0').replace(/[^0-9.-]/g, ''))
  return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`
}

function statusStyles(status: string) {
  switch (status) {
    case 'paid':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200'
    case 'overdue':
      return 'bg-red-50 text-red-800 border-red-200'
    case 'partially-paid':
      return 'bg-amber-50 text-amber-900 border-amber-200'
    case 'draft':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    default:
      return 'bg-amber-50 text-amber-900 border-amber-200'
  }
}

function formatStatus(status: string) {
  return status.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function ViewInvoicePage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ? String(params.id) : ''
  const [loading, setLoading] = useState(true)
  const [invoice, setInvoice] = useState<InvoiceItem | null>(null)

  useEffect(() => {
    if (!id || id === 'undefined') return
    setLoading(true)
    void invoicesApi
      .get(id)
      .then(setInvoice)
      .catch((error) => {
        showToast(error instanceof Error ? error.message : 'Failed to load invoice', 'error')
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading || !invoice) {
    return <DashboardLoading message="Loading invoice…" />
  }

  const lineItems =
    invoice.lineItems && invoice.lineItems.length > 0
      ? invoice.lineItems
      : [
          {
            id: 'summary',
            description: invoice.description || invoice.invoiceNo,
            quantity: String(invoice.items || 1),
            unitPrice: invoice.amount,
            total: invoice.amount,
          },
        ]

  const statusLabel = formatStatus(invoice.status)
  const balance = invoice.balance || invoice.amount
  const canMarkPaid = isStaffOrAdmin(getStoredUser()) && invoice.status !== 'paid'

  const handleDownload = async () => {
    try {
      await downloadInvoice(invoice)
      void invoicesApi.recordDownload(invoice.id).catch(() => undefined)
      showToast('Invoice PDF downloaded', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to download PDF', 'error')
    }
  }

  const handleMarkPaid = async () => {
    try {
      const updated = await invoicesApi.markPaid(invoice.id)
      setInvoice(updated)
      showToast('Invoice marked as paid', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to mark invoice as paid', 'error')
    }
  }

  return (
    <DashboardPage>
      <DashboardBackLink href="/dashboard/invoices">Back to Invoices</DashboardBackLink>

      <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
        <div className="relative overflow-hidden border-b border-[#d7e8e4] bg-gradient-to-br from-[#0b1722] via-[#14302b] to-[#1f4f47] px-6 py-7 text-white sm:px-8">
          <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute bottom-0 right-24 h-28 w-28 rounded-full bg-[#3d8a7c]/20" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold tracking-wide text-white/90">
                  Invoice
                </span>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${statusStyles(invoice.status)}`}
                >
                  {statusLabel}
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {invoice.invoiceNo || `Invoice #${invoice.id}`}
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/70">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Issued {invoice.issueDate || invoice.date || '—'}
                </span>
                <span className="hidden text-white/30 sm:inline">·</span>
                <span>Due {invoice.dueDate || '—'}</span>
                {invoice.customer ? (
                  <>
                    <span className="hidden text-white/30 sm:inline">·</span>
                    <span className="inline-flex items-center gap-1.5">
                      <UserRound className="h-3.5 w-3.5" />
                      {invoice.customer}
                    </span>
                  </>
                ) : null}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {canMarkPaid ? (
                <button
                  type="button"
                  onClick={() => void handleMarkPaid()}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/15"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Mark paid
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void handleDownload()}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#1f4f47] shadow-sm transition hover:bg-[#e8f3f1]"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3 sm:p-8">
          <Metric label="Amount" value={money(invoice.amount)} />
          <Metric label="Amount paid" value={money(invoice.paid)} />
          <Metric label="Balance due" value={money(balance)} highlight />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
            <div className="border-b border-[#e2eeeb] px-6 py-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">
                Invoice details
              </h2>
            </div>
            <div className="p-6 sm:p-8">
              <div className="mb-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Billed to
                  </p>
                  <p className="font-semibold text-slate-900">{invoice.customer || 'Customer'}</p>
                  {invoice.customerEmail && (
                    <p className="mt-1 text-sm text-slate-600">{invoice.customerEmail}</p>
                  )}
                  {invoice.customerPhone && (
                    <p className="text-sm text-slate-600">{invoice.customerPhone}</p>
                  )}
                  {invoice.customerAddress && (
                    <p className="mt-1 text-sm text-slate-600">{invoice.customerAddress}</p>
                  )}
                  {invoice.orderId && (
                    <Link
                      href={`/dashboard/orders/${invoice.orderId}`}
                      className="mt-2 inline-block text-sm font-semibold text-[#2d6a5f] underline"
                    >
                      Order {invoice.orderNumber || `#${invoice.orderId}`}
                    </Link>
                  )}
                </div>
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">From</p>
                  <div className="inline-flex items-center rounded-xl bg-[#0b1722] px-3 py-2">
                    <img
                      src="/rexapack-logo.png"
                      alt="Rexapack"
                      className="h-7 w-auto max-w-[150px] object-contain object-left"
                    />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">Packaging &amp; fulfillment</p>
                </div>
              </div>

              {invoice.description && (
                <p className="mb-6 text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">Description: </span>
                  {invoice.description}
                </p>
              )}

              <div className="rx-scroll max-h-[32rem] overflow-auto border-t border-[#e2eeeb] pt-6">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className={tableHeadRow}>
                      <th className={tableHeadCellClass}>Description</th>
                      <th className={tableHeadCellClass}>SKU</th>
                      <th className={`${tableHeadCellClass} text-right`}>Qty</th>
                      <th className={`${tableHeadCellClass} text-right`}>Unit price</th>
                      <th className={`${tableHeadCellClass} text-right`}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item) => (
                      <tr key={item.id} className="border-b border-[#eef3f1] last:border-0">
                        <td className="px-6 py-4 text-slate-700">{item.description || '—'}</td>
                        <td className="px-6 py-4 text-slate-500">{item.sku || '—'}</td>
                        <td className="px-6 py-4 text-right text-slate-700">{item.quantity}</td>
                        <td className="px-6 py-4 text-right text-slate-700">{money(item.unitPrice)}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900">
                          {money(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <div className="w-full max-w-sm space-y-0">
                  <div className="flex justify-between border-b border-[#e2eeeb] py-3">
                    <span className="text-slate-600">Subtotal</span>
                    <span className="font-semibold text-slate-900">{money(invoice.amount)}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#e2eeeb] py-3">
                    <span className="text-slate-600">Amount paid</span>
                    <span className="font-semibold text-slate-900">{money(invoice.paid)}</span>
                  </div>
                  <div className="flex justify-between py-3 text-lg font-bold text-slate-900">
                    <span>Balance due</span>
                    <span>{money(balance)}</span>
                  </div>
                </div>
              </div>

              {invoice.notes && (
                <div className="mt-6 rounded-xl border border-[#e2eeeb] bg-[#f8fbfa] p-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Notes</p>
                  <p className="whitespace-pre-wrap text-sm text-slate-900">{invoice.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="sticky top-8 overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
            <div className="border-b border-[#e2eeeb] bg-gradient-to-r from-[#e8f3f1] to-white px-6 py-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">
                Invoice status
              </h3>
            </div>
            <div className="space-y-4 p-6">
              <DetailRow label="Status" value={statusLabel} />
              <DetailRow label="Invoice number" value={invoice.invoiceNo || '—'} />
              <DetailRow label="Customer" value={invoice.customer || '—'} />
              {invoice.orderId && (
                <div className={detailRowClass}>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Linked order
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    <Link
                      href={`/dashboard/orders/${invoice.orderId}`}
                      className="text-[#2d6a5f] underline"
                    >
                      {invoice.orderNumber || `#${invoice.orderId}`}
                    </Link>
                  </p>
                </div>
              )}
              <DetailRow label="Due date" value={invoice.dueDate || '—'} />
              <div className="rounded-xl bg-gradient-to-br from-[#1f4f47] to-[#2d6a5f] px-4 py-4 text-white">
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                  Balance due
                </p>
                <p className="mt-1 text-2xl font-bold tracking-tight">{money(balance)}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleDownload()}
                className={`${panelCtaClass} w-full`}
              >
                <Download className="h-4 w-4" />
                Download PDF
              </button>
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
      <p className={`mt-2 font-bold tracking-tight text-slate-900 ${highlight ? 'text-2xl' : 'text-lg'}`}>
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
