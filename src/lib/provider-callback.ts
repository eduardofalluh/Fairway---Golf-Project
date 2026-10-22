import type { BookingProviderId } from "./providers/config";
import { getBookingProvider, safeBookingUrl } from "./providers/config";

export const CONNECTED_PROVIDER_PARAM = "fairwayConnectedProvider";
export const CONNECTED_HREF_PARAM = "fairwayConnectedHref";

const PROVIDER_IDS = new Set<BookingProviderId>([
  "chronogolf",
  "teetime",
  "golfthe6ix",
  "golfnow",
  "ezlinks",
  "teeitup",
  "linkline",
  "jonas",
  "clublink",
  "minutegolf",
  "gggolf",
]);

export type ProviderConnectionCallback = {
  providerId: Exclude<BookingProviderId, "course">;
  href: string;
};

export function isConnectableProviderId(
  value: string | null,
): value is Exclude<BookingProviderId, "course"> {
  return Boolean(value && PROVIDER_IDS.has(value as BookingProviderId));
}

export function buildFairwayConnectionReturnUrl(
  providerId: Exclude<BookingProviderId, "course">,
  href: string,
  currentHref: string,
) {
  const url = new URL(currentHref);
  url.searchParams.set(CONNECTED_PROVIDER_PARAM, providerId);
  url.searchParams.set(CONNECTED_HREF_PARAM, href);
  url.hash = "accounts";
  return url.toString();
}

export function parseProviderConnectionCallback(
  currentHref: string,
): ProviderConnectionCallback | null {
  let url: URL;
  try {
    url = new URL(currentHref);
  } catch {
    return null;
  }

  const providerId = url.searchParams.get(CONNECTED_PROVIDER_PARAM);
  if (!isConnectableProviderId(providerId)) return null;

  const href = safeBookingUrl(url.searchParams.get(CONNECTED_HREF_PARAM) ?? "");
  if (!href) return null;

  const provider = getBookingProvider(href);
  if (provider.id !== providerId) return null;

  return { providerId, href };
}

export function cleanProviderConnectionCallbackUrl(currentHref: string) {
  const url = new URL(currentHref);
  url.searchParams.delete(CONNECTED_PROVIDER_PARAM);
  url.searchParams.delete(CONNECTED_HREF_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function providerLoginUrlWithReturn(
  providerId: Exclude<BookingProviderId, "course">,
  href: string,
  fairwayReturnUrl: string,
) {
  if (providerId === "chronogolf") {
    const login = new URL("https://www.chronogolf.com/login");
    login.searchParams.set("returnUrl", fairwayReturnUrl);
    return login.toString();
  }
  return href;
}
