import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GoogleSignInButton from '../components/GoogleSignInButton'

// Landing page Vikash shares directly with people — a proper first-touch
// page (download + sign-in) instead of handing someone a bare app URL.
// Purely a nicer onboarding experience — it carries no access-granting
// token. Access itself is controlled entirely by email (2026-08-13): only
// someone Vikash has already approved via the Admin panel can actually
// sign in from here (or anywhere else) — see backend/routers/auth.py.
export default function JoinPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [signedIn, setSignedIn] = useState(false)

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-6 px-6 text-center">
      <img src="/icon.svg" alt="" className="w-16 h-16" />
      <div>
        <h1 className="text-[22px] font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
          Nexus
        </h1>
        <p className="text-slate-400 text-[13px] mt-2 max-w-xs">
          Track your portfolios, prices, and alerts across every broker in one place.
        </p>
      </div>

      <a
        href="https://github.com/Vikash2008/stock-analyzer/releases/download/v1.0.0/app-release-signed.apk"
        download="Nexus.apk"
        className="w-full max-w-[280px] text-[13px] font-semibold text-white rounded-full px-4 py-4"
        style={{ background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' }}
      >
        ⬇ Download the app
      </a>
      <p className="text-slate-500 text-[10px] -mt-4 max-w-xs">
        Installs directly (not from the Play Store) — you may need to allow "install from unknown sources" the first time.
      </p>

      <div className="w-full max-w-[280px] pt-2 border-t border-slate-800">
        {signedIn ? (
          <p className="text-emerald-400 text-[13px] pt-4">Signed in — open the app to continue.</p>
        ) : (
          <div className="pt-4 flex flex-col items-center gap-2">
            <GoogleSignInButton
              onSuccess={() => { setSignedIn(true); setTimeout(() => navigate('/'), 800) }}
              onError={setError}
            />
            {error && <p className="text-[12px] text-red-400">{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
