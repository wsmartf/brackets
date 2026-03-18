import { NextResponse } from "next/server";
import { getSnapshots } from "@/lib/db";

export async function GET() {
  return NextResponse.json(getSnapshots());
}
