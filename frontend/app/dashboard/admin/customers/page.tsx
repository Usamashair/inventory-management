'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Edit3, Plus, Search, Trash2, UserRound } from 'lucide-react'
import ConfirmDialog from '@/components/confirm-dialog'
import TableLoader from '@/components/table-loader'
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
import { deleteCustomer, loadCustomers } from '@/lib/portal-data'
import type { Customer } from '@/lib/portal-data'
import { getStoredUser, isStaffOrAdmin, roleLabel } from '@/lib/auth'
import { showToast } from '@/lib/toast'

export default function CustomersPage() {
  const currentUser = getStoredUser()
  const canManageCustomers = isStaffOrAdmin(currentUser)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [query, setQuery] = useState('')
  const [cityFilter, setCityFilter] = useState('all')
  const [profileFilter, setProfileFilter] = useState<'all' | 'complete' | 'incomplete'>('all')
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)

    const load = async () => {
      try {
        const data = await loadCustomers()
        if (active) setCustomers(data)
      } catch (err) {
        if (active) {
          showToast(err instanceof Error ? err.message : 'Failed to load customers', 'error')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  const cities = useMemo(() => {
    const unique = new Set(
      customers.map((customer) => customer.city?.trim()).filter((city): city is string => Boolean(city)),
    )
    return Array.from(unique).sort((a, b) => a.localeCompare(b))
  }, [customers])

  const filteredCustomers = useMemo(() => {
    const search = query.trim().toLowerCase()
    return customers.filter((customer) => {
      if (cityFilter !== 'all' && customer.city?.trim() !== cityFilter) return false

      const hasContact = Boolean(customer.phone?.trim())
      const hasAddress = Boolean(customer.address?.trim() && customer.city?.trim() && customer.postCode?.trim())
      const complete = hasContact && hasAddress
      if (profileFilter === 'complete' && !complete) return false
      if (profileFilter === 'incomplete' && complete) return false

      if (!search) return true
      return [
        customer.name,
        customer.email,
        customer.address,
        customer.city,
        customer.postCode,
        customer.phone,
      ].some((value) => value.toLowerCase().includes(search))
    })
  }, [customers, query, cityFilter, profileFilter])

  const filtersActive = query.trim() !== '' || cityFilter !== 'all' || profileFilter !== 'all'

  const clearFilters = () => {
    setQuery('')
    setCityFilter('all')
    setProfileFilter('all')
  }

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return
    if (Number(currentUser?.id) === Number(customerToDelete.id)) {
      showToast('You cannot delete your own account', 'error')
      setCustomerToDelete(null)
      return
    }
    if (!canManageCustomers) {
      showToast('You do not have permission to delete customers', 'error')
      setCustomerToDelete(null)
      return
    }
    setDeleting(true)

    try {
      await deleteCustomer(customerToDelete.id)
      setCustomers((current) =>
        current.filter((customer) => customer.id !== customerToDelete.id),
      )
      setCustomerToDelete(null)
      showToast('Customer deleted successfully', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete customer', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <DashboardPage maxWidth="full">
      <DashboardHero
        eyebrow={roleLabel(getStoredUser())}
        title="Customer Management"
        description="Create and manage customer portal accounts."
        actions={
          <Link href="/dashboard/admin/customers/add" className={heroCtaClass}>
            <Plus className="h-4 w-4" />
            Add Customer
          </Link>
        }
      />

      <DashboardFilters>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block text-sm xl:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Search
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, email, city, phone…"
                className="w-full rounded-lg border border-[#d7e8e4] bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#2d6a5f]"
              />
            </div>
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              City
            </span>
            <select
              value={cityFilter}
              onChange={(event) => setCityFilter(event.target.value)}
              className="w-full rounded-lg border border-[#d7e8e4] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2d6a5f]"
            >
              <option value="all">All cities</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Profile
            </span>
            <select
              value={profileFilter}
              onChange={(event) =>
                setProfileFilter(event.target.value as 'all' | 'complete' | 'incomplete')
              }
              className="w-full rounded-lg border border-[#d7e8e4] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2d6a5f]"
            >
              <option value="all">All profiles</option>
              <option value="complete">Complete</option>
              <option value="incomplete">Incomplete</option>
            </select>
          </label>
        </div>
        {filtersActive && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-semibold text-[#2d6a5f] hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </DashboardFilters>

      <DashboardPanel
        title="Customers"
        description={
          loading
            ? 'Loading…'
            : `${filteredCustomers.length} customer${filteredCustomers.length === 1 ? '' : 's'}`
        }
        noPadding
        footer={`Showing ${loading ? 0 : filteredCustomers.length} customers`}
      >
        <div className="rx-scroll max-h-[32rem] overflow-auto">
          <table className="min-w-[1200px] w-full text-left">
            <thead className="sticky top-0 z-10">
              <tr className={tableHeadRow}>
                {['Name', 'Email', 'Address', 'Password', 'City', 'Post Code', 'Phone', 'Actions'].map(
                  (column) => (
                    <th
                      key={column}
                      className={`${tableHeadCellClass} ${column === 'Actions' ? 'text-right' : ''}`}
                    >
                      {column}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoader colSpan={8} />
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className={tableRowClass}>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e8f3f1] text-[#2d6a5f]">
                          <UserRound className="h-4 w-4" />
                        </span>
                        <span className="text-sm font-bold text-[#0f1c24]">{customer.name}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{customer.email}</td>
                    <td className="max-w-[240px] px-6 py-4 text-sm text-slate-600">{customer.address}</td>
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-sm tracking-widest text-slate-500">
                      ••••••••
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{customer.city}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{customer.postCode}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{customer.phone}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/dashboard/admin/customers/${customer.id}/edit`}
                          title="Edit customer"
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-[#e8f3f1] hover:text-[#2d6a5f]"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Link>
                        {Number(currentUser?.id) !== Number(customer.id) && canManageCustomers ? (
                          <button
                            type="button"
                            onClick={() => setCustomerToDelete(customer)}
                            title="Delete customer"
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filteredCustomers.length === 0 && (
          <div className="p-12 text-center text-sm text-slate-500">No customers found.</div>
        )}
      </DashboardPanel>

      <ConfirmDialog
        open={Boolean(customerToDelete)}
        title="Delete Customer"
        message={`Are you sure you want to delete ${customerToDelete?.name || 'this customer'}? This action cannot be undone.`}
        confirmLabel="Delete Customer"
        loading={deleting}
        onCancel={() => setCustomerToDelete(null)}
        onConfirm={() => void handleDeleteCustomer()}
      />
    </DashboardPage>
  )
}
