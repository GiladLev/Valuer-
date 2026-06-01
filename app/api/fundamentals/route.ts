import { NextResponse } from "next/server";
import { buildFundamentals } from "@/lib/fmp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ticker = (searchParams.get("ticker") || "").trim();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });
  try {
    const data = await buildFundamentals(ticker);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "fetch failed" },
      { status: 502 }
    );
  }
}
