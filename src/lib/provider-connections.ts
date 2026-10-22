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

/** A golfer's own note that they signed in to a provider; Fairway can't verify it. */
export interface ConnectionMark {
  key: string;
  /** When the golfer marked it (ms since epoch). */
  at: number;
}

/** Provider sessions don't last forever, so a mark is only trusted for two weeks. */
export const CONNECTION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Keep valid, unexpired marks. Entries saved before marks carried a time
 * (plain strings) are dropped: nobody knows when they were confirmed.
 */
export function parseConnectionMarks(value: unknown, now = Date.now()): ConnectionMark[] {
  if (!Array.isArray(value)) return [];
  const marks = new Map<string, number>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const { key, at } = entry as Partial<ConnectionMark>;
    if (typeof key !== "string" || !key || typeof at !== "number" || !Number.isFinite(at)) continue;
    if (at > now + 60_000 || now - at > CONNECTION_TTL_MS) continue;
    const [normalized] = normalizeConnectedProviderKeys([key]);
    marks.set(normalized, Math.max(marks.get(normalized) ?? 0, at));
  }
  return [...marks].map(([key, at]) => ({ key, at }));
}

/** Whole days until a mark made at `at` expires (at least 1 while it is valid). */
export function connectionDaysLeft(at: number, now = Date.now()): number {
  return Math.max(1, Math.ceil((at + CONNECTION_TTL_MS - now) / 86_400_000));
}

/** Add or refresh marks for the given keys, all stamped `at`. */
export function addConnectionMarks(marks: ConnectionMark[], keys: string[], at = Date.now()): ConnectionMark[] {
  const next = new Map(marks.map((m) => [m.key, m.at]));
  for (const key of normalizeConnectedProviderKeys(keys)) next.set(key, at);
  return [...next].map(([key, markedAt]) => ({ key, at: markedAt }));
}

/** When the golfer last marked this provider (or club) signed in, if ever. */
export function connectionMarkedAt(
  marks: ConnectionMark[],
  providerId: BookingProviderId,
  href?: string | null,
): number | null {
  const wanted = new Set(normalizeConnectedProviderKeys(providerConnectionKeys(providerId, href)));
  const times = marks.filter((m) => wanted.has(m.key)).map((m) => m.at);
  return times.length ? Math.max(...times) : null;
}

export function readConnectionMarks(now = Date.now()): ConnectionMark[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = window.localStorage.getItem(CONNECTED_STORAGE_KEY);
    return parseConnectionMarks(saved ? JSON.parse(saved) : [], now);
  } catch {
    return [];
  }
}

export function writeConnectionMarks(marks: ConnectionMark[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(CONNECTED_STORAGE_KEY, JSON.stringify(marks));
  } catch {
    // Some privacy contexts disable localStorage. Components still keep state.
  }
  window.dispatchEvent(
    new CustomEvent<ConnectionMark[]>(PROVIDER_CONNECTIONS_CHANGED, { detail: marks }),
  );
}
