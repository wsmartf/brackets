import { NextResponse } from "next/server";

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export function requireAdmin(request: Request): NextResponse | null {
  const configuredToken = process.env.ADMIN_TOKEN;

  if (!configuredToken) {
    return NextResponse.json(
      { error: "ADMIN_TOKEN is not configured" },
      { status: 500 }
    );
  }

  const providedToken = getBearerToken(request);
  if (providedToken !== configuredToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
