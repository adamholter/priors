"use client";
import { useState } from "react";
import { useAuth, useUser } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { fitWithin } from "@/lib/avatar";

/** What the picker offers; the upload endpoint (convex/http.ts) decides by the file's bytes. */
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/avif";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** Convex serves HTTP endpoints from the deployment's .convex.site address. */
const UPLOAD_URL = `${(process.env.NEXT_PUBLIC_CONVEX_URL ?? "").replace(/\.convex\.cloud\/?$/, ".convex.site")}/upload`;

/** Longest side kept for each kind of image. A photo is shown small and a banner across the page, and an uploaded original can be megabytes. */
const MAX_SIDE = { avatar: 512, banner: 2400 };

/** A smaller copy to upload. Animation and anything the browser cannot redraw go up as they are. */
async function shrunk(file: File, max: number): Promise<File> {
  if (file.type === "image/gif" || typeof createImageBitmap === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const size = fitWithin(bitmap.width, bitmap.height, max);
    const canvas = document.createElement("canvas");
    canvas.width = size.width; canvas.height = size.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/webp", 0.86));
    return blob && blob.type === "image/webp" && blob.size < file.size ? new File([blob], file.name, { type: "image/webp" }) : file;
  } catch { return file; }
}

/** The photo from the sign-in account (Google's, when that is how they signed in). */
export function useSignInPhoto(): string | undefined {
  const { user } = useUser();
  return user?.externalAccounts.find((a) => /google/.test(a.provider))?.imageUrl || (user?.hasImage ? user.imageUrl : undefined);
}

/**
 * Sends a photo or banner to the backend's upload endpoint, which checks and stores it. Only for the
 * signed-in owner of a page: the endpoint takes the user's Convex token and nothing else.
 */
export function useImageUpload() {
  const router = useRouter();
  const { getToken, sessionClaims } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // The same token Convex's own provider sends: the session token when Clerk issues it for Convex, else the "convex" template.
  const convexToken = () => sessionClaims?.aud === "convex" ? getToken() : getToken({ template: "convex" });
  const upload = async (file: File, field: "avatar" | "banner" = "avatar") => {
    setError(""); setBusy(true);
    try {
      if (file.size > MAX_IMAGE_BYTES) throw new Error("That image is over 8 MB");
      file = await shrunk(file, MAX_SIDE[field]);
      const res = await fetch(`${UPLOAD_URL}?field=${field}`, { method: "POST", headers: { Authorization: `Bearer ${await convexToken()}`, "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "");
      router.refresh();
      return true;
    } catch (e) { setError(e instanceof Error && e.message && e.message !== "Failed to fetch" ? e.message : "Couldn’t upload that image. Try again."); return false; }
    finally { setBusy(false); }
  };
  return { upload, error, busy, clearError: () => setError("") };
}
