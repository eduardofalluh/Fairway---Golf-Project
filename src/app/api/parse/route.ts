import { NextResponse } from "next/server";
import { REGIONS } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * AI natural-language search parser — via a LiteLLM proxy.
 *
 * Takes a free-text request ("cheap twilight 9 for 3 near Laval this weekend
 * under $50") + today's date and returns a structured search query the
 * TeeFinder form can apply.
 *
 * Talks to a LiteLLM proxy using its OpenAI-compatible /chat/completions
 * endpoint (LiteLLM virtual keys are NOT direct Anthropic keys). Configure via
 * env (.env.local — gitignored):
 *   LITELLM_BASE_URL  e.g. https://litellm.example.com  (or …/v1)
 *   LITELLM_MODEL     the model/alias your proxy exposes, e.g. claude-opus-4-8
 *   LITELLM_API_KEY   the proxy key (falls back to ANTHROPIC_API_KEY)
 */

const SORTS = [
  "price-desc",
  "price-asc",
  "closest-price",
  "closest-time",
  "distance",
] as const;
const HOLES = ["any", "9", "18"] as const;

const FIELD_SPEC = `Return ONLY a JSON object with exactly these keys:
- date: string "YYYY-MM-DD". Resolve relative dates ("today","this weekend","next Saturday") against today's date. Default = today.
- time: string 24h "HH:MM". morning≈08:00, midday/noon≈12:00, afternoon≈14:00, twilight/evening≈17:00, dawn/early≈06:30. Default 13:00.
- window: integer minutes 0–180 of flexibility. flexible≈120, around≈60, exactly/sharp≈15. Default 60.
- players: integer 1–4. Default 2.
- holes: one of "any","9","18". Default "any".
- useTarget: boolean — true only if a budget/price preference was expressed (cheap, under $X, around $X).
- targetPrice: integer 20–200 CAD per player. cheap≈45; "around $X"→X. Only meaningful when useTarget is true.
- maxPrice: integer 20–250 CAD per player. "under $X"→X. Default 140.
- regions: array of zero or more of ${JSON.stringify(REGIONS)}. Empty = all regions. Only include regions the user clearly named/implied.
- publicOnly: boolean — true only if the user restricts to public/municipal courses. Default false.
- sort: one of ${JSON.stringify([...SORTS])}. "cheapest first"→price-asc, "best/premium first"→price-desc, "on budget"→closest-price, "closest to my time"→closest-time, "nearest"→distance. Default price-asc if a budget is mentioned, else closest-time.
Do not include any other keys, prose, or markdown — just the JSON object.`;

/** Coerce a raw LLM object into a safe, fully-defaulted search query. */
function coerce(raw: Record<string, unknown>, today: string) {
  const int = (v: unknown, def: number, lo: number, hi: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
  };
  const dateOk =
    typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date);
  const timeOk =
    typeof raw.time === "string" && /^\d{1,2}:\d{2}$/.test(raw.time);
  const regions = Array.isArray(raw.regions)
    ? raw.regions.filter((r): r is string => (REGIONS as string[]).includes(r as string))
    : [];
  return {
    date: dateOk ? (raw.date as string) : today,
    time: timeOk
      ? (raw.time as string).padStart(5, "0")
      : "13:00",
    windowMinutes: int(raw.window, 60, 0, 180),
    players: int(raw.players, 2, 1, 4),
    holes: (HOLES as readonly string[]).includes(raw.holes as string)
      ? (raw.holes as "any" | "9" | "18")
      : "any",
    useTarget: Boolean(raw.useTarget),
    targetPrice: int(raw.targetPrice, 70, 20, 200),
    maxPrice: int(raw.maxPrice, 140, 20, 250),
    regions,
    publicOnly: Boolean(raw.publicOnly),
    sort: (SORTS as readonly string[]).includes(raw.sort as string)
      ? (raw.sort as (typeof SORTS)[number])
      : raw.useTarget
        ? "price-asc"
        : "closest-time",
  };
}

function chatUrl(base: string): string {
  const b = base.replace(/\/+$/, "");
  return /\/v\d+$/.test(b) ? `${b}/chat/completions` : `${b}/v1/chat/completions`;
}

export async function POST(request: Request) {
  const baseUrl = process.env.LITELLM_BASE_URL;
  const apiKey = process.env.LITELLM_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  const model = process.env.LITELLM_MODEL ?? "claude-opus-4-8";

  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      {
        error:
          "AI search is not configured. Set LITELLM_BASE_URL and LITELLM_API_KEY (and optionally LITELLM_MODEL) in .env.local.",
      },
      { status: 503 },
    );
  }

  let body: { q?: string; today?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const q = (body.q ?? "").trim();
  const today =
    body.today && /^\d{4}-\d{2}-\d{2}$/.test(body.today)
      ? body.today
      : new Date().toISOString().slice(0, 10);

  if (!q) return NextResponse.json({ error: "Empty request" }, { status: 400 });
  if (q.length > 500)
    return NextResponse.json({ error: "Request too long" }, { status: 400 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(chatUrl(baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 1024,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You convert a golfer's plain-English request into a structured tee-time search for a Greater Montréal aggregator. Be literal: only set filters the user actually expressed; leave everything else at its default. Never invent a region or budget the user did not mention.\n\n${FIELD_SPEC}`,
          },
          {
            role: "user",
            content: `Today's date is ${today}. Parse this tee-time request:\n\n"${q}"`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("LiteLLM error", res.status, detail.slice(0, 300));
      const msg =
        res.status === 401
          ? "AI proxy rejected the key (check LITELLM_API_KEY / LITELLM_BASE_URL)."
          : "AI search failed. Try the manual filters.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "";
    if (!content) throw new Error("Empty completion");

    // Tolerate fenced/`json …` wrappers if the model adds them.
    const jsonText = content.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;

    return NextResponse.json({ query: coerce(parsed, today) });
  } catch (err) {
    console.error("AI parse failed", err);
    return NextResponse.json(
      { error: "AI search failed. Try the manual filters." },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
