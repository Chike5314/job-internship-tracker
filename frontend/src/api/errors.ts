// Transcribed from src/common/errors.py. Every handler failure produced on
// purpose is one of these codes; a 500 from the router's own catch-all
// wrapper is INTERNAL_ERROR with the same envelope shape.
export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'REQUIRED_DOCUMENTS_MISSING'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DUPLICATE_APPLICATION'
  | 'POSTING_NOT_OPEN'
  | 'INVALID_STATUS_TRANSITION'
  | 'APPLICATION_FROZEN'
  | 'INTERNAL_ERROR'
  // Not a backend code: the fallback when a response body isn't JSON at all
  // (a raw API Gateway/CloudFront error page, for example).
  | 'HTTP_ERROR'

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly details?: Record<string, unknown>

  constructor(status: number, code: ApiErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    if (details !== undefined) this.details = details
  }
}

export class UnauthenticatedError extends Error {
  constructor() {
    super('Sign in to continue.')
    this.name = 'UnauthenticatedError'
  }
}

export interface FieldError {
  field: string
  message: string
}

/** Reads details.fields, written by Errors.raise_if_any in validation.py. */
export function fieldErrors(error: ApiError): FieldError[] {
  const fields = error.details?.fields
  return Array.isArray(fields) ? (fields as FieldError[]) : []
}

export interface DocumentRequirement {
  key: string
  label: string
  kind: 'FILE' | 'TEXT'
  required: boolean
}

/** Reads what MissingDocumentsError carries, from common/documents.py. */
export function missingDocuments(
  error: ApiError,
): { missing: Array<{ key: string; label: string }>; requirements: DocumentRequirement[] } | null {
  if (error.code !== 'REQUIRED_DOCUMENTS_MISSING') return null
  return {
    missing: (error.details?.missing as Array<{ key: string; label: string }>) ?? [],
    requirements: (error.details?.requirements as DocumentRequirement[]) ?? [],
  }
}

/** Reads details.allowedNext, from InvalidTransitionError. */
export function allowedNext(error: ApiError): string[] {
  const next = error.details?.allowedNext
  return Array.isArray(next) ? (next as string[]) : []
}
