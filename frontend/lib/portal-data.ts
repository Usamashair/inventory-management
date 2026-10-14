import { apiRequest } from '@/lib/api'

export interface Warehouse {
  id: number
  name: string
  date: string
}

export interface Customer {
  id: number
  name: string
  email: string
  address: string
  password: string
  city: string
  postCode: string
  phone: string
}

export async function loadWarehouses(): Promise<Warehouse[]> {
  const response = await apiRequest<{ data: Warehouse[] }>('/warehouses')
  return response.data
}

export async function createWarehouse(name: string): Promise<Warehouse> {
  const response = await apiRequest<{ data: Warehouse }>('/warehouses', {
    method: 'POST',
    body: { name },
  })
  return response.data
}

export async function updateWarehouse(id: number, name: string): Promise<Warehouse> {
  const response = await apiRequest<{ data: Warehouse }>(`/warehouses/${id}`, {
    method: 'PUT',
    body: { name },
  })
  return response.data
}

export async function deleteWarehouse(id: number): Promise<void> {
  await apiRequest(`/warehouses/${id}`, { method: 'DELETE' })
}

export async function loadCustomers(): Promise<Customer[]> {
  const response = await apiRequest<{ data: Customer[] }>('/customers')
  return response.data
}

export async function getCustomer(id: number | string): Promise<Customer> {
  const response = await apiRequest<{ data: Customer }>(`/customers/${id}`)
  return response.data
}

export async function createCustomer(
  customer: Omit<Customer, 'id'>,
): Promise<Customer> {
  const response = await apiRequest<{ data: Customer }>('/customers', {
    method: 'POST',
    body: customer,
  })
  return response.data
}

export async function updateCustomer(
  id: number,
  customer: Omit<Customer, 'id'>,
): Promise<Customer> {
  const response = await apiRequest<{ data: Customer }>(`/customers/${id}`, {
    method: 'PUT',
    body: customer,
  })
  return response.data
}

export async function deleteCustomer(id: number): Promise<void> {
  await apiRequest(`/customers/${id}`, { method: 'DELETE' })
}

export type TeamUserRole = 'admin' | 'staff'

export interface TeamUser {
  id: number
  name: string
  email: string
  password: string
  role: TeamUserRole
  phone: string
  createdAt?: string
}

export type TeamUserInput = {
  name: string
  email: string
  password: string
  role: TeamUserRole
  phone: string
}

export async function loadTeamUsers(): Promise<TeamUser[]> {
  const response = await apiRequest<{ data: TeamUser[] }>('/users')
  return response.data
}

export async function getTeamUser(id: number | string): Promise<TeamUser> {
  const response = await apiRequest<{ data: TeamUser }>(`/users/${id}`)
  return response.data
}

export async function createTeamUser(user: TeamUserInput): Promise<TeamUser> {
  const response = await apiRequest<{ data: TeamUser }>('/users', {
    method: 'POST',
    body: user,
  })
  return response.data
}

export async function updateTeamUser(id: number, user: TeamUserInput): Promise<TeamUser> {
  const response = await apiRequest<{ data: TeamUser }>(`/users/${id}`, {
    method: 'PUT',
    body: user,
  })
  return response.data
}

export async function deleteTeamUser(id: number): Promise<void> {
  await apiRequest(`/users/${id}`, { method: 'DELETE' })
}
