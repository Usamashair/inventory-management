'use client'

import Link from 'next/link'
import { ReactNode } from 'react'
import { ArrowLeft, type LucideIcon } from 'lucide-react'

export type DashboardStat = {
  label: string
  value: string
  hint?: string
  icon: LucideIcon
  warn?: boolean
}

const MAX_WIDTH = {
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-[1500px]',
} as const

/** Page shell matching /dashboard/quotations layout + padding. */
export function DashboardPage({
  children,
  maxWidth = 'full',
}: {
  children: ReactNode
  maxWidth?: keyof typeof MAX_WIDTH
}) {
  return (
    <div className="flex-1">
      <div className="min-h-screen bg-[#f4f7f6] p-6 lg:p-8">
        <div className={`mx-auto w-full ${MAX_WIDTH[maxWidth]} space-y-6`}>{children}</div>
      </div>
    </div>
  )
}

/** Dark gradient hero card (optional metric strip below). */
export function DashboardHero({
  eyebrow,
  title,
  description,
  actions,
  stats,
}: {
  eyebrow: string
  title: string
  description?: ReactNode
  actions?: ReactNode
  stats?: DashboardStat[]
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
      <div className="relative overflow-hidden border-b border-[#d7e8e4] bg-gradient-to-br from-[#0b1722] via-[#14302b] to-[#1f4f47] px-6 py-7 text-white sm:px-8">
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute bottom-0 right-24 h-28 w-28 rounded-full bg-[#3d8a7c]/20" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
            {description ? (
              <p className="mt-2 max-w-2xl text-sm text-white/70">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>

      {stats && stats.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 sm:p-8 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className="rounded-2xl border border-[#e2eeeb] bg-[#f8fbfa] p-5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {stat.label}
                  </p>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#1f4f47] to-[#2d6a5f] text-white shadow-sm">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-3xl font-bold tracking-tight text-slate-900">{stat.value}</p>
                {stat.hint ? (
                  <p
                    className={`mt-1 text-xs font-medium ${
                      stat.warn ? 'text-amber-700' : 'text-slate-500'
                    }`}
                  >
                    {stat.hint}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

/** White content / table card. */
export function DashboardPanel({
  title,
  description,
  actions,
  children,
  footer,
  noPadding,
}: {
  title?: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  footer?: ReactNode
  noPadding?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
      {(title || description || actions) && (
        <div className="flex flex-col gap-3 border-b border-[#e2eeeb] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title ? (
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#2d6a5f]">{title}</h2>
            ) : null}
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      )}
      <div className={noPadding ? undefined : 'p-6 sm:p-8'}>{children}</div>
      {footer ? (
        <div className="border-t border-[#eef3f1] px-6 py-4 text-xs text-slate-500">{footer}</div>
      ) : null}
    </div>
  )
}

/** Filter / search strip card. */
export function DashboardFilters({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#d7e8e4] bg-white p-4 shadow-sm sm:p-5">
      {children}
    </div>
  )
}

/** Primary CTA on dark hero (white pill). */
export const heroCtaClass =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-[#1f4f47] shadow-sm transition hover:bg-[#e8f3f1]'

/** Secondary teal button for in-panel actions. */
export const panelCtaClass =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#2d6a5f] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#245750]'

export const tableHeadRow =
  'border-b border-[#e2eeeb] bg-[#f8fbfa] text-left text-xs font-bold uppercase tracking-wider text-slate-500 shadow-[0_1px_0_0_#e2eeeb]'

export const tableHeadCellClass = 'px-6 py-4'

export const tableRowClass =
  'border-b border-[#eef3f1] transition hover:bg-[#f8fbfa] last:border-0'

/** Back link used on add / edit / view pages. */
export function DashboardBackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-sm font-semibold text-[#2d6a5f] transition hover:text-[#245750]"
    >
      <ArrowLeft className="h-4 w-4" />
      {children}
    </Link>
  )
}

/** Loading shell matching dashboard page padding. */
export function DashboardLoading({ message = 'Loading…' }: { message?: string }) {
  return (
    <DashboardPage>
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        {message}
      </div>
    </DashboardPage>
  )
}

export const fieldLabelClass = 'mb-2 block text-sm font-semibold text-slate-900'

export const fieldHintClass = 'mt-1.5 text-xs text-slate-500'

export const fieldInputClass =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2d6a5f] focus:ring-2 focus:ring-[#2d6a5f]/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'

export const fieldTextareaClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2d6a5f] focus:ring-2 focus:ring-[#2d6a5f]/20'

export const fieldSelectClass = fieldInputClass

export const lineItemCardClass =
  'grid grid-cols-12 gap-3 rounded-2xl border border-[#e2eeeb] bg-[#f8fbfa] p-4 sm:p-5'

export const totalBannerClass =
  'rounded-2xl bg-gradient-to-br from-[#1f4f47] to-[#2d6a5f] px-5 py-4 text-white shadow-sm'

export const secondaryBtnClass =
  'inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50'

export const outlineTealBtnClass =
  'inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#2d6a5f] bg-white px-5 py-2.5 text-sm font-bold text-[#2d6a5f] transition hover:bg-[#e8f3f1] disabled:opacity-60'

export const softTealBtnClass =
  'inline-flex items-center gap-2 rounded-xl bg-[#e8f3f1] px-3.5 py-2 text-sm font-semibold text-[#2d6a5f] transition hover:bg-[#d7e8e4]'

export const detailRowClass =
  'rounded-xl border border-[#e2eeeb] bg-[#f8fbfa] px-4 py-3.5'

export const heroSecondaryBtnClass =
  'inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15'
