import { Amplify } from 'aws-amplify'
import { env } from '@/config/env'

// No `oauth` block: custom branded forms mean no hosted-UI redirect ever
// happens, so the app client's http://localhost:3000-only callback
// allowlist is a non-issue this phase. It starts mattering the moment
// Google federation or a hosted-UI redirect is added (see CLAUDE.md).
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: env.cognitoUserPoolId,
      userPoolClientId: env.cognitoUserPoolClientId,
      signUpVerificationMethod: 'code',
      loginWith: { email: true },
    },
  },
})
