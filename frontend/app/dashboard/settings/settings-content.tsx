'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Loader2, Mail, Save, Send, UserRound } from 'lucide-react'
import {
  DashboardFilters,
  DashboardHero,
  DashboardPage,
  DashboardPanel,
  detailRowClass,
  fieldHintClass,
  fieldInputClass,
  fieldLabelClass,
  fieldSelectClass,
  panelCtaClass,
  totalBannerClass,
} from '@/components/dashboard-page'
import { MailSettings, settingsApi } from '@/lib/resources'
import {
  getStoredUser,
  isStaffOrAdmin,
  PortalUser,
  roleLabel,
  storeUser,
  updateProfile,
} from '@/lib/auth'
import { showToast } from '@/lib/toast'

type TabId = 'profile' | 'email'

const emptyMailForm = {
  enabled: false,
  host: '',
  port: 587,
  encryption: 'tls',
  username: '',
  password: '',
  fromAddress: '',
  fromName: 'Rexapack',
}

export default function SettingsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const staff = isStaffOrAdmin(getStoredUser())

  const requestedTab = searchParams.get('tab')
  const initialTab: TabId =
    requestedTab === 'email' && staff ? 'email' : 'profile'

  const [tab, setTab] = useState<TabId>(initialTab)
  const [user, setUser] = useState<PortalUser | null>(null)

  const [profileSaving, setProfileSaving] = useState(false)
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    address: '',
    city: '',
    postCode: '',
    phone: '',
    currentPassword: '',
    password: '',
    passwordConfirmation: '',
  })
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  const [mailLoading, setMailLoading] = useState(false)
  const [mailSaving, setMailSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)
  const [hasPassword, setHasPassword] = useState(false)
  const [isConfigured, setIsConfigured] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [mailForm, setMailForm] = useState(emptyMailForm)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) {
      router.replace('/')
      return
    }
    setUser(stored)
    setProfileForm({
      name: stored.name || '',
      email: stored.email || '',
      address: stored.address || '',
      city: stored.city || '',
      postCode: stored.postCode || '',
      phone: stored.phone || '',
      currentPassword: '',
      password: '',
      passwordConfirmation: '',
    })
    setTestTo(stored.email || '')
  }, [router])

  useEffect(() => {
    const next: TabId = requestedTab === 'email' && staff ? 'email' : 'profile'
    setTab(next)
  }, [requestedTab, staff])

  useEffect(() => {
    if (tab !== 'email' || !staff) return

    let active = true
    setMailLoading(true)
    void settingsApi
      .getMail()
      .then((data: MailSettings) => {
        if (!active) return
        setMailForm({
          enabled: data.enabled,
          host: data.host || '',
          port: data.port || 587,
          encryption: data.encryption || 'tls',
          username: data.username || '',
          password: '',
          fromAddress: data.fromAddress || '',
          fromName: data.fromName || 'Rexapack',
        })
        setHasPassword(data.hasPassword)
        setIsConfigured(data.isConfigured)
      })
      .catch((error) => {
        showToast(error instanceof Error ? error.message : 'Failed to load SMTP settings', 'error')
      })
      .finally(() => {
        if (active) setMailLoading(false)
      })

    return () => {
      active = false
    }
  }, [tab, staff])

  const tabs = useMemo(() => {
    const items: Array<{ id: TabId; label: string; icon: typeof UserRound }> = [
      { id: 'profile', label: 'Profile', icon: UserRound },
    ]
    if (staff) {
      items.push({ id: 'email', label: 'Email / SMTP', icon: Mail })
    }
    return items
  }, [staff])

  const switchTab = (next: TabId) => {
    setTab(next)
    router.replace(`/dashboard/settings?tab=${next}`)
  }

  const handleProfileSave = async (event: FormEvent) => {
    event.preventDefault()
    if (profileForm.password && profileForm.password !== profileForm.passwordConfirmation) {
      showToast('New password and confirmation do not match', 'error')
      return
    }
    if (profileForm.password && profileForm.password.length < 8) {
      showToast('New password must be at least 8 characters', 'error')
      return
    }

    setProfileSaving(true)
    try {
      const body: Parameters<typeof updateProfile>[0] = {
        name: profileForm.name.trim(),
        email: profileForm.email.trim(),
        address: profileForm.address.trim() || null,
        city: profileForm.city.trim() || null,
        postCode: profileForm.postCode.trim() || null,
        phone: profileForm.phone.trim() || null,
      }
      if (profileForm.password) {
        body.currentPassword = profileForm.currentPassword
        body.password = profileForm.password
        body.password_confirmation = profileForm.passwordConfirmation
      }

      const updated = await updateProfile(body)
      setUser(updated)
      storeUser(updated)
      setProfileForm((current) => ({
        ...current,
        name: updated.name || '',
        email: updated.email || '',
        address: updated.address || '',
        city: updated.city || '',
        postCode: updated.postCode || '',
        phone: updated.phone || '',
        currentPassword: '',
        password: '',
        passwordConfirmation: '',
      }))
      showToast(
        profileForm.password ? 'Profile and password updated' : 'Profile updated',
        'success',
      )
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update profile', 'error')
    } finally {
      setProfileSaving(false)
    }
  }

  const handleMailSave = async (event: FormEvent) => {
    event.preventDefault()
    setMailSaving(true)
    try {
      const payload: Parameters<typeof settingsApi.updateMail>[0] = {
        enabled: mailForm.enabled,
        host: mailForm.host.trim(),
        port: Number(mailForm.port) || 587,
        encryption: mailForm.encryption,
        username: mailForm.username.trim(),
        fromAddress: mailForm.fromAddress.trim(),
        fromName: mailForm.fromName.trim(),
      }
      if (mailForm.password.trim()) {
        payload.password = mailForm.password.trim()
      }

      const updated = await settingsApi.updateMail(payload)
      setHasPassword(updated.hasPassword)
      setIsConfigured(updated.isConfigured)
      setMailForm((current) => ({ ...current, password: '' }))
      showToast('SMTP settings saved', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save SMTP settings', 'error')
    } finally {
      setMailSaving(false)
    }
  }

  const handleTest = async () => {
    if (!testTo.trim()) {
      showToast('Enter a recipient email for the test', 'error')
      return
    }
    setTesting(true)
    try {
      const response = await settingsApi.testMail(testTo.trim())
      showToast(response.message || 'Test email sent', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to send test email', 'error')
    } finally {
      setTesting(false)
    }
  }

  return (
    <DashboardPage maxWidth="full">
      <DashboardHero
        eyebrow="Account"
        title="Settings"
        description={
          staff
            ? 'Manage your profile and portal SMTP email credentials.'
            : 'Manage your profile details and password.'
        }
        actions={
          <div className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white">
            {tab === 'profile' ? <UserRound className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
            {tab === 'profile' ? (user?.name || 'Profile') : isConfigured ? 'SMTP ready' : 'SMTP setup'}
          </div>
        }
      />

      <DashboardFilters>
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((item) => {
            const Icon = item.icon
            const active = tab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => switchTab(item.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  active
                    ? 'bg-[#2d6a5f] text-white'
                    : 'bg-[#f8fbfa] text-slate-600 hover:bg-[#e8f3f1]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            )
          })}
        </div>
      </DashboardFilters>

      {tab === 'profile' && (
        <form onSubmit={(event) => void handleProfileSave(event)} className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <DashboardPanel title="Profile details" description="Update how you appear across the portal.">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={fieldLabelClass}>Full name</label>
                  <input
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className={fieldInputClass}
                    required
                  />
                </div>
                <div>
                  <label className={fieldLabelClass}>Email</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className={fieldInputClass}
                    required
                  />
                </div>
                <div>
                  <label className={fieldLabelClass}>Phone</label>
                  <input
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className={fieldInputClass}
                    placeholder="+44…"
                  />
                </div>
                <div>
                  <label className={fieldLabelClass}>City</label>
                  <input
                    value={profileForm.city}
                    onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                    className={fieldInputClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={fieldLabelClass}>Address</label>
                  <input
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    className={fieldInputClass}
                  />
                </div>
                <div>
                  <label className={fieldLabelClass}>Post code</label>
                  <input
                    value={profileForm.postCode}
                    onChange={(e) => setProfileForm({ ...profileForm, postCode: e.target.value })}
                    className={fieldInputClass}
                  />
                </div>
                <div>
                  <label className={fieldLabelClass}>Role</label>
                  <input value={roleLabel(user)} className={fieldInputClass} disabled />
                  <p className={fieldHintClass}>Role can only be changed by an administrator.</p>
                </div>
              </div>
            </DashboardPanel>

            <DashboardPanel
              title="Change password"
              description="Leave blank to keep your current password."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className={fieldLabelClass}>Current password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={profileForm.currentPassword}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, currentPassword: e.target.value })
                      }
                      className={`${fieldInputClass} pr-11`}
                      autoComplete="current-password"
                      placeholder="Required only when setting a new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-700"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={fieldLabelClass}>New password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={profileForm.password}
                      onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                      className={`${fieldInputClass} pr-11`}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-700"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={fieldLabelClass}>Confirm new password</label>
                  <input
                    type="password"
                    value={profileForm.passwordConfirmation}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, passwordConfirmation: e.target.value })
                    }
                    className={fieldInputClass}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </DashboardPanel>
          </div>

          <div>
            <div className="sticky top-8 space-y-6">
              <DashboardPanel title="Account summary">
                <div className="space-y-3">
                  <div className={detailRowClass}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Name</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{profileForm.name || '—'}</p>
                  </div>
                  <div className={detailRowClass}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Email</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                      {profileForm.email || '—'}
                    </p>
                  </div>
                  <div className={detailRowClass}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Role</p>
                    <p className="mt-1 text-sm font-semibold capitalize text-slate-900">
                      {roleLabel(user)}
                    </p>
                  </div>
                </div>
              </DashboardPanel>
              <button
                type="submit"
                disabled={profileSaving}
                className={`${panelCtaClass} w-full justify-center disabled:opacity-60`}
              >
                {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {profileSaving ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </div>
        </form>
      )}

      {tab === 'email' && staff && (
        <form onSubmit={(event) => void handleMailSave(event)} className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <DashboardPanel
              title="SMTP email"
              description="These credentials are used whenever the portal sends email."
            >
              {mailLoading ? (
                <p className="text-sm text-slate-500">Loading settings…</p>
              ) : (
                <div className="space-y-5">
                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[#e2eeeb] bg-[#f8fbfa] px-5 py-4">
                    <div>
                      <p className="text-sm font-bold text-slate-900">Enable SMTP</p>
                      <p className="mt-1 text-xs text-slate-500">
                        When enabled, emails are sent through the server below instead of the default mailer.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={mailForm.enabled}
                      onChange={(e) => setMailForm({ ...mailForm, enabled: e.target.checked })}
                      className="h-5 w-5 rounded border-slate-300 text-[#2d6a5f] focus:ring-[#2d6a5f]"
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className={fieldLabelClass}>SMTP host</label>
                      <input
                        value={mailForm.host}
                        onChange={(e) => setMailForm({ ...mailForm, host: e.target.value })}
                        placeholder="smtp.example.com"
                        className={fieldInputClass}
                        autoComplete="off"
                      />
                    </div>

                    <div>
                      <label className={fieldLabelClass}>Port</label>
                      <input
                        type="number"
                        value={mailForm.port}
                        onChange={(e) =>
                          setMailForm({ ...mailForm, port: Number(e.target.value) || 587 })
                        }
                        className={fieldInputClass}
                        min={1}
                        max={65535}
                      />
                      <p className={fieldHintClass}>Common: 587 (TLS) or 465 (SSL)</p>
                    </div>

                    <div>
                      <label className={fieldLabelClass}>Encryption</label>
                      <select
                        value={mailForm.encryption}
                        onChange={(e) => setMailForm({ ...mailForm, encryption: e.target.value })}
                        className={fieldSelectClass}
                      >
                        <option value="tls">TLS</option>
                        <option value="ssl">SSL</option>
                        <option value="none">None</option>
                      </select>
                    </div>

                    <div>
                      <label className={fieldLabelClass}>Username</label>
                      <input
                        value={mailForm.username}
                        onChange={(e) => setMailForm({ ...mailForm, username: e.target.value })}
                        placeholder="smtp username / email"
                        className={fieldInputClass}
                        autoComplete="off"
                      />
                    </div>

                    <div>
                      <label className={fieldLabelClass}>Password</label>
                      <div className="relative">
                        <input
                          type={showSmtpPassword ? 'text' : 'password'}
                          value={mailForm.password}
                          onChange={(e) => setMailForm({ ...mailForm, password: e.target.value })}
                          placeholder={hasPassword ? '•••••••• (leave blank to keep)' : 'SMTP password'}
                          className={`${fieldInputClass} pr-11`}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSmtpPassword((value) => !value)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-700"
                        >
                          {showSmtpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className={fieldHintClass}>
                        {hasPassword
                          ? 'A password is already saved. Enter a new one only to replace it.'
                          : 'Password is stored encrypted on the server.'}
                      </p>
                    </div>

                    <div>
                      <label className={fieldLabelClass}>From address</label>
                      <input
                        type="email"
                        value={mailForm.fromAddress}
                        onChange={(e) => setMailForm({ ...mailForm, fromAddress: e.target.value })}
                        placeholder="noreply@rexapack.com"
                        className={fieldInputClass}
                      />
                    </div>

                    <div>
                      <label className={fieldLabelClass}>From name</label>
                      <input
                        value={mailForm.fromName}
                        onChange={(e) => setMailForm({ ...mailForm, fromName: e.target.value })}
                        placeholder="Rexapack"
                        className={fieldInputClass}
                      />
                    </div>
                  </div>
                </div>
              )}
            </DashboardPanel>
          </div>

          <div>
            <div className="sticky top-8 space-y-6">
              <DashboardPanel title="Mail status">
                <div className="space-y-3">
                  <div className={detailRowClass}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {mailLoading ? 'Checking…' : isConfigured ? 'Configured' : 'Not configured'}
                    </p>
                  </div>
                  <div className={detailRowClass}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">SMTP</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {mailForm.enabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <div className={totalBannerClass}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">From</p>
                    <p className="mt-1 truncate text-sm font-bold">
                      {mailForm.fromName || 'Rexapack'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-white/70">
                      {mailForm.fromAddress || 'noreply@rexapack.com'}
                    </p>
                  </div>
                </div>
              </DashboardPanel>

              <DashboardPanel
                title="Send test email"
                description="Verify saved SMTP credentials."
              >
                <div className="space-y-3">
                  <div>
                    <label className={fieldLabelClass}>Recipient</label>
                    <input
                      type="email"
                      value={testTo}
                      onChange={(e) => setTestTo(e.target.value)}
                      placeholder="you@example.com"
                      className={fieldInputClass}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={testing || mailLoading}
                    onClick={() => void handleTest()}
                    className={`${panelCtaClass} w-full justify-center disabled:opacity-60`}
                  >
                    {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {testing ? 'Sending…' : 'Send test'}
                  </button>
                  <p className={fieldHintClass}>
                    Save settings first. Test uses credentials stored on the server.
                  </p>
                </div>
              </DashboardPanel>

              <button
                type="submit"
                disabled={mailSaving || mailLoading}
                className={`${panelCtaClass} w-full justify-center disabled:opacity-60`}
              >
                {mailSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {mailSaving ? 'Saving…' : 'Save SMTP settings'}
              </button>
            </div>
          </div>
        </form>
      )}
    </DashboardPage>
  )
}
