'use client'

import { Suspense } from 'react'
import { DashboardLoading } from '@/components/dashboard-page'
import SettingsPageContent from './settings-content'

export default function SettingsPage() {
  return (
    <Suspense fallback={<DashboardLoading message="Loading settings…" />}>
      <SettingsPageContent />
    </Suspense>
  )
}
