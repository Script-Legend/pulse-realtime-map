"use client";

import { useEffect, useRef } from "react";

export default function VideoPanel({
  localStream,
  remoteStream,
  onEnd,
}: {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onEnd: () => void;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localRef.current && localRef.current.srcObject !== localStream) {
      localRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current && remoteRef.current.srcObject !== remoteStream) {
      remoteRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="animate-fade-in absolute inset-0 z-30 flex flex-col bg-black">
      <div className="relative flex-1">
        {/* Remote (full screen) */}
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          className="h-full w-full bg-zinc-900 object-cover"
        />
        {!remoteStream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <span className="status-dot h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_10px_3px_rgba(52,211,153,0.7)]" />
            Waiting for stranger&rsquo;s video…
          </div>
        )}
        {/* Local (picture-in-picture) */}
        <video
          ref={localRef}
          autoPlay
          playsInline
          muted
          className="absolute bottom-4 right-4 h-40 w-28 rounded-xl border border-white/15 bg-zinc-800 object-cover shadow-xl ring-1 ring-black/40"
        />
        {/* Gradient so controls stay legible over bright video */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent" />
      </div>
      <div className="flex justify-center bg-zinc-950 p-4">
        <button
          onClick={onEnd}
          className="rounded-full bg-red-500 px-8 py-3 font-semibold text-white shadow-lg transition hover:bg-red-400 active:scale-95"
        >
          End video
        </button>
      </div>
    </div>
  );
}
