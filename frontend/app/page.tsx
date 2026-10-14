'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Eye, EyeOff, Loader2, LockKeyhole, Mail } from 'lucide-react'
import { isAuthenticated, login } from '@/lib/auth'
import { showToast } from '@/lib/toast'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/dashboard')
      return
    }
    setCheckingAuth(false)
  }, [router])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login(email.trim().toLowerCase(), password)
      showToast('Login successful', 'success')
      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The email address or password is incorrect.')
      setIsLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7f6]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#d5ebe7] border-t-[#2d6a5f]" />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f7f6] lg:grid lg:grid-cols-[47%_53%]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#071c29] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="login-grid absolute inset-0 opacity-30" />
        <div className="absolute -left-32 bottom-8 h-80 w-80 rounded-full bg-[#167f72]/10 blur-3xl" />

        <div className="relative z-10 flex items-center">
          <img
            src="/rexapack-logo.png"
            alt="Rexapack"
            className="h-9 w-auto max-w-[200px] object-contain object-left"
          />
        </div>

        <div className="relative z-10 max-w-xl pb-8">
          <div className="mb-5 inline-flex items-center rounded-full border border-[#2c756f] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.28em] text-[#64c7bb]">
            Rexapack Portal
          </div>
          <h1 className="max-w-lg text-5xl font-black leading-[1.05] tracking-tight !text-white">
            Your packaging,
            <br />
            digitally managed.
          </h1>
          <ul className="mt-8 space-y-4 text-sm text-slate-300">
            {[
              'Approve artwork without email ping-pong',
              'Real-time inventory at your selected warehouse',
              'Quotations, orders and invoices in one place',
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <Check className="h-4 w-4 text-[#4fc3b3]" strokeWidth={3} />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Secure business portal · Customer and administrator access
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[430px]">
          <div className="mb-8 lg:hidden">
            <div className="inline-flex rounded-xl bg-[#071c29] px-3 py-2.5">
              <img
                src="/rexapack-logo.png"
                alt="Rexapack"
                className="h-8 w-auto max-w-[180px] object-contain object-left"
              />
            </div>
          </div>

          <h2 className="text-3xl font-black tracking-tight text-[#0b1720]">Log in to the portal</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Welcome back. Your quotations, artwork and inventory are ready.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.07)] sm:p-8">
            <div>
              <label htmlFor="email" className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@company.com"
                  autoComplete="email"
                  required
                  className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#248376] focus:ring-3 focus:ring-[#248376]/10"
                />
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="password" className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Password
                </label>
                <button type="button" className="text-xs font-semibold text-[#248376] hover:underline">
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#248376] focus:ring-3 focus:ring-[#248376]/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#277f73] text-sm font-bold text-white transition hover:bg-[#206e64] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Log in <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>

          <div className="mt-5 rounded-xl border border-slate-200 bg-white/70 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Demo accounts</p>
            <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
              <button type="button" onClick={() => { setEmail('admin@admin.com'); setPassword('12345678') }} className="rounded-lg bg-slate-50 p-3 text-left hover:bg-slate-100">
                <strong className="block text-slate-800">Administrator</strong>
                admin@admin.com
              </button>
              <button type="button" onClick={() => { setEmail('staff@staff.com'); setPassword('12345678') }} className="rounded-lg bg-slate-50 p-3 text-left hover:bg-slate-100">
                <strong className="block text-slate-800">Staff</strong>
                staff@staff.com
              </button>
              <button type="button" onClick={() => { setEmail('customer@gamil.com'); setPassword('12345678') }} className="rounded-lg bg-slate-50 p-3 text-left hover:bg-slate-100">
                <strong className="block text-slate-800">Customer</strong>
                customer@gamil.com
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">Password for all accounts: 12345678</p>
          </div>
        </div>
      </section>
    </main>
  )
}
