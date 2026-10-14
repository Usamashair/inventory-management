'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { deleteTeamUser, loadTeamUsers } from '@/lib/portal-data'
import type { TeamUser, TeamUserRole } from '@/lib/portal-data'
import { getStoredUser, isAdmin, roleLabel } from '@/lib/auth'
import { showToast } from '@/lib/toast'

export default function StaffPage() {
  const router = useRouter()
  const currentUser = getStoredUser()

  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | TeamUserRole>('all')
  const [sortBy, setSortBy] = useState<'name' | 'newest'>('name')
  const [userToDelete, setUserToDelete] = useState<TeamUser | null>(null)

  useEffect(() => {
    if (!isAdmin(getStoredUser())) {
      router.replace('/dashboard')
      return
    }

    let active = true
    setLoading(true)

    const load = async () => {
      try {
        const data = await loadTeamUsers()
        if (active) setTeamUsers(data)
      } catch (err) {
        if (active) {
          showToast(err instanceof Error ? err.message : 'Failed to load staff users', 'error')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [router])

  const filteredUsers = useMemo(() => {
    const search = query.trim().toLowerCase()
    const filtered = teamUsers.filter((user) => {
      if (roleFilter !== 'all' && user.role !== roleFilter) return false
      if (!search) return true
      return [user.name, user.email, user.role, user.phone]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .some((value) => value.toLowerCase().includes(search))
    })

    return filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        const aTime = a.createdAt ? Date.parse(a.createdAt) : 0
        const bTime = b.createdAt ? Date.parse(b.createdAt) : 0
        return bTime - aTime
      }
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [teamUsers, query, roleFilter, sortBy])

  const filtersActive = query.trim() !== '' || roleFilter !== 'all' || sortBy !== 'name'

  const clearFilters = () => {
    setQuery('')
    setRoleFilter('all')
    setSortBy('name')
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return
    if (Number(currentUser?.id) === Number(userToDelete.id)) {
      showToast('You cannot delete your own account', 'error')
      setUserToDelete(null)
      return
    }
    if (!isAdmin(currentUser)) {
      showToast('Only administrators can delete staff accounts', 'error')
      setUserToDelete(null)
      return
    }
    setDeleting(true)

    try {
      await deleteTeamUser(userToDelete.id)
      setTeamUsers((current) => current.filter((user) => user.id !== userToDelete.id))
      setUserToDelete(null)
      showToast('User deleted successfully', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete user', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <DashboardPage maxWidth="full">
      <DashboardHero
        eyebrow={roleLabel(getStoredUser())}
        title="Staff Management"
        description="Create and manage admin and staff accounts."
        actions={
          <Link href="/dashboard/admin/staff/add" className={heroCtaClass}>
            <Plus className="h-4 w-4" />
            Add Staff
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
                placeholder="Name, email, phone…"
                className="w-full rounded-lg border border-[#d7e8e4] bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#2d6a5f]"
              />
            </div>
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Role
            </span>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as 'all' | TeamUserRole)}
              className="w-full rounded-lg border border-[#d7e8e4] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2d6a5f]"
            >
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Sort
            </span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as 'name' | 'newest')}
              className="w-full rounded-lg border border-[#d7e8e4] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2d6a5f]"
            >
              <option value="name">Name A–Z</option>
              <option value="newest">Newest first</option>
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
        title="Staff"
        description={loading ? 'Loading…' : `${filteredUsers.length} user${filteredUsers.length === 1 ? '' : 's'}`}
        noPadding
        footer={`Showing ${loading ? 0 : filteredUsers.length} users`}
      >
        <div className="rx-scroll max-h-[32rem] overflow-auto">
          <table className="min-w-[900px] w-full text-left">
            <thead className="sticky top-0 z-10">
              <tr className={tableHeadRow}>
                {['Name', 'Email', 'Role', 'Phone', 'Created', 'Actions'].map((column) => (
                  <th
                    key={column}
                    className={`${tableHeadCellClass} ${column === 'Actions' ? 'text-right' : ''}`}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoader colSpan={6} />
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className={tableRowClass}>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e8f3f1] text-[#2d6a5f]">
                          <UserRound className="h-4 w-4" />
                        </span>
                        <span className="text-sm font-bold text-[#0f1c24]">{user.name}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{user.email}</td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {user.phone || '—'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {user.createdAt || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/dashboard/admin/staff/${user.id}/edit`}
                          title="Edit user"
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-[#e8f3f1] hover:text-[#2d6a5f]"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Link>
                        {Number(currentUser?.id) !== Number(user.id) && isAdmin(currentUser) ? (
                          <button
                            type="button"
                            onClick={() => setUserToDelete(user)}
                            title="Delete user"
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
        {!loading && filteredUsers.length === 0 && (
          <div className="p-12 text-center text-sm text-slate-500">No admin or staff users found.</div>
        )}
      </DashboardPanel>

      <ConfirmDialog
        open={Boolean(userToDelete)}
        title="Delete User"
        message={`Are you sure you want to delete ${userToDelete?.name || 'this user'}? This action cannot be undone.`}
        confirmLabel="Delete User"
        loading={deleting}
        onCancel={() => setUserToDelete(null)}
        onConfirm={() => void handleDeleteUser()}
      />
    </DashboardPage>
  )
}

function RoleBadge({ role }: { role: TeamUserRole }) {
  const isAdminRole = role === 'admin'
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
        isAdminRole ? 'bg-[#0b1722] text-white' : 'bg-[#e8f3f1] text-[#2d6a5f]'
      }`}
    >
      {isAdminRole ? 'Admin' : 'Staff'}
    </span>
  )
}
