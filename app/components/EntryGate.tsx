"use client";

import { useState } from "react";

export default function EntryGate({
  onReady,
}: {
  onReady: (lat: number, lng: number) => void;
}) {
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [error, setError] = useState<string>("");

  function enter() {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("Your browser doesn't support location access.");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => onReady(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        setStatus("error");
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission is required to place you on the map."
            : "Couldn't get your location. Please try again.",
        );
      },
      // High accuracy + maximumAge:0 forces a fresh fix (Wi-Fi/GPS scan)
      // instead of reusing the browser's cached IP-based location.
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center justify-center overflow-hidden bg-[#06070a] p-6 text-zinc-100">
      {/* Radar rings rippling out behind the hero */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="radar-ring h-[340px] w-[340px]" style={{ animationDelay: "0s" }} />
        <div className="radar-ring h-[340px] w-[340px]" style={{ animationDelay: "1.5s" }} />
        <div className="radar-ring h-[340px] w-[340px]" style={{ animationDelay: "3s" }} />
      </div>

      {/* Soft color glows */}
      <div className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-1/4 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="animate-fade-in relative z-10 flex flex-col items-center text-center">
        {/* Pulsing core */}
        <div className="relative mb-8 flex h-16 w-16 items-center justify-center">
          <span className="status-dot absolute h-16 w-16 rounded-full border border-emerald-400/40" />
          <span className="h-4 w-4 rounded-full bg-emerald-400 shadow-[0_0_24px_6px_rgba(52,211,153,0.8)]" />
        </div>

        <h1 className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-cyan-300 bg-clip-text text-6xl font-bold tracking-tight text-transparent">
          Pulse
        </h1>
        <p className="mt-4 max-w-sm text-pretty text-zinc-400">
          A living globe of anonymous strangers. Drop onto the map and connect —
          no sign-up, no history.
        </p>

        <button
          onClick={enter}
          disabled={status === "locating"}
          className="glow-emerald mt-10 rounded-full bg-emerald-400 px-10 py-3.5 font-semibold text-zinc-950 transition hover:scale-[1.03] hover:bg-emerald-300 active:scale-95 disabled:opacity-60 disabled:hover:scale-100"
        >
          {status === "locating" ? "Locating…" : "Enter Pulse"}
        </button>

        {status === "error" && (
          <p className="animate-fade-in mt-5 max-w-sm text-center text-sm text-red-400">
            {error}
          </p>
        )}

        <p className="mt-10 max-w-xs text-center text-xs leading-relaxed text-zinc-600">
          Your dot is placed 1–3&nbsp;km from your real location. Nothing is
          stored — closing the tab ends everything.
        </p>
      </div>
    </div>
  );
}
