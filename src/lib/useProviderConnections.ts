"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BookingProviderId } from "@/lib/providers/config";
import {
  CONNECTED_STORAGE_KEY,
  PROVIDER_CONNECTIONS_CHANGED,
  countConnectedProviders,
  hasProviderConnection,
  providerConnectionKeys,
  readConnectedProviderKeys,
  writeConnectedProviderKeys,
} from "@/lib/provider-connections";

function mergeKeys(current: string[], additions: string[]) {
  return Array.from(new Set([...current, ...additions]));
}

export function useProviderConnections() {
  const [connectedKeys, setConnectedKeys] = useState<string[]>([]);
  const keysRef = useRef<string[]>([]);
  useEffect(() => {
    keysRef.current = connectedKeys;
  }, [connectedKeys]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setConnectedKeys(readConnectedProviderKeys());
    });
    function onProviderChange(event: Event) {
      const detail = (event as CustomEvent<string[]>).detail;
      setConnectedKeys(Array.isArray(detail) ? detail : readConnectedProviderKeys());
    }

    function onStorage(event: StorageEvent) {
      if (event.key === CONNECTED_STORAGE_KEY) {
        setConnectedKeys(readConnectedProviderKeys());
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
      const next = mergeKeys(keysRef.current, providerConnectionKeys(providerId, href));
      keysRef.current = next;
      setConnectedKeys(next);
      writeConnectedProviderKeys(next);
    },
    [],
  );

  const removeConnection = useCallback(
    (providerId: BookingProviderId, href?: string | null) => {
      const removals = new Set(providerConnectionKeys(providerId, href));
      const next = keysRef.current.filter((key) => !removals.has(key));
      keysRef.current = next;
      setConnectedKeys(next);
      writeConnectedProviderKeys(next);
    },
    [],
  );

  const isConnected = useCallback(
    (providerId: BookingProviderId, href?: string | null) =>
      hasProviderConnection(connectedKeys, providerId, href),
    [connectedKeys],
  );

  return {
    connectedKeys,
    connectedCount: useMemo(
      () => countConnectedProviders(connectedKeys),
      [connectedKeys],
    ),
    isConnected,
    saveConnection,
    removeConnection,
  };
}
