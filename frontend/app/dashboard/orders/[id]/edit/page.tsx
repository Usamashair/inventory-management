'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLoading } from '@/components/dashboard-page'
import { showToast } from '@/lib/toast'

export default function EditOrderPage() {
  const router = useRouter()

  useEffect(() => {
    showToast('Orders cannot be edited once created', 'error')
    router.replace('/dashboard/orders')
  }, [router])

  return <DashboardLoading message="Redirecting…" />
}
