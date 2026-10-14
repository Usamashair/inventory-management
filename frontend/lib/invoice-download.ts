import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { InvoiceItem, InvoiceLineItem } from '@/lib/resources'

const BRAND = {
  dark: [31, 79, 71] as [number, number, number],
  mid: [45, 106, 95] as [number, number, number],
  soft: [244, 249, 248] as [number, number, number],
  border: [215, 232, 228] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  text: [15, 23, 42] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  navy: [11, 23, 34] as [number, number, number],
}

const LOGO_PATH = '/rexapack-logo.png'

let cachedLogoDataUrl: string | null = null

async function loadLogoDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl
  try {
    const response = await fetch(LOGO_PATH)
    if (!response.ok) return null
    const blob = await response.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Failed to read logo'))
      reader.readAsDataURL(blob)
    })
    cachedLogoDataUrl = dataUrl
    return dataUrl
  } catch {
    return null
  }
}

function money(value: string | undefined) {
  const n = Number.parseFloat(String(value || '0').replace(/[^0-9.-]/g, ''))
  return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`
}

function lineItemsFor(invoice: InvoiceItem): InvoiceLineItem[] {
  if (invoice.lineItems && invoice.lineItems.length > 0) return invoice.lineItems
  return [
    {
      id: 'summary',
      description: invoice.description || invoice.invoiceNo,
      sku: '',
      quantity: String(invoice.items || 1),
      unitPrice: invoice.amount,
      total: invoice.amount,
    },
  ]
}

function statusLabel(status: string) {
  return status.replace(/-/g, ' ').toUpperCase()
}

function filenameFor(invoice: InvoiceItem) {
  return `${(invoice.invoiceNo || `invoice-${invoice.id}`).replace(/[^\w.-]+/g, '-')}.pdf`
}

/** Builds and downloads a professional invoice PDF with the Rexapack logo. */
export async function downloadInvoice(invoice: InvoiceItem): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 16
  const contentW = pageW - margin * 2

  const invoiceNo = invoice.invoiceNo || `Invoice #${invoice.id}`
  const issueDate = invoice.issueDate || invoice.date || '—'
  const dueDate = invoice.dueDate || '—'
  const balance = invoice.balance || invoice.amount
  const orderRef = invoice.orderNumber || (invoice.orderId ? `#${invoice.orderId}` : null)
  const status = statusLabel(invoice.status)
  const logoDataUrl = await loadLogoDataUrl()

  // Dark brand header (logo is white — needs dark background)
  const headerH = 28
  doc.setFillColor(...BRAND.navy)
  doc.rect(0, 0, pageW, headerH, 'F')
  doc.setFillColor(...BRAND.mid)
  doc.rect(0, headerH, pageW, 1.5, 'F')

  if (logoDataUrl) {
    // Preserve logo aspect (~3.4:1); fit within header
    const logoW = 48
    const logoH = 12
    doc.addImage(logoDataUrl, 'PNG', margin, (headerH - logoH) / 2, logoW, logoH)
  } else {
    doc.setTextColor(...BRAND.white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('Rexapack', margin, headerH / 2 + 2)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...BRAND.white)
  doc.text('INVOICE', pageW - margin, 12, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(203, 213, 225)
  doc.text(invoiceNo, pageW - margin, 19, { align: 'right' })

  // Status pill below header
  const brandY = headerH + 8
  doc.setFillColor(254, 243, 199)
  const statusW = doc.getTextWidth(status) + 6
  doc.roundedRect(pageW - margin - statusW, brandY, statusW, 6, 1.5, 1.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(146, 64, 14)
  doc.text(status, pageW - margin - statusW / 2, brandY + 4, { align: 'center' })

  // Meta cards
  const metaY = brandY + 12
  const cardGap = 4
  const cardW = (contentW - cardGap * 2) / 3
  const cards = [
    { label: 'ISSUE DATE', value: issueDate, sub: orderRef ? `Order ${orderRef}` : '' },
    { label: 'DUE DATE', value: dueDate, sub: '' },
    { label: 'AMOUNT DUE', value: money(balance), sub: `Status: ${status}` },
  ]

  cards.forEach((card, i) => {
    const x = margin + i * (cardW + cardGap)
    doc.setFillColor(...BRAND.soft)
    doc.setDrawColor(...BRAND.border)
    doc.roundedRect(x, metaY, cardW, 22, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...BRAND.mid)
    doc.text(card.label, x + 4, metaY + 6)
    doc.setFontSize(11)
    doc.setTextColor(...BRAND.text)
    doc.text(card.value, x + 4, metaY + 13)
    if (card.sub) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...BRAND.muted)
      doc.text(card.sub, x + 4, metaY + 18.5)
    }
  })

  // Bill To / From
  const partyY = metaY + 28
  const partyW = (contentW - 6) / 2
  const partyH = 42

  const drawParty = (x: number, title: string, name: string, lines: string[]) => {
    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(...BRAND.white)
    doc.roundedRect(x, partyY, partyW, partyH, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...BRAND.mid)
    doc.text(title, x + 5, partyY + 6)
    doc.setFontSize(11)
    doc.setTextColor(...BRAND.text)
    doc.text(name, x + 5, partyY + 13)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(71, 85, 105)
    let ly = partyY + 19
    lines.filter(Boolean).forEach((line) => {
      doc.text(line, x + 5, ly)
      ly += 5
    })
  }

  drawParty(margin, 'BILL TO', invoice.customer || 'Customer', [
    invoice.customerEmail || '',
    invoice.customerPhone || '',
    invoice.customerAddress || '',
  ])

  drawParty(margin + partyW + 6, 'FROM', 'Rexapack', [
    'Packaging & fulfillment services',
    'billing@rexapack.com',
    'www.rexapack.com',
  ])

  let cursorY = partyY + partyH + 8

  if (invoice.description) {
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(...BRAND.mid)
    doc.setLineWidth(0.8)
    doc.line(margin, cursorY, margin, cursorY + 10)
    doc.setLineWidth(0.2)
    doc.rect(margin, cursorY, contentW, 10, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...BRAND.text)
    doc.text('Description: ', margin + 4, cursorY + 6.5)
    const labelW = doc.getTextWidth('Description: ')
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(51, 65, 85)
    doc.text(invoice.description, margin + 4 + labelW, cursorY + 6.5, {
      maxWidth: contentW - 10 - labelW,
    })
    cursorY += 14
  }

  const tableBody = lineItemsFor(invoice).map((item) => [
    item.sku ? `${item.description || '—'}\nSKU: ${item.sku}` : item.description || '—',
    String(item.quantity),
    money(item.unitPrice),
    money(item.total),
  ])

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    head: [['ITEM / DESCRIPTION', 'QTY', 'UNIT PRICE', 'AMOUNT']],
    body: tableBody,
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 3.5,
      textColor: BRAND.text,
      lineColor: [232, 238, 240],
      lineWidth: 0.2,
      valign: 'middle',
    },
    headStyles: {
      fillColor: BRAND.dark,
      textColor: BRAND.white,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [248, 251, 250],
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 22 },
      2: { halign: 'right', cellWidth: 32 },
      3: { halign: 'right', cellWidth: 32, fontStyle: 'bold' },
    },
  })

  const tableEndY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY + 20

  const bottomY = tableEndY + 10
  const totalsW = 72
  const totalsX = pageW - margin - totalsW

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...BRAND.mid)
  doc.text('NOTES', margin, bottomY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(71, 85, 105)
  const notes =
    invoice.notes || 'Thank you for your business. Payment is due by the date shown above.'
  const notesLines = doc.splitTextToSize(notes, contentW - totalsW - 10)
  doc.text(notesLines, margin, bottomY + 5)

  const rowH = 8
  doc.setDrawColor(...BRAND.border)
  doc.setFillColor(...BRAND.white)
  doc.roundedRect(totalsX, bottomY - 2, totalsW, rowH * 2 + 14, 2, 2, 'FD')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.muted)
  doc.text('Subtotal', totalsX + 4, bottomY + 4)
  doc.setTextColor(...BRAND.text)
  doc.setFont('helvetica', 'bold')
  doc.text(money(invoice.amount), totalsX + totalsW - 4, bottomY + 4, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...BRAND.muted)
  doc.text('Amount paid', totalsX + 4, bottomY + 4 + rowH)
  doc.setTextColor(...BRAND.text)
  doc.setFont('helvetica', 'bold')
  doc.text(money(invoice.paid), totalsX + totalsW - 4, bottomY + 4 + rowH, { align: 'right' })

  doc.setFillColor(...BRAND.dark)
  doc.roundedRect(totalsX, bottomY - 2 + rowH * 2, totalsW, 12, 2, 2, 'F')
  doc.rect(totalsX, bottomY - 2 + rowH * 2, totalsW, 3, 'F')
  doc.setTextColor(...BRAND.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('BALANCE DUE', totalsX + 4, bottomY + 6 + rowH * 2)
  doc.setFontSize(12)
  doc.text(money(balance), totalsX + totalsW - 4, bottomY + 6.5 + rowH * 2, { align: 'right' })

  const footerY = 285
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(margin, footerY - 8, pageW - margin, footerY - 8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.dark)
  doc.text('Thank you for choosing Rexapack.', margin, footerY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  doc.text(`${invoiceNo}  ·  Questions? billing@rexapack.com`, pageW - margin, footerY, {
    align: 'right',
  })

  doc.save(filenameFor(invoice))
}
