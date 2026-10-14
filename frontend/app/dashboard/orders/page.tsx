'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Trash2,
  Eye,
  ChevronRight,
  Package,
  Factory,
  Truck,
  DollarSign,
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
import { OrderItem, ordersApi } from '@/lib/resources'
import { advanceOrderLabel, formatOrderStatus, nextOrderStatus } from '@/lib/order-status'
import { getStoredUser, isStaffOrAdmin } from '@/lib/auth'
import { showToast } from '@/lib/toast'

export default function OrdersPage() {
  const staff = isStaffOrAdmin(getStoredUser())
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<OrderItem | null>(null)
  const [advancingId, setAdvancingId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void ordersApi
      .list()
      .then((data) => {
        if (active) setOrders(data)
      })
      .catch((err) => {
        if (active) {
          const message = err instanceof Error ? err.message : 'Failed to load orders'
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
      case 'waiting-for-artwork':
      case 'pending':
        return 'bg-amber-100 text-amber-800'
      case 'in-production':
        return 'bg-[#d5ebe7] text-[#1f4a45]'
      case 'in-transit':
      case 'ready':
      case 'shipped':
        return 'bg-yellow-100 text-yellow-800'
      case 'delivered':
      case 'completed':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDelivery = (order: OrderItem) => {
    if (order.deliveryType === 'warehouse') {
      return order.deliveryWarehouse || order.warehouseLocation || 'Warehouse'
    }
    if (order.deliveryType === 'customer_address') {
      return order.deliveryAddress || 'Customer address'
    }
    return order.deliveryDate || '—'
  }

  const handleDelete = async () => {
    if (!itemToDelete) return
    setDeleting(true)

    try {
      await ordersApi.remove(itemToDelete.id)
      setOrders((current) => current.filter((o) => o.id !== itemToDelete.id))
      setItemToDelete(null)
      showToast('Order deleted successfully', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete order'
      showToast(message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleAdvance = async (order: OrderItem) => {
    const next = nextOrderStatus(order.status)
    if (!next) return
    setAdvancingId(order.id)
    try {
      const updated = await ordersApi.advance(order.id)
      setOrders((current) => current.map((item) => (item.id === order.id ? { ...item, ...updated } : item)))
      if (next === 'delivered') {
        showToast(
          order.deliveryType === 'warehouse'
            ? `Marked ${formatOrderStatus(next)} — stock/invoice updated if needed`
            : `Marked ${formatOrderStatus(next)} — invoice created if needed`,
          'success',
        )
      } else {
        showToast(`Marked ${formatOrderStatus(next)}`, 'success')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to advance status'
      showToast(message, 'error')
    } finally {
      setAdvancingId(null)
    }
  }

  const parseMoney = (value: string) => {
    const amount = Number.parseFloat(value.replace(/[^0-9.-]/g, ''))
    return Number.isFinite(amount) ? amount : 0
  }

  const totalOrders = orders.length
  const inProduction = orders.filter((o) => o.status === 'in-production').length
  const inTransit = orders.filter((o) => ['in-transit', 'ready', 'shipped'].includes(o.status)).length
  const totalValue = orders.reduce((sum, o) => sum + parseMoney(o.value), 0)

  const stats = [
    {
      label: 'Total orders',
      value: String(totalOrders),
      hint: 'All orders',
      icon: Package,
    },
    {
      label: 'In production',
      value: String(inProduction),
      hint: 'Active',
      icon: Factory,
    },
    {
      label: 'In transit',
      value: String(inTransit),
      hint: 'On the way',
      icon: Truck,
      warn: inTransit > 0,
    },
    {
      label: 'Total value',
      value: `$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      hint: 'All orders',
      icon: DollarSign,
    },
  ]

  return (
    <DashboardPage>
      <DashboardHero
        eyebrow="Orders"
        title="Order management"
        description="Orders are created when a customer accepts a quotation. Track production and delivery here."
        stats={stats}
      />

      <DashboardPanel
        title="All orders"
        description={loading ? 'Loading…' : `${orders.length} order${orders.length === 1 ? '' : 's'}`}
        noPadding
        footer={`Showing ${orders.length} order${orders.length === 1 ? '' : 's'}`}
      >
          <div className="rx-scroll max-h-[32rem] overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className={tableHeadRow}>
                  <th className={tableHeadCellClass}>Order ID</th>
                  <th className={tableHeadCellClass}>Date</th>
                  <th className={tableHeadCellClass}>Customer</th>
                  <th className={tableHeadCellClass}>Value</th>
                  <th className={tableHeadCellClass}>Status</th>
                  <th className={tableHeadCellClass}>Delivery to</th>
                  <th className={tableHeadCellClass}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableLoader colSpan={7} />
                ) : (
                  orders.map((order) => {
                    const advanceLabel = staff ? advanceOrderLabel(order.status) : null
                    const canAdvance =
                      !!advanceLabel &&
                      !(
                        order.status === 'waiting-for-artwork' &&
                        !(order.artworkId && order.artworkStatus === 'approved')
                      )

                    return (
                      <tr key={order.id} className={tableRowClass}>
                        <td className="px-6 py-4">
                          <Link
                            href={`/dashboard/orders/${order.id}`}
                            className="font-bold text-[#1f4f47] hover:underline"
                          >
                            {order.orderId}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{order.date}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{order.customer || '—'}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900">{order.value}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-2">
                            <span
                              className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusColor(order.status)}`}
                            >
                              {formatOrderStatus(order.status)}
                            </span>
                            {staff && canAdvance && (
                              <button
                                type="button"
                                disabled={advancingId === order.id}
                                onClick={() => void handleAdvance(order)}
                                className="inline-flex w-fit items-center gap-1 rounded-lg bg-[#2d6a5f] px-2.5 py-1.5 text-xs font-bold text-white hover:bg-[#245750] disabled:opacity-60"
                              >
                                {advancingId === order.id ? 'Updating…' : advanceLabel}
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {staff && order.status === 'waiting-for-artwork' && !canAdvance && (
                              <span className="text-[11px] text-amber-700">Approve artwork first</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          <div>
                            <p className="text-sm">{formatDelivery(order)}</p>
                            {order.deliveryDate ? (
                              <p className="mt-0.5 text-xs text-slate-400">{order.deliveryDate}</p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/dashboard/orders/${order.id}`}
                              className="rounded-lg p-2 text-slate-600 transition hover:bg-[#e8f3f1] hover:text-[#2d6a5f]"
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            {staff && (
                              <button
                                onClick={() => setItemToDelete(order)}
                                className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
                {!loading && orders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-14 text-center text-sm text-slate-500">
                      No orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
      </DashboardPanel>

      <ConfirmDialog
        open={Boolean(itemToDelete)}
        title="Delete Order"
        message={`Are you sure you want to delete ${itemToDelete?.orderId || 'this order'}? This action cannot be undone.`}
        confirmLabel="Delete Order"
        loading={deleting}
        onCancel={() => setItemToDelete(null)}
        onConfirm={handleDelete}
      />
    </DashboardPage>
  )
}
