import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      error: "Automatic booking is not available.",
      note: "Complete and confirm this reservation on the provider's page.",
    },
    { status: 501 },
  );
}
