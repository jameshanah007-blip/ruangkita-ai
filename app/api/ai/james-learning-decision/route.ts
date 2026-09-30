import { NextRequest, NextResponse } from "next/server";
import { decideJamesAutonomousLearning } from "@/app/api/tools/jamesLearningDecisionGate";

function authorized(request: NextRequest) {
  const secret = process.env.JAMES_LEARNING_SECRET ?? process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const decision = await decideJamesAutonomousLearning();
  return NextResponse.json(decision);
}
