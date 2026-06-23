import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { REGIONS } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * AI natural-language search parser.
 *
 * Takes a free-text request ("cheap twilight 9 for 3 near Laval this weekend
 * under $50") + today's date and returns a structured search query the
 * TeeFinder form can apply. Uses Claude with structured outputs so the response
 * is always valid JSON matching SEARCH_SCHEMA — no brittle string parsing.
 */

const SEARCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    date: {
      type: "string",
      description:
        "Target date as YYYY-MM-DD. Resolve relative dates ('today', 'this weekend', 'next Saturday') against the provided today's date. Default to today if unspecified.",
    },
    time: {
      type: "string",
      description:
        "Preferred tee-off time as 24h HH:MM. Map words: 'morning'≈08:00, 'midday'/'noon'≈12:00, 'afternoon'≈14:00, 'twilight'/'evening'≈17:00, 'dawn'/'early'≈06:30. Default 13:00.",
    },
    window: {
      type: "integer",
      description:
        "Flexibility in minutes around the time, 0 to 180. 'flexible'≈120, 'around'≈60, 'exactly'/'sharp'≈15. Default 60.",
    },
    players: {
      type: "integer",
      description: "Number of players, 1 to 4. Default 2.",
    },
    holes: {
      type: "string",
      enum: ["any", "9", "18"],
      description: "Round length. Default 'any'.",
    },
    useTarget: {
      type: "boolean",
      description:
        "True if the user expressed a budget or price preference (e.g. 'cheap', 'under $X', 'around $X'). Otherwise false.",
    },
    targetPrice: {
      type: "integer",
      description:
        "Ideal price per player in CAD, 20 to 200. For 'cheap' use ~45. For 'around $X' use X. Ignored when useTarget is false.",
    },
    maxPrice: {
      type: "integer",
      description:
        "Hard price ceiling per player in CAD, 20 to 250. For 'under $X' set this to X. Default 140.",
    },
    regions: {
      type: "array",
      description:
        "Region filter. Empty array means all regions. Only include regions the user clearly named or implied.",
      items: { type: "string", enum: REGIONS },
    },
    publicOnly: {
      type: "boolean",
      description:
        "True only if the user explicitly restricts to public / municipal courses. Default false.",
    },
    sort: {
      type: "string",
      enum: [
        "price-desc",
        "price-asc",
        "closest-price",
        "closest-time",
        "distance",
      ],
      description:
        "Result ordering. 'cheapest first'→price-asc, 'best/premium first'→price-desc, 'on budget'→closest-price, 'closest to my time'→closest-time, 'nearest to me'→distance. Default price-asc when a budget is mentioned, else closest-time.",
    },
  },
  required: [
    "date",
    "time",
    "window",
    "players",
    "holes",
    "useTarget",
    "targetPrice",
    "maxPrice",
    "regions",
    "publicOnly",
    "sort",
  ],
} as const;

const SYSTEM = `You convert a golfer's plain-English request into a structured tee-time search for a Greater Montréal aggregator. Be literal: only set filters the user actually expressed, and leave everything else at its default. Never invent a region or budget the user did not mention. Output must satisfy the provided schema.`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI search is not configured (missing ANTHROPIC_API_KEY)." },
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

  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: SEARCH_SCHEMA } },
      messages: [
        {
          role: "user",
          content: `Today's date is ${today}. Parse this tee-time request:\n\n"${q}"`,
        },
      ],
    });

    if (message.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Could not understand that request." },
        { status: 422 },
      );
    }

    const text = message.content.find((b) => b.type === "text");
    if (!text || text.type !== "text")
      throw new Error("No text block in response");

    const parsed = JSON.parse(text.text);
    return NextResponse.json({ query: parsed });
  } catch (err) {
    console.error("AI parse failed", err);
    return NextResponse.json(
      { error: "AI search failed. Try the manual filters." },
      { status: 502 },
    );
  }
}
