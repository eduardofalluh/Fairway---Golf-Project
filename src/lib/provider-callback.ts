import type { BookingProviderId } from "./providers/config";
import { getBookingProvider, safeBookingUrl } from "./providers/config";

export const CONNECTED_PROVIDER_PARAM = "fairwayConnectedProvider";
export const CONNECTED_HREF_PARAM = "fairwayConnectedHref";
export const CONNECTED_NONCE_PARAM = "fairwayConnectNonce";

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
  /** One-time code from `startPendingSignIn`; required to accept the return. */
  nonce: string;
};

export function isConnectableProviderId(
  value: string | null,
): value is Exclude<BookingProviderId, "course"> {
  return Boolean(value && PROVIDER_IDS.has(value as BookingProviderId));
}

/** Where the provider should send the golfer back: the same page and spot. */
export function buildFairwayConnectionReturnUrl(
  providerId: Exclude<BookingProviderId, "course">,
  href: string,
  currentHref: string,
  nonce: string,
) {
  const url = new URL(currentHref);
  url.searchParams.set(CONNECTED_PROVIDER_PARAM, providerId);
  url.searchParams.set(CONNECTED_HREF_PARAM, href);
  url.searchParams.set(CONNECTED_NONCE_PARAM, nonce);
  url.hash ||= "accounts";
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

  const nonce = url.searchParams.get(CONNECTED_NONCE_PARAM) ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(nonce)) return null;

  return { providerId, href, nonce };
}

export function cleanProviderConnectionCallbackUrl(currentHref: string) {
  const url = new URL(currentHref);
  url.searchParams.delete(CONNECTED_PROVIDER_PARAM);
  url.searchParams.delete(CONNECTED_HREF_PARAM);
  url.searchParams.delete(CONNECTED_NONCE_PARAM);
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
