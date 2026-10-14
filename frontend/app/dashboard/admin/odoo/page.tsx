'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCcw } from 'lucide-react'
import {
  DashboardHero,
  DashboardPage,
  DashboardPanel,
} from '@/components/dashboard-page'
import { getStoredUser, isStaffOrAdmin, roleLabel } from '@/lib/auth'

export default function OdooSyncPage() {
  const router = useRouter()

  useEffect(() => {
    if (!isStaffOrAdmin(getStoredUser())) {
      router.replace('/dashboard')
    }
  }, [router])

  return (
    <DashboardPage maxWidth="full">
      <DashboardHero
        eyebrow={roleLabel(getStoredUser())}
        title="Odoo synchronization"
        description="Odoo sync is not connected yet. No mock connection status is shown."
      />
      <DashboardPanel title="Integration">
        <div className="flex items-center gap-3 text-slate-600">
          <RefreshCcw className="h-5 w-5" />
          <p className="text-sm font-medium">Configure Odoo credentials when integration is ready.</p>
        </div>
      </DashboardPanel>
    </DashboardPage>
  )
}
