import { type NextRequest, NextResponse } from "next/server";

import { RETURN_URL_HEADER } from "@/lib/return-url";

// layouts can't see the url -> pass it so the auth guard can build returnUrl
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set(RETURN_URL_HEADER, req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: "/app/:path*" };
