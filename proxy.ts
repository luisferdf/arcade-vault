import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Coincidencia exacta de pathname: /auth/callback y /auth/recuperar NO se tocan.
const REQUIRE_SESSION = ["/auth/nueva-contrasena", "/auth/nombre"]; // sin sesión → /auth
const REDIRECT_IF_SESSION = ["/auth"]; // con sesión → /

export async function proxy(request: NextRequest) {
  const { response, hasSession } = await updateSession(request);
  const { pathname } = request.nextUrl;

  let target: string | null = null;
  if (!hasSession && REQUIRE_SESSION.includes(pathname)) target = "/auth";
  else if (hasSession && REDIRECT_IF_SESSION.includes(pathname)) target = "/";

  if (!target) return response;

  // Conserva las cookies de sesión refrescadas en la redirección.
  const redirect = NextResponse.redirect(new URL(target, request.url));
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
