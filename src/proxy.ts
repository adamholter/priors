import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Clerk is optional until keys are configured; without them the site is fully anonymous.
const enabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;

export default enabled ? clerkMiddleware() : () => NextResponse.next();

export const config = {
  matcher: ["/((?!_next/static|_next/image|ingest|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)"],
};
