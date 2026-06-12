"use client";

import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Map as MapboxMap, Marker, GeoJSONSource } from "mapbox-gl";
import type { PeerDot } from "@/lib/types";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

function dotColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return `hsl(${Math.abs(hash) % 360}, 70%, 60%)`;
}

// Great-circle distance in km — used to find (and label) the nearest stranger.
function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function nearestPeer(
  me: { lat: number; lng: number } | null,
  peers: PeerDot[],
): { peer: PeerDot; km: number } | null {
  if (!me || peers.length === 0) return null;
  let best: { peer: PeerDot; km: number } | null = null;
  for (const peer of peers) {
    const km = haversineKm(me, peer);
    if (!best || km < best.km) best = { peer, km };
  }
  return best;
}

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

export default function WorldMap({
  peers,
  me,
  onPeerClick,
  canConnect,
}: {
  peers: PeerDot[];
  me: { lat: number; lng: number } | null;
  onPeerClick: (id: string) => void;
  canConnect: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const meMarkerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [nearest, setNearest] = useState<{ id: string; km: number } | null>(
    null,
  );

  // Marker click handlers are bound once, so read the live click handler +
  // connectability through refs (synced in an effect, never during render).
  const onPeerClickRef = useRef(onPeerClick);
  const canConnectRef = useRef(canConnect);
  useEffect(() => {
    onPeerClickRef.current = onPeerClick;
    canConnectRef.current = canConnect;
  });

  // Initialise the map once.
  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    let cancelled = false;
    const markers = markersRef.current;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        // Open centered on the user if we know where they are, else world view.
        center: me ? [me.lng, me.lat] : [0, 20],
        zoom: me ? 4 : 1.4,
        attributionControl: true,
      });
      map.on("load", () => {
        if (cancelled) return;
        // A glowing line that connects you to your nearest stranger. Two layers
        // (wide blurred halo + crisp core) give it a neon glow.
        if (!map.getSource("nearest-line")) {
          map.addSource("nearest-line", { type: "geojson", data: EMPTY_FC });
          map.addLayer({
            id: "nearest-glow",
            type: "line",
            source: "nearest-line",
            layout: { "line-cap": "round" },
            paint: {
              "line-color": "#34d399",
              "line-width": 7,
              "line-blur": 8,
              "line-opacity": 0.25,
            },
          });
          map.addLayer({
            id: "nearest-core",
            type: "line",
            source: "nearest-line",
            layout: { "line-cap": "round" },
            paint: {
              "line-color": "#6ee7b7",
              "line-width": 1.5,
              "line-opacity": 0.9,
            },
          });
        }
        setReady(true);
      });
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      markers.forEach((m) => m.remove());
      markers.clear();
      meMarkerRef.current?.remove();
      meMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // `me` is only read for the initial center; we don't want to re-init on change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show / move the user's own "you are here" beacon.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !me) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      if (!meMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "pulse-me";
        el.title = "You are here";
        el.innerHTML = `<span class="pulse-me-label">You</span><span class="pulse-me-dot"></span>`;
        // Centered so the beacon sits on the exact coordinate.
        meMarkerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([me.lng, me.lat])
          .addTo(map);
      } else {
        meMarkerRef.current.setLngLat([me.lng, me.lat]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me, ready]);

  // Reconcile markers, plus the live touches: an arrival burst for new dots and
  // a highlighted line to the nearest stranger.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      const markers = markersRef.current;
      const seen = new Set<string>();

      for (const peer of peers) {
        seen.add(peer.id);
        let marker = markers.get(peer.id);
        if (!marker) {
          const el = document.createElement("button");
          el.className = "pulse-dot";
          // `color` drives both the fill (background: currentColor) and the
          // glow/radar ring in CSS, so each dot pulses in its own hue.
          el.style.color = dotColor(peer.id);
          el.title = "Tap to connect";
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            if (canConnectRef.current) onPeerClickRef.current(peer.id);
          });
          // One-shot "arrival" burst the first time we see this dot.
          el.classList.add("pulse-arrive");
          window.setTimeout(() => el.classList.remove("pulse-arrive"), 1200);
          marker = new mapboxgl.Marker({ element: el })
            .setLngLat([peer.lng, peer.lat])
            .addTo(map);
          markers.set(peer.id, marker);
        }
        marker.getElement().style.opacity = peer.busy ? "0.35" : "1";
      }

      // Drop markers for peers that went offline / got filtered out.
      for (const [id, marker] of markers) {
        if (!seen.has(id)) {
          marker.remove();
          markers.delete(id);
        }
      }

      // Nearest stranger: brighten their dot and draw a line from you to them.
      const near = nearestPeer(me, peers);
      for (const [id, marker] of markers) {
        marker
          .getElement()
          .classList.toggle("is-nearest", near != null && id === near.peer.id);
      }
      const src = map.getSource("nearest-line") as GeoJSONSource | undefined;
      if (src) {
        src.setData(
          me && near
            ? {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [me.lng, me.lat],
                    [near.peer.lng, near.peer.lat],
                  ],
                },
              }
            : EMPTY_FC,
        );
      }
      setNearest(near ? { id: near.peer.id, km: near.km } : null);
    })();

    return () => {
      cancelled = true;
    };
  }, [peers, me, ready]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full bg-zinc-900" />

      {!TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <p className="max-w-md rounded-lg bg-zinc-800 p-4 text-sm text-zinc-200">
            Set{" "}
            <code className="text-emerald-400">NEXT_PUBLIC_MAPBOX_TOKEN</code> in{" "}
            <code>.env</code> to load the map.
          </p>
        </div>
      )}

      {/* HUD */}
      <div className="absolute bottom-5 left-5 flex flex-col gap-2">
        <div className="glass flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-zinc-200 shadow-lg">
          <span className="status-dot h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.85)]" />
          {peers.length} online
        </div>
        {nearest && (
          <div className="glass animate-fade-in flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-emerald-300 shadow-lg">
            <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_8px_2px_rgba(110,231,183,0.85)]" />
            nearest ~{nearest.km < 1 ? "<1" : Math.round(nearest.km)} km
          </div>
        )}
      </div>
    </div>
  );
}
