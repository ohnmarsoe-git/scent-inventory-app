import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Allow local UI work before Supabase env is configured.
  if (!supabaseUrl || !anonKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const path = request.nextUrl.pathname;
  const isLoginRoute = path.startsWith("/login");
  const isForgotPasswordRoute = path.startsWith("/forgot-password");
  const isUpdatePasswordRoute = path.startsWith("/update-password");
  const isAuthCallback = path.startsWith("/auth/callback");
  const isGuestAuthRoute = isLoginRoute || isForgotPasswordRoute;
  const isOfflineRoute = path === "/offline";
  const isPublicAsset =
    path.startsWith("/_next") ||
    path.startsWith("/favicon") ||
    path.startsWith("/icons") ||
    path === "/sw.js" ||
    path === "/manifest.webmanifest" ||
    path.includes(".");

  if (isPublicAsset) {
    return supabaseResponse;
  }

  // Skip Auth API round-trip when there is no session cookie (faster login page).
  const hasSessionCookie = request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"),
    );

  if (!hasSessionCookie) {
    if (
      isGuestAuthRoute ||
      isUpdatePasswordRoute ||
      isAuthCallback ||
      isOfflineRoute
    ) {
      return supabaseResponse;
    }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // Local JWT verify — avoids a network round-trip on every navigation.
  const { data } = await supabase.auth.getClaims();
  const hasUser = Boolean(data?.claims);

  if (
    !hasUser &&
    !isGuestAuthRoute &&
    !isUpdatePasswordRoute &&
    !isAuthCallback &&
    !isOfflineRoute
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  // Stay on update-password after recovery; bounce signed-in users off login/forgot.
  if (hasUser && isGuestAuthRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
