import { NextResponse } from "next/server";
import { createFunZoneCatalog } from "../../../fun-zone/engine/gameCatalog";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const seed = url.searchParams.get("seed") || undefined;
  const count = Number(url.searchParams.get("count") || "8");
  return NextResponse.json({
    success: true,
    seed: seed || "random",
    games: createFunZoneCatalog(seed, count),
  });
}
