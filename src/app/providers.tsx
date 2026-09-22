"use client";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useMemo, type ReactNode } from "react";

export const authEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
export const convexEnabled = !!convexUrl;

export function Providers({ children }: { children: ReactNode }) {
  const convex = useMemo(() => (convexUrl ? new ConvexReactClient(convexUrl) : null), []);
  let inner: ReactNode = <NuqsAdapter>{children}</NuqsAdapter>;
  if (convex && authEnabled) inner = <ConvexProviderWithClerk client={convex} useAuth={useAuth}>{inner}</ConvexProviderWithClerk>;
  else if (convex) inner = <ConvexProvider client={convex}>{inner}</ConvexProvider>;
  if (!authEnabled) return inner;
  return (
    <ClerkProvider appearance={{ variables: { colorPrimary: "#2F4FB0", fontFamily: "var(--font-inter)", borderRadius: "4px" } }}>
      {inner}
    </ClerkProvider>
  );
}
