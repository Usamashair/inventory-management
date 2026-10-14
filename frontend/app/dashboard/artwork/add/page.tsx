'use client'

import { Suspense } from 'react'
import { DashboardLoading } from '@/components/dashboard-page'
import AddArtworkForm from './add-artwork-form'

export default function AddArtworkPage() {
  return (
    <Suspense fallback={<DashboardLoading message="Loading…" />}>
      <AddArtworkForm />
    </Suspense>
  )
}
