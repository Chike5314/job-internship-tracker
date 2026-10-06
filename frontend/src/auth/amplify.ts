import { Amplify } from 'aws-amplify'
import { env } from '@/config/env'

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: env.cognitoUserPoolId,
      userPoolClientId: env.cognitoUserPoolClientId,
      signUpVerificationMethod: 'code',
      loginWith: {
        email: true,
        oauth: {
          domain: env.cognitoDomain,
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: [window.location.origin],
          redirectSignOut: [window.location.origin],
          responseType: 'code',
        },
      },
    },
  },
})
