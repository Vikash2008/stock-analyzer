// Landing page Vikash shares directly with people — a proper first-touch
// page (download the app) instead of handing someone a bare app URL.
export default function JoinPage() {
  return (
    <div className="min-h-screen bg-[#0b0f1a] relative overflow-hidden px-6 text-center">
      {/* Ambient chart-line watermark — echoes the app's own price-chart identity */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none"
        preserveAspectRatio="none"
        viewBox="0 0 400 800"
        fill="none"
      >
        <polyline
          points="0,700 55,645 105,675 165,510 225,555 285,370 335,415 400,220"
          stroke="#2dd4bf"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Ambient glow behind the mark */}
      <div className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-teal-500/20 blur-[90px] pointer-events-none" />

      <div className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 w-full flex flex-col items-center">
        <div className="flex flex-col items-center join-fade">
          <p className="text-[12px] font-mono tracking-[0.25em] text-teal-400/80 uppercase mb-4">
            Portfolio Intelligence
          </p>
          <img
            src="/icon.svg"
            alt=""
            className="w-16 h-16"
            style={{ filter: 'drop-shadow(0 0 24px rgba(45, 212, 191, 0.35))' }}
          />
          <h1 className="text-[30px] font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent mt-4">
            Nexus
          </h1>
          <p className="text-slate-400 text-[13px] mt-2 max-w-[260px] leading-relaxed">
            AI-powered deep research meets portfolio intelligence — every broker, every holding, unified.
          </p>
        </div>
      </div>

      <div className="absolute left-1/2 top-[75%] -translate-x-1/2 -translate-y-1/2 w-full flex flex-col items-center px-6">
        <div className="flex flex-col items-center gap-3 join-fade join-fade-delay">
          <p className="text-[12px] font-mono tracking-[0.2em] text-slate-500 uppercase">
            Android · APK · 950 KB
          </p>
          <a
            href="/nexus.apk"
            download="Nexus.apk"
            className="w-full max-w-[280px] flex items-center justify-center gap-2 text-[14px] font-semibold text-white rounded-full px-5 py-4 transition-transform active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 50%, #0f766e 100%)',
              boxShadow: '0 8px 30px rgba(13, 148, 136, 0.35)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v13" />
              <path d="M6 11l6 6 6-6" />
              <path d="M5 21h14" />
            </svg>
            Download the app
          </a>
          <p className="text-slate-500 text-[12px] max-w-[260px] leading-relaxed">
            Installs directly (not from the Play Store) — you may need to allow "install from unknown sources" the first time.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes joinFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .join-fade { animation: joinFadeUp 0.6s ease-out both; }
        .join-fade-delay { animation-delay: 0.15s; }
        @media (prefers-reduced-motion: reduce) {
          .join-fade { animation: none; }
        }
      `}</style>
    </div>
  )
}
