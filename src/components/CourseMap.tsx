"use client";

import { useEffect, useRef } from "react";
import type { Map as LMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import { safeBookingUrl } from "@/lib/providers/config";
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
  bookingUrl: string;
};

/**
 * Leaflet map of provider-confirmed search results — one dot per course.
 * Renders the user's location (blue dot) when known and fits the view to
 * everything. Client-only (dynamic import), uses free OpenStreetMap tiles
 * (no API key), and circleMarkers so there are no marker-image assets to bundle.
 */
export function CourseMap({
  courses,
  user,
}: {
  courses: MapCourse[];
  user: { lat: number; lng: number } | null;
}) {
  const { lang } = useLanguage();
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
          radius: 9,
          color: "#07110b",
          weight: 1.5,
          fillColor: "#c6f24a",
          fillOpacity: 0.95,
        }).addTo(group);
        const popup = document.createElement("div");
        popup.style.cssText = "font-family:system-ui;min-width:170px;color:#123526";
        const name = document.createElement("strong");
        name.textContent = c.name;
        const detail = document.createElement("p");
        detail.textContent = `${lang === "fr" ? "Direct" : "Live"} · ${c.time} · ${c.holes} ${lang === "fr" ? "trous" : "holes"} · $${c.price} CAD`;
        popup.append(name, detail);
        if (c.distanceKm != null) {
          const distance = document.createElement("p");
          distance.textContent = lang === "fr"
            ? `${c.distanceKm} km · ~${c.driveMin} min de route depuis vous`
            : `${c.distanceKm} km · ~${c.driveMin} min drive from you`;
          popup.append(distance);
        }
        const bookingUrl = safeBookingUrl(c.bookingUrl);
        if (bookingUrl) {
          const link = document.createElement("a");
          link.href = bookingUrl;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.style.cssText = "color:#174b36;font-weight:600";
          link.textContent = lang === "fr" ? "Continuer chez le fournisseur →" : "Continue to provider →";
          popup.append(link);
        }
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
      className="h-[360px] w-full overflow-hidden rounded-2xl border border-line sm:h-[520px] sm:rounded-3xl"
      style={{ background: "#0f2117" }}
    />
  );
}
