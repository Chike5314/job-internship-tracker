// The pool has prevent_user_existence_errors=True (persistence_stack.py),
// so a sign-in failure must never reveal whether an address is
// registered: NotAuthorizedException covers both "no such account" and
// "wrong password" with one line.
const MESSAGES: Record<string, string> = {
  UsernameExistsException: 'An account already exists for this email address. Sign in instead.',
  NotAuthorizedException: 'That email and password did not match an account.',
  UserNotConfirmedException: 'Confirm your email address to finish signing in. We can send a new code.',
  CodeMismatchException: 'That code did not match. Check the six digits and try again.',
  ExpiredCodeException: 'That code has expired. Send a new one.',
  LimitExceededException: 'Too many attempts. Wait a few minutes and try again.',
  TooManyRequestsException: 'Too many attempts. Wait a few minutes and try again.',
  UserLambdaValidationException: 'We could not finish creating the account. Try again.',
  InvalidPasswordException: 'That password does not meet every rule below.',
}

export function authErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : ''
  return MESSAGES[name] ?? 'Something went wrong. Try again.'
}

export function isUnconfirmedUserError(error: unknown): boolean {
  return error instanceof Error && error.name === 'UserNotConfirmedException'
}
