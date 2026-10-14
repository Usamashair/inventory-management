'use client'

export type ToastType = 'success' | 'error'

export type ToastItem = {
  id: number
  message: string
  type: ToastType
}

type Listener = (toasts: ToastItem[]) => void

let toasts: ToastItem[] = []
let listeners: Listener[] = []
let nextId = 1

function emit() {
  listeners.forEach((listener) => listener(toasts))
}

export function subscribeToasts(listener: Listener) {
  listeners.push(listener)
  listener(toasts)
  return () => {
    listeners = listeners.filter((item) => item !== listener)
  }
}

export function showToast(message: string, type: ToastType = 'success') {
  const toast: ToastItem = { id: nextId++, message, type }
  toasts = [...toasts, toast]
  emit()

  window.setTimeout(() => {
    toasts = toasts.filter((item) => item.id !== toast.id)
    emit()
  }, 3200)
}
