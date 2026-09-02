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

const BACKUP_FILENAME = 'nexus-portfolio-backup.csv'
// Old name from before the Nexus rebrand — restoreFromDrive() falls back to this
// so backups made before the rename are still found instead of appearing lost.
const LEGACY_BACKUP_FILENAME = 'stock-analyzer-portfolio-backup.csv'
// Separate file for device-local preferences that aren't part of the CSV itself (currency
// toggles, custom benchmark indices, the category catalog) — see SettingsBackup below.
const SETTINGS_FILENAME = 'nexus-settings-backup.json'
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

async function findBackupFile(token: string, filename: string): Promise<{ id: string; modifiedTime: string } | null> {
  const q = encodeURIComponent(`name='${filename}' and trashed=false`)
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,modifiedTime)`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(`Drive lookup failed (${res.status})`)
  const data = await res.json() as { files: { id: string; modifiedTime: string }[] }
  return data.files[0] ?? null
}

async function findBackupFileId(token: string, filename: string = BACKUP_FILENAME): Promise<string | null> {
  const file = await findBackupFile(token, filename)
  return file?.id ?? null
}

// Looks up the current Drive backup's last-modified time without downloading
// its content — used to show "what would I be restoring?" before committing.
export async function getDriveBackupInfo(): Promise<{ modifiedTime: string } | null> {
  const token = await getDriveAccessToken()
  const file = (await findBackupFile(token, BACKUP_FILENAME)) ?? (await findBackupFile(token, LEGACY_BACKUP_FILENAME))
  return file ? { modifiedTime: file.modifiedTime } : null
}

async function uploadToDrive(token: string, filename: string, mimeType: string, content: string): Promise<void> {
  const existingId = await findBackupFileId(token, filename)

  if (existingId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`,
      { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType }, body: content },
    )
    if (!res.ok) throw new Error(`Drive backup failed (${res.status})`)
    return
  }

  const boundary = 'stockanalyzerbackup'
  const metadata = JSON.stringify({ name: filename, mimeType })
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n` +
    `--${boundary}--`
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  if (!res.ok) throw new Error(`Drive backup failed (${res.status})`)
}

async function downloadFromDrive(token: string, fileId: string): Promise<string> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Drive restore failed (${res.status})`)
  return res.text()
}

export async function backupToDrive(csvContent: string): Promise<void> {
  const token = await getDriveAccessToken()
  await uploadToDrive(token, BACKUP_FILENAME, 'text/csv', csvContent)
}

// Returns the backed-up CSV text, or null if no backup exists yet.
export async function restoreFromDrive(): Promise<string | null> {
  const token = await getDriveAccessToken()
  const fileId = (await findBackupFileId(token)) ?? (await findBackupFileId(token, LEGACY_BACKUP_FILENAME))
  if (!fileId) return null
  return downloadFromDrive(token, fileId)
}

// Device-local preferences that live outside the CSV: per-portfolio/per-label currency
// toggles, custom benchmark-index overrides, and the category (Sector bucket) catalog —
// see utils/segments.ts + utils/buckets.ts for where each of these actually lives.
export interface SettingsBackup {
  version:          1
  portfolioCurrency: Record<string, string>
  labelCurrency:     Record<string, string>
  labelBenchmark:    Record<string, string>
  buckets:           unknown   // BucketDef[] — kept untyped here to avoid a utils/buckets.ts import cycle risk
}

export async function backupSettingsToDrive(settings: SettingsBackup): Promise<void> {
  const token = await getDriveAccessToken()
  await uploadToDrive(token, SETTINGS_FILENAME, 'application/json', JSON.stringify(settings))
}

// Returns the backed-up settings object, or null if no settings backup exists yet.
export async function restoreSettingsFromDrive(): Promise<SettingsBackup | null> {
  const token = await getDriveAccessToken()
  const fileId = await findBackupFileId(token, SETTINGS_FILENAME)
  if (!fileId) return null
  const text = await downloadFromDrive(token, fileId)
  try {
    return JSON.parse(text) as SettingsBackup
  } catch {
    return null
  }
}
