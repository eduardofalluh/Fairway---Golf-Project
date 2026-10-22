"use client";

import { useEffect, useState } from "react";
import type { GolfCourse, MarketId } from "./types";

const loaded = new Map<MarketId, GolfCourse[]>();
const pending = new Map<MarketId, Promise<GolfCourse[]>>();

function loadDirectory(market: MarketId): Promise<GolfCourse[]> {
  const existing = pending.get(market);
  if (existing) return existing;
  const request = fetch(`/api/courses?market=${market}`)
    .then((res) => (res.ok ? res.json() : { courses: [] }))
    .then((json: { courses?: GolfCourse[] }) => {
      const courses = Array.isArray(json.courses) ? json.courses : [];
      if (courses.length) loaded.set(market, courses);
      else pending.delete(market);
      return courses;
    })
    .catch(() => {
      pending.delete(market);
      return [] as GolfCourse[];
    });
  pending.set(market, request);
  return request;
}

/** The market's course directory (CDN-cached for hours), loaded once per visit. */
export function useDirectory(market: MarketId) {
  const [courses, setCourses] = useState<GolfCourse[]>(() => loaded.get(market) ?? []);

  useEffect(() => {
    const ready = loaded.get(market);
    if (ready) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCourses(ready);
      return;
    }
    let active = true;
    setCourses([]);
    loadDirectory(market).then((list) => {
      if (active) setCourses(list);
    });
    return () => {
      active = false;
    };
  }, [market]);

  return courses;
}
