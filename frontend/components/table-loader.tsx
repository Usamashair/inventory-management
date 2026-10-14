'use client'

import { Loader2 } from 'lucide-react'

export default function TableLoader({ colSpan = 8 }: { colSpan?: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-16 text-center">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#2d6a5f]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading...
        </div>
      </td>
    </tr>
  )
}
