"use client";

import { useEffect, useRef } from "react";
import type { Map as LMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapCourse = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  live: boolean;
  time: string; // formatted nearest tee time
  price: number;
  distanceKm: number | null; // from the user (null if location unknown)
  driveMin: number | null;
  bookingUrl: string;
};

/**
 * Leaflet map of the search results — one dot per course, lime = live
 * availability, muted = estimate. Renders the user's location (blue dot) when
 * known and fits the view to everything. Client-only (dynamic import), uses
 * free OpenStreetMap tiles (no API key), and circleMarkers so there are no
 * marker-image assets to bundle.
 */
export function CourseMap({
  courses,
  user,
}: {
  courses: MapCourse[];
  user: { lat: number; lng: number } | null;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !elRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(elRef.current, {
          scrollWheelZoom: false,
        }).setView([45.5019, -73.5674], 9);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        }).addTo(mapRef.current);
      }
      const map = mapRef.current;

      if (layerRef.current) layerRef.current.remove();
      const group = L.layerGroup().addTo(map);
      layerRef.current = group;

      const bounds: [number, number][] = [];

      for (const c of courses) {
        if (typeof c.lat !== "number" || typeof c.lng !== "number") continue;
        const marker = L.circleMarker([c.lat, c.lng], {
          radius: c.live ? 9 : 6,
          color: "#07110b",
          weight: 1.5,
          fillColor: c.live ? "#c6f24a" : "#9fb7a8",
          fillOpacity: c.live ? 0.95 : 0.7,
        }).addTo(group);
        const dist =
          c.distanceKm != null
            ? `<div style="color:#9fb7a8">${c.distanceKm} km · ~${c.driveMin} min drive from you</div>`
            : "";
        marker.bindPopup(
          `<div style="font-family:system-ui;min-width:170px">
            <strong>${c.name}</strong>
            <div style="margin:4px 0">${c.live ? "🟢 Live" : "Est."} · ${c.time} · $${c.price}</div>
            ${dist}
            <a href="${c.bookingUrl}" target="_blank" rel="noopener noreferrer" style="color:#2b7a2b;font-weight:600">Open booking →</a>
          </div>`,
        );
        bounds.push([c.lat, c.lng]);
      }

      if (user) {
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 2px #3b82f6"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        L.marker([user.lat, user.lng], { icon })
          .addTo(group)
          .bindPopup("You are here");
        bounds.push([user.lat, user.lng]);
      }

      if (bounds.length) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      }
      // Ensure correct sizing after the container becomes visible.
      setTimeout(() => map.invalidateSize(), 100);
    })();
    return () => {
      cancelled = true;
    };
  }, [courses, user]);

  // Tear down the map on unmount.
  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    },
    [],
  );

  return (
    <div
      ref={elRef}
      className="h-[520px] w-full overflow-hidden rounded-3xl border border-line"
      style={{ background: "#0f2117" }}
    />
  );
}
