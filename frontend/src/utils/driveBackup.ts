// Google Drive backup for the portfolio CSV (2026-08-13) — durability net so
// clearing app storage / a bad update never means permanently losing your
// portfolio + notes (notes live inside the CSV, see AnalysisTab.tsx).
//
// Uses the `drive.file` OAuth scope — access limited to files this app itself
// creates, not the user's whole Drive. Requested via Google Identity Services'
// token-client flow, separate from the Sign-In ID-token flow in utils/auth.ts.
// Content goes straight from the browser to Google's Drive API; Vikash's own
// server never sees or stores it.
//
// No custom version pruning — overwriting the same file on every backup lets
// Drive's own built-in revision history serve as the rollback mechanism if a
// bad backup ever overwrites a good one (visible/restorable from Drive itself).

const BACKUP_FILENAME = 'stock-analyzer-portfolio-backup.csv'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

let _cachedToken: string | undefined
let _tokenClient: ReturnType<NonNullable<Window['google']>['accounts']['oauth2']['initTokenClient']> | undefined

function getDriveAccessToken(): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
  if (!clientId) return Promise.reject(new Error('Sign-in not configured yet'))
  if (_cachedToken) return Promise.resolve(_cachedToken)
  if (!window.google) return Promise.reject(new Error('Google script not loaded yet — try again in a moment'))

  return new Promise((resolve, reject) => {
    if (!_tokenClient) {
      _tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback: (resp) => {
          if (resp.access_token) {
            _cachedToken = resp.access_token
            // Tokens from this flow last ~1hr; drop the cache after that so the
            // next backup/restore silently re-prompts instead of failing outright.
            setTimeout(() => { _cachedToken = undefined }, 55 * 60 * 1000)
            resolve(resp.access_token)
          } else {
            reject(new Error(resp.error ?? 'Drive permission was not granted'))
          }
        },
      })
    }
    _tokenClient.requestAccessToken()
  })
}

async function findBackupFileId(token: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${BACKUP_FILENAME}' and trashed=false`)
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(`Drive lookup failed (${res.status})`)
  const data = await res.json() as { files: { id: string }[] }
  return data.files[0]?.id ?? null
}

export async function backupToDrive(csvContent: string): Promise<void> {
  const token = await getDriveAccessToken()
  const existingId = await findBackupFileId(token)

  if (existingId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`,
      { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/csv' }, body: csvContent },
    )
    if (!res.ok) throw new Error(`Drive backup failed (${res.status})`)
    return
  }

  const boundary = 'stockanalyzerbackup'
  const metadata = JSON.stringify({ name: BACKUP_FILENAME, mimeType: 'text/csv' })
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: text/csv\r\n\r\n${csvContent}\r\n` +
    `--${boundary}--`
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  if (!res.ok) throw new Error(`Drive backup failed (${res.status})`)
}

// Returns the backed-up CSV text, or null if no backup exists yet.
export async function restoreFromDrive(): Promise<string | null> {
  const token = await getDriveAccessToken()
  const fileId = await findBackupFileId(token)
  if (!fileId) return null

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Drive restore failed (${res.status})`)
  return res.text()
}
