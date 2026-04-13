import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";

  const response = NextResponse.redirect(url);

  // Clear all possible auth cookie variants (dev + production prefixes)
  for (const name of [
    "authjs.session-token",
    "authjs.csrf-token",
    "authjs.callback-url",
    "__Secure-authjs.session-token",
    "__Secure-authjs.csrf-token",
    "__Secure-authjs.callback-url",
  ]) {
    response.cookies.set(name, "", { maxAge: 0, path: "/" });
  }

  return response;
}
