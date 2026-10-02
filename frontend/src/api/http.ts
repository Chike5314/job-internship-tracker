import { env } from '@/config/env'
import { getIdToken } from '@/auth/authApi'
import { ApiError, UnauthenticatedError, type ApiErrorCode } from './errors'

type Auth = 'required' | 'optional' | 'none'

interface RequestOptions {
  // `object`, not `Record<string, ...>`: a typed filter interface like
  // PostingFilters has no index signature, and TS only allows assigning to
  // an indexed type from something that also declares one. `object` has no
  // such requirement, so any plain query-params shape can be passed here.
  query?: object
  body?: unknown
  auth?: Auth
}

function buildQuery(query: RequestOptions['query']): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

async function resolveAuthHeader(auth: Auth): Promise<string | null> {
  // 'none' sends no Authorization header at all: GET /jobs and GET
  // /jobs/{id} both carry AuthorizationType.NONE at the API Gateway level,
  // so a header there is harmless but misleading about what anonymous
  // browsing actually is.
  if (auth === 'none') return null

  const token = await getIdToken()
  if (!token && auth === 'required') throw new UnauthenticatedError()
  return token
}

export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const { query, body, auth = 'required' } = options
  const url = `${env.apiBaseUrl}${path}${buildQuery(query)}`

  const headers: Record<string, string> = {}
  const token = await resolveAuthHeader(auth)
  if (token) {
    // Raw ID token, no "Bearer " prefix. API Gateway's Cognito authorizer
    // (identity_source="method.request.header.Authorization" in
    // application_stack.py) reads this header directly; adding "Bearer "
    // is the single most likely "fix" someone applies out of habit, and it
    // breaks every authenticated call.
    headers.Authorization = token
  }

  const init: RequestInit = { method, headers }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }

  const response = await fetch(url, init)
  const raw = await response.text()
  const parsed = raw ? safeJsonParse(raw) : {}

  if (!response.ok) {
    if (parsed && typeof parsed === 'object' && 'error' in parsed) {
      const error = (parsed as { error: { code: ApiErrorCode; message: string; details?: Record<string, unknown> } })
        .error
      throw new ApiError(response.status, error.code, error.message, error.details)
    }
    throw new ApiError(response.status, 'HTTP_ERROR', raw || response.statusText)
  }

  return parsed as T
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const http = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'body'>) => request<T>('GET', path, options),
  post: <T>(path: string, options?: RequestOptions) => request<T>('POST', path, options),
  patch: <T>(path: string, options?: RequestOptions) => request<T>('PATCH', path, options),
}
