'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Eye, EyeOff, Save, UserRound } from 'lucide-react'
import {
  DashboardBackLink,
  DashboardLoading,
  DashboardPage,
  detailRowClass,
  fieldHintClass,
  fieldInputClass,
  fieldLabelClass,
  panelCtaClass,
  secondaryBtnClass,
  totalBannerClass,
} from '@/components/dashboard-page'
import { getCustomer, updateCustomer } from '@/lib/portal-data'
import { getStoredUser, isStaffOrAdmin } from '@/lib/auth'
import { showToast } from '@/lib/toast'

export default function EditCustomerPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id ? String(params.id) : ''

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    city: '',
    postCode: '',
  })

  useEffect(() => {
    if (!isStaffOrAdmin(getStoredUser())) {
      router.replace('/dashboard')
      return
    }
    if (!id || id === 'undefined') return

    setLoading(true)
    void getCustomer(id)
      .then((customer) => {
        setForm({
          name: customer.name || '',
          email: customer.email || '',
          password: '',
          phone: customer.phone || '',
          address: customer.address || '',
          city: customer.city || '',
          postCode: customer.postCode || '',
        })
      })
      .catch((error) => {
        showToast(error instanceof Error ? error.message : 'Failed to load customer', 'error')
        router.replace('/dashboard/admin/customers')
      })
      .finally(() => setLoading(false))
  }, [id, router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!id || id === 'undefined') return

    setSaving(true)
    try {
      await updateCustomer(Number(id), {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        postCode: form.postCode.trim(),
      })
      showToast('Customer updated successfully', 'success')
      router.push('/dashboard/admin/customers')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update customer', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <DashboardLoading message="Loading customer…" />
  }

  return (
    <DashboardPage>
      <DashboardBackLink href="/dashboard/admin/customers">Back to Customers</DashboardBackLink>

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-6">
        <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
          <div className="relative overflow-hidden border-b border-[#d7e8e4] bg-gradient-to-br from-[#0b1722] via-[#14302b] to-[#1f4f47] px-6 py-7 text-white sm:px-8">
            <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/5" />
            <div className="pointer-events-none absolute bottom-0 right-24 h-28 w-28 rounded-full bg-[#3d8a7c]/20" />
            <div className="relative">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold tracking-wide text-white/90">
                  Customers
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  Edit
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {form.name || 'Edit customer'}
              </h1>
              <p className="mt-2 text-sm text-white/70">
                Update this customer’s portal account details.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3 sm:p-8">
            <Metric label="Name" value={form.name || '—'} />
            <Metric label="Email" value={form.email || '—'} />
            <Metric label="City" value={form.city || '—'} highlight />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
              <div className="border-b border-[#e2eeeb] px-6 py-5">
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">
                  <UserRound className="h-4 w-4" />
                  Account details
                </h2>
                <p className="mt-1 text-sm text-slate-500">Login credentials for the customer portal.</p>
              </div>
              <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
                <div>
                  <label className={fieldLabelClass}>Full name</label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    className={fieldInputClass}
                    placeholder="Customer name"
                  />
                </div>
                <div>
                  <label className={fieldLabelClass}>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    className={fieldInputClass}
                    placeholder="customer@example.com"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={fieldLabelClass}>Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      minLength={6}
                      className={`${fieldInputClass} pr-11`}
                      placeholder="Leave blank to keep current password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className={fieldHintClass}>Only fill this in to set a new password.</p>
                </div>
                <div>
                  <label className={fieldLabelClass}>Phone</label>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className={fieldInputClass}
                    placeholder="+44…"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
              <div className="border-b border-[#e2eeeb] px-6 py-5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">
                  Address
                </h2>
                <p className="mt-1 text-sm text-slate-500">Optional delivery / billing location.</p>
              </div>
              <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
                <div className="sm:col-span-2">
                  <label className={fieldLabelClass}>Street address</label>
                  <input
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    className={fieldInputClass}
                    placeholder="Street, number…"
                  />
                </div>
                <div>
                  <label className={fieldLabelClass}>City</label>
                  <input
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    className={fieldInputClass}
                  />
                </div>
                <div>
                  <label className={fieldLabelClass}>Post code</label>
                  <input
                    name="postCode"
                    value={form.postCode}
                    onChange={handleChange}
                    className={fieldInputClass}
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="sticky top-8 space-y-6">
              <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
                <div className="border-b border-[#e2eeeb] bg-gradient-to-r from-[#e8f3f1] to-white px-6 py-5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">
                    Summary
                  </h3>
                </div>
                <div className="space-y-4 p-6">
                  <div className={detailRowClass}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Name</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{form.name || '—'}</p>
                  </div>
                  <div className={detailRowClass}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Email</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                      {form.email || '—'}
                    </p>
                  </div>
                  <div className={detailRowClass}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Role</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">Customer</p>
                  </div>
                  <div className={totalBannerClass}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                      Location
                    </p>
                    <p className="mt-1 text-lg font-bold tracking-tight">
                      {form.city || form.postCode || 'Not set'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className={`${panelCtaClass} w-full justify-center disabled:opacity-60`}
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/admin/customers')}
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
      <p
        className={`mt-2 truncate font-bold tracking-tight text-slate-900 ${
          highlight ? 'text-2xl' : 'text-lg'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
