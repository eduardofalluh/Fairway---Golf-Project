"use client";

import { useEffect, useRef } from "react";
import type { Map as LMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLanguage } from "@/lib/i18n";

export type MapCourse = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  live: boolean;
  time: string; // formatted nearest tee time
  price: number;
  holes: number;
  distanceKm: number | null; // from the user (null if location unknown)
  driveMin: number | null;
};

/**
 * Leaflet map of provider-confirmed search results — one dot per course.
 * Renders the user's location (blue dot) when known and fits the view to
 * everything. Client-only (dynamic import), uses free OpenStreetMap tiles
 * (no API key), and circleMarkers so there are no marker-image assets to bundle.
 * A popup opens the same verified booking sheet as the list, never a raw link.
 */
export function CourseMap({
  courses,
  user,
  onPick,
}: {
  courses: MapCourse[];
  user: { lat: number; lng: number } | null;
  onPick: (courseId: string) => void;
}) {
  const { lang } = useLanguage();
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);
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
          radius: 10,
          color: "#0b2d20",
          weight: 2,
          fillColor: "#caec55",
          fillOpacity: 0.95,
        }).addTo(group);
        const popup = document.createElement("div");
        popup.style.cssText = "font-family:system-ui;min-width:170px;color:#123526";
        const name = document.createElement("strong");
        name.textContent = c.name;
        const detail = document.createElement("p");
        detail.style.cssText = "margin:4px 0";
        detail.textContent = `${lang === "fr" ? "Direct" : "Live"} · ${c.time} · ${c.holes} ${lang === "fr" ? "trous" : "holes"} · $${c.price}`;
        popup.append(name, detail);
        if (c.distanceKm != null) {
          const distance = document.createElement("p");
          distance.textContent = lang === "fr"
            ? `${c.distanceKm} km · ~${c.driveMin} min de route depuis vous`
            : `${c.distanceKm} km · ~${c.driveMin} min drive from you`;
          popup.append(distance);
        }
        const pick = document.createElement("button");
        pick.type = "button";
        pick.style.cssText =
          "margin-top:6px;border:0;border-radius:10px;background:#0b2d20;color:#fff;font-weight:700;padding:8px 12px;cursor:pointer";
        pick.textContent = lang === "fr" ? "Voir et réserver →" : "Review & book →";
        pick.addEventListener("click", () => onPickRef.current(c.id));
        popup.append(pick);
        marker.bindPopup(popup);
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
          .bindPopup(lang === "fr" ? "Vous êtes ici" : "You are here");
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
  }, [courses, user, lang]);

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
      className="h-[420px] w-full overflow-hidden rounded-[1.75rem] border border-line bg-base-2 shadow-[var(--shadow-soft)] sm:h-[560px]"
    />
  );
}
