import { apiRequest } from '@/lib/api'

export interface ProductItem {
  id: string
  sku: string
  product: string
  price?: string
  quantity: string
  available: string
  reserved: string
  customerHeld?: string
  warehouse: string
  warehouseId?: number | null
  status: 'in-stock' | 'low-stock' | 'out-of-stock'
  threshold: string
  notes?: string
}

export interface OrderLineItem {
  id?: string
  productId?: number | null
  product?: string
  sku?: string
  qty: string
  quantity?: string
  price: string
  subTotal?: string
  warehouseId?: number | null
  warehouse?: string
}

export interface OrderItem {
  id: string
  orderId: string
  date: string
  customerId?: number | null
  customer?: string
  quotationId?: number | null
  product?: string
  quantity?: string
  total?: string
  value: string
  status:
    | 'waiting-for-artwork'
    | 'in-production'
    | 'in-transit'
    | 'delivered'
    | 'pending'
    | 'ready'
    | 'shipped'
    | 'completed'
  deliveryDate: string
  deliveryType?: 'warehouse' | 'customer_address' | null
  deliveryWarehouseId?: number | null
  deliveryWarehouse?: string
  deliveryAddress?: string
  warehouseLocation?: string
  notes?: string
  artworkId?: string | null
  artworkStatus?: string | null
  invoiceId?: string | null
  invoiceNo?: string | null
  items?: OrderLineItem[]
}

export interface InvoiceLineItem {
  id: string
  description: string
  sku?: string
  quantity: string
  unitPrice: string
  total: string
  warehouse?: string
}

export interface InvoiceItem {
  id: string
  invoiceNo: string
  date: string
  issueDate?: string
  dueDate: string
  amount: string
  paid: string
  balance?: string
  status: 'draft' | 'pending' | 'partially-paid' | 'paid' | 'overdue'
  items: number
  lineItems?: InvoiceLineItem[]
  description?: string
  notes?: string
  orderId?: string | null
  orderNumber?: string
  customerId?: number | null
  customer?: string
  customerEmail?: string
  customerPhone?: string
  customerAddress?: string
  quotationId?: number | null
}

export interface ArtworkItem {
  id: string
  image?: string | null
  imageUrl?: string | null
  description?: string
  status: 'awaiting-approval' | 'revision-requested' | 'revision-sent' | 'approved' | 'waiting' | 'in-design' | 'review' | 'production'
  customerId?: number | null
  customer?: string
  orderId?: string | null
  orderNumber?: string
  orderStatus?: string | null
  name?: string
  projectName?: string
  date?: string
  project?: string
  designer?: string
  files?: Array<string | { name?: string; url?: string | null; path?: string | null; mime?: string | null }>
}

export interface QuotationChatMessage {
  id: string
  body: string
  createdAt?: string
  createdAtLabel?: string
  userId: number
  userName: string
  userRole: string
  isStaff: boolean
}

export interface QuotationItem {
  id: string
  quoteId: string
  date: string
  productId?: number | null
  product: string
  quantity: string
  unitPrice?: string
  value: string
  status: 'draft' | 'sent' | 'under-review' | 'approved' | 'rejected' | 'expired'
  notes?: string
  expiresDate?: string
  customerId?: number | null
  customer?: string
  orderId?: string | null
  items?: OrderLineItem[]
}

export interface WarehouseStockItem {
  id: string
  warehouseId: number | string
  warehouse?: string
  customerId: number
  customer?: string
  productId: number | string
  product: string
  sku?: string
  quantity: string
}

export interface DeliveryRequestItem {
  id: string
  requestId: string
  customerId: number
  customer?: string
  warehouseId: number
  warehouse?: string
  deliveryAddress: string
  status: 'pending' | 'fulfilled' | 'rejected'
  notes?: string
  fulfilledAt?: string | null
  items: Array<{
    id: string
    productId: number
    product: string
    sku?: string
    quantity: string
  }>
}

async function listResource<T>(path: string): Promise<T[]> {
  const response = await apiRequest<{ data: T[] }>(path)
  return response.data
}

async function mutateResource<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await apiRequest<{ data: T }>(path, { method, body })
  return response.data
}

