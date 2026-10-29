import type { Connection, Schema, StepSpec, Workflow } from '$lib/types'
import { apiUrl, request, send } from './http'

export const getAdminConfig = () => request<Schema>('GET', 'admin/api/config')
export const postConfig = (values: Record<string, unknown>) =>
  request<void>('POST', 'admin/api/config', values)
export const getPublicConfig = () =>
  request<{ connections: Connection[]; auth: string[] }>('GET', 'api/config')
export const getBackends = () => request<Record<string, Schema>>('GET', 'api/backend')
export const getAuthMiddlewares = () =>
  request<Record<string, Schema>>('GET', 'admin/api/middlewares/authentication')

export const getSession = () => request<boolean>('GET', 'admin/api/session')
export const login = (password: string) =>
  request<void>('POST', 'admin/api/session', { password })

export const getLogs = (maxBytes: number) =>
  request<string>('GET', `admin/api/logs?maxSize=${maxBytes}`, undefined, { text: true })
export const logsUrl = () => apiUrl('admin/api/logs')

export const getAudit = (params: URLSearchParams) =>
  request<{ form: Schema; render: string }>('GET', `admin/api/audit?${params}`)

export const getWorkflows = () =>
  request<{ workflows: Workflow[]; triggers: StepSpec[]; actions: StepSpec[] }>(
    'GET',
    'admin/api/workflow',
  )
export const getWorkflow = (id: string) =>
  request<Workflow>('GET', `admin/api/workflow/${encodeURIComponent(id)}`)
export const upsertWorkflow = (w: Workflow) => request<void>('POST', 'admin/api/workflow', w)
export const deleteWorkflow = (id: string) =>
  request<void>('DELETE', `admin/api/workflow?id=${encodeURIComponent(id)}`)

export async function getRelease(): Promise<{ html: string; version: string }> {
  const res = await send('GET', 'about')
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html')
  const version = /^Filestash\/([v.0-9]*)/.exec(res.headers.get('X-Powered-By') ?? '')?.[1] ?? ''
  return { html: doc.querySelector('table')?.outerHTML ?? '', version }
}

// Users of the "Local users" login method. The server answers in JSON only when
// asked for it, and reads new and changed users from a form.
export type LocalUser = { email: string; password: string; role?: string; disabled?: boolean; mfa?: string }
const USERS = 'admin/api/simple-user-management'
const asJson = { headers: { Accept: 'application/json' } }
export const getLocalUsers = () => request<LocalUser[] | null>('GET', USERS, undefined, asJson)
export const saveLocalUser = (u: { email: string; password: string; role: string; disabled: boolean }) =>
  request<void>(
    'POST',
    USERS,
    { email: u.email, password: u.password, role: u.role, ...(u.disabled ? { disabled: 'on' } : {}) },
    { ...asJson, form: true },
  )
export const deleteLocalUser = (email: string) =>
  request<void>('DELETE', `${USERS}?email=${encodeURIComponent(email)}`, undefined, asJson)

// The server's own health check: config readable, server answering, secret key and admin password sane.
export type Health = { status: string; reason?: string; debug?: string[] }
export async function getHealth(): Promise<Health> {
  const res = await fetch(apiUrl('healthz'), { credentials: 'same-origin' })
  try {
    return (await res.json()) as Health
  } catch {
    return { status: 'error', reason: `HTTP ${res.status}` }
  }
}
