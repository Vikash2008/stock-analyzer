// Landing page Vikash shares directly with people — a proper first-touch
// page (download the app) instead of handing someone a bare app URL.
export default function JoinPage() {
  return (
    <div className="min-h-screen bg-slate-900 relative px-6 text-center">
      <div className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
        <img src="/icon.svg" alt="" className="w-16 h-16" />
        <div className="mt-4">
          <h1 className="text-[22px] font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
            Nexus
          </h1>
          <p className="text-slate-400 text-[13px] mt-2 max-w-xs">
            AI-powered deep research meets portfolio intelligence — every broker, every holding, unified.
          </p>
        </div>
      </div>

      <div className="absolute left-1/2 top-[75%] -translate-x-1/2 -translate-y-1/2 w-full flex flex-col items-center gap-6">
        <a
          href="/nexus.apk"
          download="Nexus.apk"
          className="w-full max-w-[280px] text-[13px] font-semibold text-white rounded-full px-4 py-4"
          style={{ background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' }}
        >
          ⬇ Download the app
        </a>
        <p className="text-slate-500 text-[12px] -mt-4 max-w-xs">
          Installs directly (not from the Play Store) — you may need to allow "install from unknown sources" the first time.
        </p>
      </div>
    </div>
  )
}
