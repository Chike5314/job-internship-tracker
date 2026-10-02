/**
 * Reads and validates the four VITE_ variables this app needs. Failing here,
 * at module load, beats discovering a missing one as a 401 loop later.
 */
function required(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    )
  }
  return value
}

export const env = Object.freeze({
  apiBaseUrl: required('VITE_API_BASE_URL').replace(/\/+$/, ''),
  awsRegion: required('VITE_AWS_REGION'),
  cognitoUserPoolId: required('VITE_COGNITO_USER_POOL_ID'),
  cognitoUserPoolClientId: required('VITE_COGNITO_USER_POOL_CLIENT_ID'),
})
