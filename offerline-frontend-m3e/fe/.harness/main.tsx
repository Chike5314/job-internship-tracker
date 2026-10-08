import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/index.css'
import { queryClient } from '@/api/queryClient'
import { seed, seedCompany } from './seed'
import { handlePipeline, registerJobs } from './pipelineFake'
import { queryKeys } from '@/api/queryKeys'
import type { CompanyFull, JobSummary } from '@/api/types'

// Nothing leaves the page: the seeded cache holds everything the screen reads,
// and the few writes the apply flow makes are answered here with fakes. The
// presigned PUT goes to a dev-server route in vite.config.ts.
const realFetch = window.fetch.bind(window)
const API = 'http://harness.invalid'
const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
const hex = () => Array.from({ length: 32 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')

window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.startsWith('/') || url.startsWith(location.origin)) return realFetch(input, init)
  if (url.startsWith(API)) {
    const parsed = new URL(url)
    const body = init?.body ? JSON.parse(String(init.body)) : {}
    const answer = handlePipeline(init?.method ?? 'GET', parsed.pathname, body, parsed.searchParams)
    // A short wait, so a spinner shows the way it would over a network.
    if (answer) return new Promise((resolve) => setTimeout(() => resolve(answer), 250))
  }
  if (url.startsWith(API) && init?.method === 'POST') {
    const path = url.slice(API.length)
    const body = JSON.parse(String(init.body ?? '{}'))
    if (path === '/profile/upload-url' || path === '/applications/upload-url') {
      const prefix = path.startsWith('/profile') ? 'cvs' : 'applications'
      return json({
        uploadUrl: `${location.origin}/__harness-put`,
        s3Key: `${prefix}/harness-applicant/${hex()}-${body.fileName}`,
        documentKey: body.documentKey,
        expiresInSeconds: 300,
      })
    }
    if (path === '/profile/cvs') {
      return json({ cv: { cvId: 'cv_new', label: body.label ?? 'CV', s3Key: body.s3Key, uploadedAt: new Date().toISOString(), downloadUrl: '' } })
    }
    if (path === '/companies') {
      return json({ company: { companyId: 'harness-company', verificationStatus: 'PENDING_VERIFICATION', ...body } }, 201)
    }
    if (path === '/applications') {
      ;(window as unknown as { __submitted: unknown }).__submitted = body
      return json(
        { application: { applicationId: 'a-new', jobId: body.jobId, status: 'SUBMITTED' }, message: 'Your application was received.' },
        201,
      )
    }
  }
  if (url.startsWith(API) && init?.method === 'PATCH' && url.slice(API.length).startsWith('/jobs/')) {
    const body = JSON.parse(String(init.body ?? '{}'))
    return json({ job: { jobId: url.split('/').pop(), ...body } })
  }
  return Promise.reject(new Error(`harness blocked ${url}`))
}

seed(queryClient)
seedCompany(queryClient)
registerJobs(queryClient.getQueryData<{ jobs: JobSummary[] }>(queryKeys.company.postings())?.jobs ?? [])
if (new URLSearchParams(location.search).get('as') === 'admin') queryClient.removeQueries({ queryKey: ['jobs'] })

// ?company=pending shows a company still waiting for verification.
if (new URLSearchParams(location.search).get('company') === 'pending') {
  ;(window as unknown as { __companyPending: boolean }).__companyPending = true
  queryClient.setQueryData<{ company: CompanyFull }>(queryKeys.company.mine(), (current) =>
    current ? { company: { ...current.company, verificationStatus: 'PENDING_VERIFICATION' } } : current,
  )
}

if (location.pathname === '/' || location.pathname.endsWith('index.html')) {
  history.replaceState(null, '', `/dashboard${location.search}`)
}

const { App } = await import('@/App')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
