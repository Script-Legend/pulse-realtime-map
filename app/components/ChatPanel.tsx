"use client";

import { useEffect, useRef, useState } from "react";

export interface ChatMessage {
  id: number;
  mine: boolean;
  text: string;
}

export default function ChatPanel({
  messages,
  connected,
  videoBusy,
  peerTyping,
  onSend,
  onTyping,
  onStartVideo,
  onEnd,
}: {
  messages: ChatMessage[];
  connected: boolean;
  videoBusy: boolean;
  peerTyping: boolean;
  onSend: (text: string) => void;
  onTyping: (isTyping: boolean) => void;
  onStartVideo: () => void;
  onEnd: () => void;
}) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingActive = useRef(false);

  // Keep the latest message (or the typing indicator) in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, peerTyping]);

  // Tell the peer we're typing; auto-clear after a short pause so the dots
  // don't linger forever.
  function flagTyping(text: string) {
    if (!connected) return;
    if (!text.trim()) {
      stopTyping();
      return;
    }
    if (!typingActive.current) {
      typingActive.current = true;
      onTyping(true);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      typingActive.current = false;
      onTyping(false);
    }, 1500);
  }

  function stopTyping() {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (typingActive.current) {
      typingActive.current = false;
      onTyping(false);
    }
  }

  // Clear the pending timer if the chat closes.
  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !connected) return;
    onSend(text);
    setDraft("");
    stopTyping();
  }

  return (
    <div className="animate-slide-in-right glass absolute inset-y-0 right-0 z-20 flex w-full max-w-md flex-col border-l border-white/10 text-zinc-100 shadow-2xl">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 ring-1 ring-emerald-400/30">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                connected
                  ? "status-dot bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.8)]"
                  : "bg-amber-400"
              }`}
            />
          </span>
          <div>
            <p className="font-semibold leading-tight">Stranger</p>
            <p className="text-xs text-zinc-500">
              {connected ? "Connected · peer-to-peer" : "Connecting…"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onStartVideo}
            disabled={!connected || videoBusy}
            className="rounded-full border border-white/15 px-3 py-1.5 text-sm transition hover:border-emerald-400/60 hover:text-emerald-300 disabled:opacity-40 disabled:hover:border-white/15 disabled:hover:text-zinc-100"
          >
            Video
          </button>
          <button
            onClick={onEnd}
            className="rounded-full bg-red-500/90 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-400"
          >
            End
          </button>
        </div>
      </header>

      <div className="scroll-slim flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && !peerTyping && (
          <p className="mt-8 text-center text-sm text-zinc-500">
            Say hello 👋 Messages are peer-to-peer and never stored.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`animate-message-in flex ${m.mine ? "justify-end" : "justify-start"}`}
          >
            <span
              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                m.mine
                  ? "rounded-br-sm bg-gradient-to-br from-emerald-400 to-emerald-500 text-zinc-950"
                  : "rounded-bl-sm bg-white/10 text-zinc-100 ring-1 ring-white/10"
              }`}
            >
              {m.text}
            </span>
          </div>
        ))}
        {peerTyping && (
          <div className="animate-message-in flex justify-start">
            <span className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white/10 px-4 py-3 ring-1 ring-white/10">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-3">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            flagTyping(e.target.value);
          }}
          placeholder={connected ? "Type a message…" : "Connecting…"}
          disabled={!connected}
          className="flex-1 rounded-full bg-white/5 px-4 py-2 text-sm outline-none ring-1 ring-white/10 transition placeholder:text-zinc-600 focus:ring-emerald-400/60 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!connected || !draft.trim()}
          className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
