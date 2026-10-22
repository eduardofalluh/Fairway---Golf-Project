"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BookingProviderId } from "@/lib/providers/config";
import {
  CONNECTED_STORAGE_KEY,
  PROVIDER_CONNECTIONS_CHANGED,
  addConnectionMarks,
  connectionMarkedAt,
  countConnectedProviders,
  parseConnectionMarks,
  providerConnectionKeys,
  readConnectionMarks,
  writeConnectionMarks,
  type ConnectionMark,
} from "@/lib/provider-connections";

/**
 * Providers the golfer has marked as signed in on this device, with when they
 * did it. These are reminders, not verified sessions, and expire after 14 days.
 */
export function useProviderConnections() {
  const [marks, setMarks] = useState<ConnectionMark[]>([]);
  const marksRef = useRef<ConnectionMark[]>([]);
  useEffect(() => {
    marksRef.current = marks;
  }, [marks]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMarks(readConnectionMarks());
    });
    function onProviderChange(event: Event) {
      const detail = (event as CustomEvent<unknown>).detail;
      setMarks(Array.isArray(detail) ? parseConnectionMarks(detail) : readConnectionMarks());
    }

    function onStorage(event: StorageEvent) {
      if (event.key === CONNECTED_STORAGE_KEY) {
        setMarks(readConnectionMarks());
      }
    }

    window.addEventListener(PROVIDER_CONNECTIONS_CHANGED, onProviderChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(PROVIDER_CONNECTIONS_CHANGED, onProviderChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Notify other components from the event handler, never from inside a state
  // updater, so no component updates while another one is rendering.
  const saveConnection = useCallback(
    (providerId: BookingProviderId, href?: string | null) => {
      const next = addConnectionMarks(marksRef.current, providerConnectionKeys(providerId, href));
      marksRef.current = next;
      setMarks(next);
      writeConnectionMarks(next);
    },
    [],
  );

  const removeConnection = useCallback(
    (providerId: BookingProviderId, href?: string | null) => {
      const removals = new Set(providerConnectionKeys(providerId, href));
      const next = marksRef.current.filter((mark) => !removals.has(mark.key));
      marksRef.current = next;
      setMarks(next);
      writeConnectionMarks(next);
    },
    [],
  );

  /** When this provider was marked signed in, or null if it isn't (or expired). */
  const markedAt = useCallback(
    (providerId: BookingProviderId, href?: string | null) => connectionMarkedAt(marks, providerId, href),
    [marks],
  );

  const isConnected = useCallback(
    (providerId: BookingProviderId, href?: string | null) => markedAt(providerId, href) != null,
    [markedAt],
  );

  return {
    marks,
    connectedCount: useMemo(() => countConnectedProviders(marks.map((m) => m.key)), [marks]),
    isConnected,
    markedAt,
    saveConnection,
    removeConnection,
  };
}
