import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware({
  ...routing,
  localeDetection: false,
});

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (pathname === "/regrubecaf" || pathname.startsWith("/regrubecaf/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace("/regrubecaf", "/admin");
    return NextResponse.rewrite(url);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Match all paths except API, internals, and static files
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
