'use client'

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Bold,
  Italic,
  List,
  MessageSquare,
  RefreshCw,
  Send,
  Smile,
} from 'lucide-react'
import { QuotationChatMessage, quotationsApi } from '@/lib/resources'
import { PortalUser } from '@/lib/auth'
import { showToast } from '@/lib/toast'

const EMOJIS = ['👍', '✅', '🙏', '😊', '📦', '✏️', '❓', '🚀']

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function dayKey(value?: string) {
  if (!value) return 'unknown'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(value?: string) {
  if (!value) return 'Earlier'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (dayKey(value) === dayKey(today.toISOString())) return 'Today'
  if (dayKey(value) === dayKey(yesterday.toISOString())) return 'Yesterday'
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** Lightweight markdown: **bold**, *italic*, line breaks. */
function renderMessageBody(body: string) {
  const lines = body.split('\n')
  return lines.map((line, lineIndex) => {
    const parts: Array<string | { type: 'bold' | 'italic'; text: string }> = []
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g
    let last = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(line)) !== null) {
      if (match.index > last) parts.push(line.slice(last, match.index))
      const token = match[0]
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push({ type: 'bold', text: token.slice(2, -2) })
      } else {
        parts.push({ type: 'italic', text: token.slice(1, -1) })
      }
      last = match.index + token.length
    }
    if (last < line.length) parts.push(line.slice(last))

    return (
      <span key={lineIndex}>
        {lineIndex > 0 ? <br /> : null}
        {parts.map((part, i) => {
          if (typeof part === 'string') return <span key={i}>{part}</span>
          if (part.type === 'bold') return <strong key={i}>{part.text}</strong>
          return <em key={i}>{part.text}</em>
        })}
      </span>
    )
  })
}

type QuotationChatProps = {
  quotationId: string
  quoteLabel: string
  peerName: string
  user: PortalUser | null
  canChat: boolean
  isStaff: boolean
}

