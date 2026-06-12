"use client";

// Reusable centered prompt for "someone wants to connect" and
// "someone wants to start video".
export default function ConnectionPrompt({
  title,
  subtitle,
  acceptLabel,
  declineLabel,
  onAccept,
  onDecline,
}: {
  title: string;
  subtitle?: string;
  acceptLabel: string;
  declineLabel: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="animate-fade-in absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <div className="animate-scale-in glass glow-emerald w-full max-w-xs rounded-2xl border border-emerald-400/20 p-6 text-center text-zinc-100 shadow-2xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/10 ring-1 ring-emerald-400/30">
          <span className="status-dot h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_10px_3px_rgba(52,211,153,0.8)]" />
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onDecline}
            className="flex-1 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-400 hover:text-white"
          >
            {declineLabel}
          </button>
          <button
            onClick={onAccept}
            className="glow-emerald flex-1 rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
          >
            {acceptLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
