import type { BookingProviderId } from "./providers/config";

export const CONNECTED_STORAGE_KEY = "fairway-provider-connections";
export const PROVIDER_CONNECTIONS_CHANGED = "fairway-provider-connections-change";

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function gggolfClubScope(href: string | null | undefined) {
  if (!href) return null;
  try {
    const url = new URL(href);
    const hostname = url.hostname.toLowerCase();
    if (hostname !== "gggolf.ca" && !hostname.endsWith(".gggolf.ca")) {
      return null;
    }
    const club = url.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
    return club ? `gggolf:${hostname}/${club}` : null;
  } catch {
    return null;
  }
}

export function providerConnectionKey(
  providerId: BookingProviderId,
  href?: string | null,
) {
  if (providerId === "gggolf") {
    return gggolfClubScope(href) ?? "gggolf:pending";
  }
  return `provider:${providerId}`;
}

export function providerConnectionKeys(
  providerId: BookingProviderId,
  href?: string | null,
) {
  return unique([
    providerConnectionKey(providerId, href),
    href ? `${providerId}:${href}` : "",
    providerId === "gggolf" ? gggolfClubScope(href) ?? "" : "",
  ]);
}

export function normalizeConnectedProviderKeys(keys: string[]) {
  const normalized = new Set<string>();
  for (const key of keys) {
    if (key.startsWith("provider:")) {
      normalized.add(key);
      continue;
    }
    if (key.startsWith("chronogolf:")) {
      normalized.add("provider:chronogolf");
      continue;
    }
    if (key.startsWith("minutegolf:")) {
      normalized.add("provider:minutegolf");
      continue;
    }
    if (key.startsWith("gggolf:")) {
      const href = key.slice("gggolf:".length);
      normalized.add(gggolfClubScope(href) ?? key);
      continue;
    }
    normalized.add(key);
  }
  return Array.from(normalized);
}

export function hasProviderConnection(
  keys: string[],
  providerId: BookingProviderId,
  href?: string | null,
) {
  const normalized = new Set(normalizeConnectedProviderKeys(keys));
  return providerConnectionKeys(providerId, href).some((key) =>
    normalized.has(key),
  );
}

export function countConnectedProviders(keys: string[]) {
  return normalizeConnectedProviderKeys(keys).filter(
    (key) => !key.endsWith(":pending"),
  ).length;
}

export function readConnectedProviderKeys() {
  if (typeof window === "undefined") return [] as string[];
  try {
    const saved = window.localStorage.getItem(CONNECTED_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

export function writeConnectedProviderKeys(keys: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(CONNECTED_STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Some privacy contexts disable localStorage. Components still keep state.
  }
  window.dispatchEvent(
    new CustomEvent<string[]>(PROVIDER_CONNECTIONS_CHANGED, { detail: keys }),
  );
}
