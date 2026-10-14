'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Menu } from 'lucide-react'
import Sidebar from '@/components/sidebar'
import {
  clearStoredUser,
  isIdleExpired,
  touchActivity,
  validateSession,
} from '@/lib/auth'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    const boot = async () => {
      if (isIdleExpired()) {
        clearStoredUser()
        router.replace('/')
        return
      }

      const valid = await validateSession()
      if (cancelled) return

      if (!valid) {
        router.replace('/')
        return
      }

      touchActivity()
      setReady(true)
    }

    void boot()

    const onActivity = () => {
      if (isIdleExpired()) {
        clearStoredUser()
        router.replace('/')
        return
      }
      touchActivity()
    }

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ]
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }))

    const interval = window.setInterval(() => {
      if (isIdleExpired()) {
        clearStoredUser()
        router.replace('/')
      }
    }, 60_000)

    return () => {
      cancelled = true
      events.forEach((event) => window.removeEventListener(event, onActivity))
      window.clearInterval(interval)
    }
  }, [router])

  useEffect(() => {
    if (!menuOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [menuOpen])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7f6]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#d5ebe7] border-t-[#2d6a5f]" />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f7f6]">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="dashboard-main flex h-screen w-full min-w-0 flex-col overflow-y-auto bg-[#f4f7f6] lg:ml-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#e6ecea] bg-[#0b1722] px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-white hover:bg-white/10"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <img
            src="/rexapack-logo.png"
            alt="Rexapack"
            className="h-7 w-auto max-w-[150px] object-contain object-left"
          />
        </header>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
