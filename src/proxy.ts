import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge-safe proxy — only uses authConfig (no Mongoose/Node.js imports)
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|theme-init.js).*)"],
};