export default function QuotationChat({
  quotationId,
  quoteLabel,
  peerName,
  user,
  canChat,
  isStaff,
}: QuotationChatProps) {
  const [messages, setMessages] = useState<QuotationChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [showEmojis, setShowEmojis] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const loadMessages = async (silent = false) => {
    if (!quotationId) return
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const list = await quotationsApi.messages(quotationId)
      setMessages(list)
    } catch (error) {
      if (!silent) {
        showToast(error instanceof Error ? error.message : 'Failed to load chat', 'error')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadMessages()
    const timer = window.setInterval(() => void loadMessages(true), 15000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotationId])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, sending])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [draft])

  const grouped = useMemo(() => {
    const groups: Array<{ day: string; label: string; items: QuotationChatMessage[] }> = []
    for (const message of messages) {
      const key = dayKey(message.createdAt || message.createdAtLabel)
      const last = groups[groups.length - 1]
      if (!last || last.day !== key) {
        groups.push({
          day: key,
          label: dayLabel(message.createdAt || message.createdAtLabel),
          items: [message],
        })
      } else {
        last.items.push(message)
      }
    }
    return groups
  }, [messages])

  const insertAroundSelection = (before: string, after = before) => {
    const el = textareaRef.current
    if (!el) {
      setDraft((current) => `${current}${before}${after}`)
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = draft.slice(start, end) || 'text'
    const next = draft.slice(0, start) + before + selected + after + draft.slice(end)
    setDraft(next)
    requestAnimationFrame(() => {
      el.focus()
      const cursor = start + before.length + selected.length + after.length
      el.setSelectionRange(cursor, cursor)
    })
  }

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current
    if (!el) {
      setDraft((current) => current + emoji)
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = draft.slice(0, start) + emoji + draft.slice(end)
    setDraft(next)
    setShowEmojis(false)
    requestAnimationFrame(() => {
      el.focus()
      const cursor = start + emoji.length
      el.setSelectionRange(cursor, cursor)
    })
  }

  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!canChat || !draft.trim() || sending) return
    setSending(true)
    try {
      const created = await quotationsApi.sendMessage(quotationId, draft.trim())
      setMessages((current) => [...current, created])
      setDraft('')
      setShowEmojis(false)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to send message', 'error')
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className="flex h-[560px] flex-col overflow-hidden rounded-2xl border border-[#d7e8e4] bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-[#e2eeeb] bg-gradient-to-r from-[#0b1722] via-[#14302b] to-[#1f4f47] px-5 py-4 text-white">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold">
            {initials(peerName || 'RP')}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{peerName || 'Conversation'}</p>
            <p className="truncate text-xs text-white/65">
              Quotation chat · {quoteLabel}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadMessages(true)}
          disabled={refreshing}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/15 disabled:opacity-60"
          title="Refresh chat"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div
        ref={listRef}
        className="rx-scroll flex-1 space-y-5 overflow-y-auto bg-[linear-gradient(180deg,#f7fbfa_0%,#eef5f3_100%)] px-4 py-5 sm:px-5"
      >
        {loading && (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Loading conversation…
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f3f1] text-[#2d6a5f]">
              <MessageSquare className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">No messages yet</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {isStaff
                ? 'Start the conversation with the customer about this quotation.'
                : 'Ask Rexapack a question about pricing, specs, or delivery.'}
            </p>
          </div>
        )}

        {!loading &&
          grouped.map((group) => (
            <div key={group.day} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[#d7e8e4]" />
                <span className="rounded-full border border-[#d7e8e4] bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-[#d7e8e4]" />
              </div>

              {group.items.map((message) => {
                const mine = user?.id != null && Number(message.userId) === Number(user.id)
                return (
                  <div
                    key={message.id}
                    className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}
                  >
                    {!mine && (
                      <div className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1f4f47] text-[10px] font-bold text-white">
                        {initials(message.userName)}
                      </div>
                    )}
                    <div className={`max-w-[78%] sm:max-w-[70%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div
                        className={`mb-1 flex flex-wrap items-center gap-1.5 px-1 text-[11px] font-semibold ${
                          mine ? 'justify-end text-[#2d6a5f]' : 'text-slate-500'
                        }`}
                      >
                        <span>{mine ? 'You' : message.userName}</span>
                        <span className="text-slate-300">·</span>
                        <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                          {message.isStaff ? 'Staff' : 'Customer'}
                        </span>
                      </div>
                      <div
                        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                          mine
                            ? 'rounded-br-md bg-[#2d6a5f] text-white'
                            : 'rounded-bl-md border border-[#d7e8e4] bg-white text-slate-800'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {renderMessageBody(message.body)}
                        </p>
                      </div>
                      {message.createdAtLabel && (
                        <p
                          className={`mt-1 px-1 text-[10px] font-medium text-slate-400 ${
                            mine ? 'text-right' : 'text-left'
                          }`}
                        >
                          {message.createdAtLabel}
                        </p>
                      )}
                    </div>
                    {mine && (
                      <div className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2d6a5f] text-[10px] font-bold text-white">
                        {initials(user?.name || 'You')}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
      </div>

      {canChat ? (
        <form onSubmit={(e) => void handleSend(e)} className="border-t border-[#e2eeeb] bg-white p-3 sm:p-4">
          <div className="mb-2 flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => insertAroundSelection('**')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-[#e8f3f1] hover:text-[#2d6a5f]"
              title="Bold"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertAroundSelection('*')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-[#e8f3f1] hover:text-[#2d6a5f]"
              title="Italic"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                const el = textareaRef.current
                const prefix = draft && !draft.endsWith('\n') ? '\n- ' : '- '
                if (!el) {
                  setDraft((current) => current + prefix)
                  return
                }
                const start = el.selectionStart
                const next = draft.slice(0, start) + prefix + draft.slice(start)
                setDraft(next)
                requestAnimationFrame(() => {
                  el.focus()
                  const cursor = start + prefix.length
                  el.setSelectionRange(cursor, cursor)
                })
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-[#e8f3f1] hover:text-[#2d6a5f]"
              title="Bullet list"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowEmojis((open) => !open)}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-[#e8f3f1] hover:text-[#2d6a5f] ${
                showEmojis ? 'bg-[#e8f3f1] text-[#2d6a5f]' : 'text-slate-500'
              }`}
              title="Emoji"
            >
              <Smile className="h-3.5 w-3.5" />
            </button>
            <span className="ml-auto text-[11px] font-medium text-slate-400">
              Enter to send · Shift+Enter for new line
            </span>
          </div>

          {showEmojis && (
            <div className="mb-2 flex flex-wrap gap-1 rounded-xl border border-[#e2eeeb] bg-[#f8fbfa] p-2">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-lg transition hover:bg-white"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 rounded-2xl border border-[#d7e8e4] bg-[#f8fbfa] p-2 shadow-inner focus-within:border-[#2d6a5f] focus-within:ring-2 focus-within:ring-[#2d6a5f]/15">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={isStaff ? 'Write a message to the customer…' : 'Write a message to Rexapack…'}
              rows={1}
              maxLength={5000}
              className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[#2d6a5f] px-4 text-sm font-bold text-white transition hover:bg-[#245750] disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
          <div className="mt-1.5 flex justify-between px-1 text-[11px] text-slate-400">
            <span>Supports **bold** and *italic*</span>
            <span>{draft.length}/5000</span>
          </div>
        </form>
      ) : (
        <div className="border-t border-[#e2eeeb] bg-[#f8fbfa] px-5 py-4 text-center text-sm text-slate-500">
          Chat is unavailable for this quotation.
        </div>
      )}
    </div>
  )
}
