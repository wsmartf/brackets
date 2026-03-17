import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { listAuditLog } from "@/lib/db";

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) {
    return authError;
  }

  const url = new URL(request.url);
  const rawLimit = url.searchParams.get("limit");
  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 200)
      : 50;

  return NextResponse.json(listAuditLog(limit));
}
