'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLoading } from '@/components/dashboard-page'
import { showToast } from '@/lib/toast'

export default function AddInvoicePage() {
  const router = useRouter()

  useEffect(() => {
    showToast('Invoices are created automatically when an order is delivered', 'error')
    router.replace('/dashboard/invoices')
  }, [router])

  return <DashboardLoading message="Redirecting…" />
}
