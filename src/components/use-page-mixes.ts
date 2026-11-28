"use client";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { authEnabled } from "@/app/providers";
import type { IndexConfig } from "@/engine";
import type { PageMixes } from "@/lib/page-mixes";

/** The signed-in visitor's page and its saved mixes; null when signed out, without a page, or before it loads. */
function useSignedInPage(): PageMixes | null {
  const { isAuthenticated } = useConvexAuth();
  const mine = useQuery(api.profiles.mine, isAuthenticated ? {} : "skip");
  return mine ? { handle: mine.handle, indices: mine.indices as IndexConfig[] } : null;
}
const noPage = (): PageMixes | null => null;
// Sign-in is on or off for the whole build, so the hook picked here never changes between renders.
export const usePageMixes = authEnabled ? useSignedInPage : noPage;
