import { NextResponse, type NextRequest } from "next/server";

export const WORKSPACE_COOKIE = "ws";

// Every visitor gets their own demo workspace, so clicks never leak between visitors.
export function proxy(request: NextRequest) {
  if (request.cookies.get(WORKSPACE_COOKIE)) return NextResponse.next();

  const id = `v-${crypto.randomUUID()}`;
  request.cookies.set(WORKSPACE_COOKIE, id);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(WORKSPACE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron).*)"],
};
