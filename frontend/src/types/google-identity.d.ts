// Ambient types for the Google Identity Services script (loaded in index.html).
// `accounts.id` = Sign-In (ID token), used by components/GoogleSignInButton.tsx.
// `accounts.oauth2` = the separate token-client flow for requesting scoped
// access tokens (e.g. drive.file), used by utils/driveBackup.ts.
export {}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
          }) => void
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
        }
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: { access_token?: string; error?: string }) => void
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void }
        }
      }
    }
  }
}
