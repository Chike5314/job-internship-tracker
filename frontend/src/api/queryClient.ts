import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: (count, error) =>
        // A 4xx is a deterministic refusal (403 FORBIDDEN, 404 NOT_FOUND, a
        // 409 the applicant can't resolve by retrying). Retrying it just
        // delays the message the user needs to see.
        count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
    mutations: {
      // POST /applications is not idempotent: the duplicate guard is a
      // read followed by a write plus a second read
      // (application_service/handler.py), and the handler's own comment
      // says that narrows the window rather than closing it. An automatic
      // retry would aim directly at that window.
      retry: 0,
    },
  },
})
