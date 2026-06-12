// Lightweight client-side debug logger. OFF by default. Enable on the live site
// without a redeploy by opening it with ?debug=1 in the URL (or by running
// localStorage.pulseDebug = "1" in the console, then reloading).
const enabled =
  typeof window !== "undefined" &&
  (new URLSearchParams(window.location.search).has("debug") ||
    (() => {
      try {
        return window.localStorage.getItem("pulseDebug") === "1";
      } catch {
        return false;
      }
    })());

export function dlog(...args: unknown[]): void {
  if (enabled) console.log("[pulse]", ...args);
}