export const productsApi = {
  list: () => listResource<ProductItem>('/products'),
  get: (id: string) => mutateResource<ProductItem>(`/products/${id}`, 'GET'),
  create: (body: unknown) => mutateResource<ProductItem>('/products', 'POST', body),
  update: (id: string, body: unknown) => mutateResource<ProductItem>(`/products/${id}`, 'PUT', body),
  remove: (id: string) => apiRequest(`/products/${id}`, { method: 'DELETE' }),
}

export const ordersApi = {
  list: (params?: { deliveryType?: string }) => {
    const query = params?.deliveryType ? `?deliveryType=${encodeURIComponent(params.deliveryType)}` : ''
    return listResource<OrderItem>(`/orders${query}`)
  },
  get: (id: string) => mutateResource<OrderItem>(`/orders/${id}`, 'GET'),
  create: (body: unknown) => mutateResource<OrderItem>('/orders', 'POST', body),
  update: (id: string, body: unknown) => mutateResource<OrderItem>(`/orders/${id}`, 'PUT', body),
  advance: (id: string, body?: { to?: string }) =>
    mutateResource<OrderItem>(`/orders/${id}/advance`, 'POST', body),
  remove: (id: string) => apiRequest(`/orders/${id}`, { method: 'DELETE' }),
}

export const invoicesApi = {
  list: () => listResource<InvoiceItem>('/invoices'),
  get: (id: string) => mutateResource<InvoiceItem>(`/invoices/${id}`, 'GET'),
  create: (body: unknown) => mutateResource<InvoiceItem>('/invoices', 'POST', body),
  update: (id: string, body: unknown) => mutateResource<InvoiceItem>(`/invoices/${id}`, 'PUT', body),
  remove: (id: string) => apiRequest(`/invoices/${id}`, { method: 'DELETE' }),
  markPaid: (id: string) => mutateResource<InvoiceItem>(`/invoices/${id}/mark-paid`, 'POST'),
  recordDownload: (id: string) => apiRequest(`/invoices/${id}/downloaded`, { method: 'POST' }),
}

export type ArtworkFilePayload = {
  name: string
  mime?: string
  content: string
}

export async function fileToBase64(file: File): Promise<ArtworkFilePayload> {
  const content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })

  return {
    name: file.name,
    mime: file.type || undefined,
    content,
  }
}

export const artworksApi = {
  list: (params?: {
    search?: string
    status?: string
    orderStatus?: string
    customerId?: string | number
    orderId?: string | number
  }) => {
    const query = new URLSearchParams()
    if (params?.search) query.set('search', params.search)
    if (params?.status && params.status !== 'all') query.set('status', params.status)
    if (params?.orderStatus && params.orderStatus !== 'all') query.set('orderStatus', params.orderStatus)
    if (params?.customerId && String(params.customerId) !== 'all') {
      query.set('customerId', String(params.customerId))
    }
    if (params?.orderId && String(params.orderId) !== 'all') {
      query.set('orderId', String(params.orderId))
    }
    const qs = query.toString()
    return listResource<ArtworkItem>(`/artworks${qs ? `?${qs}` : ''}`)
  },
  get: (id: string) => mutateResource<ArtworkItem>(`/artworks/${id}`, 'GET'),
  create: (body: unknown) => mutateResource<ArtworkItem>('/artworks', 'POST', body),
  createForOrder: (orderId: string, body: unknown) =>
    mutateResource<ArtworkItem>(`/orders/${orderId}/artworks`, 'POST', body),
  update: (id: string, body: unknown) => mutateResource<ArtworkItem>(`/artworks/${id}`, 'PUT', body),
  remove: (id: string) => apiRequest(`/artworks/${id}`, { method: 'DELETE' }),
}

