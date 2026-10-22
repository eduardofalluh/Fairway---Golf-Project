import { NextResponse } from "next/server";

/** The largest JSON body any Fairway POST route accepts. */
export const MAX_JSON_BYTES = 8 * 1024;

type Guarded = { ok: true; body: unknown } | { ok: false; response: NextResponse };

const reject = (status: number, error: string): Guarded => ({
  ok: false,
  response: NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } }),
});

/**
 * Browsers always send Origin on cross-site POSTs, so a missing Origin means a
 * non-browser client (which CSRF can't come from). A present Origin must match
 * the host this request was sent to.
 */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const hosts = [
    new URL(request.url).host,
    request.headers.get("x-forwarded-host"),
    request.headers.get("host"),
  ].filter(Boolean);
  return hosts.includes(originHost);
}

/**
 * Read a small, same-origin JSON body for a POST route. Rejects other content
 * types (so cross-site HTML forms and text/plain posts can't reach the logic),
 * cross-site origins, and bodies over `maxBytes` without buffering them fully.
 */
export async function readJsonBody(request: Request, maxBytes = MAX_JSON_BYTES): Promise<Guarded> {
  if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? "")) {
    return reject(415, "Send the request as JSON.");
  }
  if (!isSameOrigin(request)) return reject(403, "Cross-site requests are not allowed.");
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return reject(413, "Request is too large.");

  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return reject(413, "Request is too large.");
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return reject(400, "Invalid JSON");
  }
}
