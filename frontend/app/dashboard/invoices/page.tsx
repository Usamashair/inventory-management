'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Trash2,
  Eye,
  Download,
  FileText,
  Clock3,
  BadgeCheck,
  AlertTriangle,
} from 'lucide-react'
import ConfirmDialog from '@/components/confirm-dialog'
import TableLoader from '@/components/table-loader'
import {
  DashboardHero,
  DashboardPage,
  DashboardPanel,
  tableHeadCellClass,
  tableHeadRow,
  tableRowClass,
} from '@/components/dashboard-page'
import { InvoiceItem, invoicesApi } from '@/lib/resources'
import { downloadInvoice } from '@/lib/invoice-download'
import { showToast } from '@/lib/toast'

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [itemToDelete, setItemToDelete] = useState<InvoiceItem | null>(null)

  const handleDownload = async (invoice: InvoiceItem) => {
    setDownloadingId(invoice.id)
    try {
      const full = await invoicesApi.get(invoice.id)
      await downloadInvoice(full)
      void invoicesApi.recordDownload(invoice.id).catch(() => undefined)
      showToast('Invoice PDF downloaded', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to download invoice', 'error')
    } finally {
      setDownloadingId(null)
    }
  }

  useEffect(() => {
    let active = true
    void invoicesApi
      .list()
      .then((data) => {
        if (active) setInvoices(data)
      })
      .catch((err) => {
        if (active) {
          const message = err instanceof Error ? err.message : 'Failed to load invoices'
          showToast(message, 'error')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'partially-paid':
        return 'bg-[#d5ebe7] text-[#1f4a45]'
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'overdue':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatStatus = (status: string) => {
    const labels: Record<string, string> = {
      draft: 'Draft',
      pending: 'Pending',
      'partially-paid': 'Partially Paid',
      paid: 'Paid',
      overdue: 'Overdue',
    }
    return labels[status] || status.replace(/-/g, ' ')
  }

  const handleDelete = async () => {
    if (!itemToDelete) return
    setDeleting(true)

    try {
      await invoicesApi.remove(itemToDelete.id)
      setInvoices((current) => current.filter((i) => i.id !== itemToDelete.id))
      setItemToDelete(null)
      showToast('Invoice deleted successfully', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete invoice'
      showToast(message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const parseMoney = (value: string) => {
    const amount = Number.parseFloat(String(value || '0').replace(/[^0-9.-]/g, ''))
    return Number.isFinite(amount) ? amount : 0
  }

  const totalOutstanding = invoices
    .filter((i) => ['pending', 'overdue', 'partially-paid'].includes(i.status))
    .reduce((sum, i) => sum + Math.max(0, parseMoney(i.amount) - parseMoney(i.paid)), 0)

  const paidInvoices = invoices.filter((i) => i.status === 'paid')
  const paidTotal = paidInvoices.reduce((sum, i) => sum + parseMoney(i.paid || i.amount), 0)
  const overdueInvoices = invoices.filter((i) => i.status === 'overdue')
  const overdueTotal = overdueInvoices.reduce(
    (sum, i) => sum + Math.max(0, parseMoney(i.amount) - parseMoney(i.paid)),
    0,
  )

  const stats = [
    {
      label: 'Total invoices',
      value: String(invoices.length),
      hint: 'All invoices',
      icon: FileText,
    },
    {
      label: 'Outstanding',
      value: `$${totalOutstanding.toFixed(2)}`,
      hint: totalOutstanding > 0 ? 'Action needed' : 'All clear',
      icon: Clock3,
      warn: totalOutstanding > 0,
    },
    {
      label: 'Paid',
      value: `$${paidTotal.toFixed(2)}`,
      hint: `${paidInvoices.length} invoices`,
      icon: BadgeCheck,
    },
    {
      label: 'Overdue',
      value: String(overdueInvoices.length),
      hint: `$${overdueTotal.toFixed(2)}`,
      icon: AlertTriangle,
      warn: overdueInvoices.length > 0,
    },
  ]

  return (
    <DashboardPage>
      <DashboardHero
        eyebrow="Invoices"
        title="Invoice management"
        description="Invoices are created automatically when an order is delivered."
        stats={stats}
      />

      <DashboardPanel
        title="All invoices"
        description={loading ? 'Loading…' : `${invoices.length} invoice${invoices.length === 1 ? '' : 's'}`}
        noPadding
        footer={`Showing ${invoices.length} invoice${invoices.length === 1 ? '' : 's'}`}
      >
          <div className="rx-scroll max-h-[32rem] overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className={tableHeadRow}>
                  <th className={tableHeadCellClass}>Invoice no.</th>
                  <th className={tableHeadCellClass}>Customer</th>
                  <th className={tableHeadCellClass}>Order</th>
                  <th className={tableHeadCellClass}>Date</th>
                  <th className={tableHeadCellClass}>Due date</th>
                  <th className={tableHeadCellClass}>Amount</th>
                  <th className={tableHeadCellClass}>Status</th>
                  <th className={tableHeadCellClass}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableLoader colSpan={8} />
                ) : (
                  invoices.map((invoice) => (
                    <tr key={invoice.id} className={tableRowClass}>
                      <td className="px-6 py-4">
                        <Link
                          href={`/dashboard/invoices/${invoice.id}`}
                          className="font-bold text-[#1f4f47] hover:underline"
                        >
                          {invoice.invoiceNo}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{invoice.customer || '—'}</td>
                      <td className="px-6 py-4 text-sm">
                        {invoice.orderId ? (
                          <Link
                            href={`/dashboard/orders/${invoice.orderId}`}
                            className="font-semibold text-[#2d6a5f] underline"
                          >
                            {invoice.orderNumber || `#${invoice.orderId}`}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{invoice.date}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{invoice.dueDate}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">{invoice.amount}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(invoice.status)}`}>
                          {formatStatus(invoice.status).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/invoices/${invoice.id}`}
                            className="rounded-lg p-2 text-slate-600 transition hover:bg-[#e8f3f1] hover:text-[#2d6a5f]"
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => void handleDownload(invoice)}
                            disabled={downloadingId === invoice.id}
                            className="rounded-lg p-2 text-[#2d6a5f] transition hover:bg-[#e8f3f1] disabled:opacity-50"
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setItemToDelete(invoice)}
                            className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
                {!loading && invoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-14 text-center text-sm text-slate-500">
                      No invoices found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
      </DashboardPanel>

      <ConfirmDialog
        open={Boolean(itemToDelete)}
        title="Delete Invoice"
        message={`Are you sure you want to delete ${itemToDelete?.invoiceNo || 'this invoice'}? This action cannot be undone.`}
        confirmLabel="Delete Invoice"
        loading={deleting}
        onCancel={() => setItemToDelete(null)}
        onConfirm={handleDelete}
      />
    </DashboardPage>
  )
}
