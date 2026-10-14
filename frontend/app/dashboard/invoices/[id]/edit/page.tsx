'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLoading } from '@/components/dashboard-page'
import { showToast } from '@/lib/toast'

export default function EditInvoicePage() {
  const router = useRouter()

  useEffect(() => {
    showToast('Invoices cannot be edited', 'error')
    router.replace('/dashboard/invoices')
  }, [router])

  return <DashboardLoading message="Redirecting…" />
}