export const quotationsApi = {
  list: () => listResource<QuotationItem>('/quotations'),
  get: (id: string) => mutateResource<QuotationItem>(`/quotations/${id}`, 'GET'),
  create: (body: unknown) => mutateResource<QuotationItem>('/quotations', 'POST', body),
  update: (id: string, body: unknown) => mutateResource<QuotationItem>(`/quotations/${id}`, 'PUT', body),
  remove: (id: string) => apiRequest(`/quotations/${id}`, { method: 'DELETE' }),
  send: (id: string) => mutateResource<QuotationItem>(`/quotations/${id}/send`, 'POST'),
  approve: (id: string, body: unknown) =>
    apiRequest<{ data: { quotation: QuotationItem; order: Partial<OrderItem> } }>(
      `/quotations/${id}/approve`,
      { method: 'POST', body },
    ),
  reject: (id: string) => mutateResource<QuotationItem>(`/quotations/${id}/reject`, 'POST'),
  messages: (id: string) => listResource<QuotationChatMessage>(`/quotations/${id}/messages`),
  sendMessage: (id: string, body: string) =>
    mutateResource<QuotationChatMessage>(`/quotations/${id}/messages`, 'POST', { body }),
}

export const warehouseStockApi = {
  myStock: () => listResource<WarehouseStockItem>('/my-warehouse-stock'),
  all: () => listResource<WarehouseStockItem>('/warehouse-stocks'),
  forWarehouse: (warehouseId: number) =>
    listResource<WarehouseStockItem>(`/warehouses/${warehouseId}/stocks`),
}

export const deliveryRequestsApi = {
  list: () => listResource<DeliveryRequestItem>('/delivery-requests'),
  get: (id: string) => mutateResource<DeliveryRequestItem>(`/delivery-requests/${id}`, 'GET'),
  create: (body: unknown) => mutateResource<DeliveryRequestItem>('/delivery-requests', 'POST', body),
  fulfill: (id: string) => mutateResource<DeliveryRequestItem>(`/delivery-requests/${id}/fulfill`, 'POST'),
  reject: (id: string) => mutateResource<DeliveryRequestItem>(`/delivery-requests/${id}/reject`, 'POST'),
}

export type NotificationCategory =
  | 'quotation'
  | 'artwork'
  | 'order'
  | 'invoice'
  | 'call-off'

export interface PortalNotificationItem {
  id: string
  type: string
  category: NotificationCategory | string
  title: string
  message: string
  href?: string | null
  meta?: Record<string, unknown>
  readAt?: string | null
  createdAt?: string
  createdAtLabel?: string
  isRead: boolean
}

export const notificationsApi = {
  list: async (params?: { category?: string; unread?: boolean; limit?: number }) => {
    const query = new URLSearchParams()
    if (params?.category && params.category !== 'all') query.set('category', params.category)
    if (params?.unread) query.set('unread', '1')
    if (params?.limit) query.set('limit', String(params.limit))
    const qs = query.toString()
    return apiRequest<{ data: PortalNotificationItem[]; unreadCount: number }>(
      `/notifications${qs ? `?${qs}` : ''}`,
    )
  },
  unreadCount: async () => {
    const response = await apiRequest<{ unreadCount: number }>('/notifications/unread-count')
    return response.unreadCount
  },
  markRead: (id: string) =>
    mutateResource<PortalNotificationItem>(`/notifications/${id}/read`, 'POST'),
  markAllRead: () => apiRequest('/notifications/mark-all-read', { method: 'POST' }),
}

export interface ActivityItem {
  id: string
  category: string
  type: string
  title: string
  detail: string
  href?: string | null
  date: string
  dateLabel: string
}

export const activityApi = {
  list: async (params?: { category?: string; limit?: number }) => {
    const query = new URLSearchParams()
    if (params?.category && params.category !== 'all') query.set('category', params.category)
    if (params?.limit) query.set('limit', String(params.limit))
    const qs = query.toString()
    return apiRequest<{ data: ActivityItem[]; total: number }>(`/activity${qs ? `?${qs}` : ''}`)
  },
}

export interface MailSettings {
  enabled: boolean
  host: string
  port: number
  encryption: 'tls' | 'ssl' | 'none' | string
  username: string
  hasPassword: boolean
  fromAddress: string
  fromName: string
  isConfigured: boolean
}

export const settingsApi = {
  getMail: () => mutateResource<MailSettings>('/settings/mail', 'GET'),
  updateMail: (body: {
    enabled?: boolean
    host?: string
    port?: number
    encryption?: string
    username?: string
    password?: string
    fromAddress?: string
    fromName?: string
  }) => mutateResource<MailSettings>('/settings/mail', 'PUT', body),
  testMail: (to: string) => apiRequest<{ message: string }>('/settings/mail/test', { method: 'POST', body: { to } }),
}
