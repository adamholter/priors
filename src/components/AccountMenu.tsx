"use client";
import { useClerk, useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { authEnabled } from "@/app/providers";
import { stashReturn } from "@/lib/share";
import { useForgetResume } from "./ResumeSignIn";
import { IMAGE_ACCEPT, useImageUpload, useSignInPhoto } from "./useImageUpload";

/** Header account control. Signed out: "Sign in". Signed in: your photo, opening a menu to change it, edit your page and sign out. */
export function HeaderAccount({ className = "btn-quiet" }: { className?: string }) {
  return authEnabled ? <Gate className={className} /> : null;
}
function Gate({ className }: { className: string }) {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return null;
  // Same key the builder uses, so sign-in returns to the page it started from.
  if (!isSignedIn) return <Link href="/sign-in" transitionTypes={["nav-forward"]} className={className} onClick={stashReturn}>Sign in</Link>;
  return <AccountMenu />;
}

/** The signed-in person's photo, which is their page's photo (an upload, or the sign-in photo until they pick one). */
export function AccountMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { isAuthenticated } = useConvexAuth();
  const mine = useQuery(api.profiles.mine, isAuthenticated ? {} : "skip");
  const update = useMutation(api.profiles.update);
  const forgetResume = useForgetResume();
  const router = useRouter();
  const signInPhoto = useSignInPhoto();
  const { upload, error, busy, clearError } = useImageUpload();
  return <AccountMenuView
    photo={mine?.avatarUrl ?? user?.imageUrl} name={mine?.displayName || user?.fullName || user?.username || ""}
    handle={mine?.handle} hasPage={mine !== null} signInPhoto={signInPhoto && signInPhoto !== mine?.avatarUrl ? signInPhoto : undefined}
    busy={busy} error={error} onClose={clearError} onUpload={upload}
    onUseSignInPhoto={async () => { await update({ patch: { avatarUrl: signInPhoto } }); router.refresh(); }}
    onSignOut={() => { forgetResume(); void signOut({ redirectUrl: "/" }); }} />;
}

export interface AccountMenuViewProps {
  photo?: string; name: string; handle?: string;
  /** False when signed in without a published page yet: no photo to change, so the menu offers to publish. */
  hasPage: boolean;
  /** Set when the sign-in photo differs from the page's. */
  signInPhoto?: string;
  busy: boolean; error: string;
  onClose: () => void;
  onUpload: (file: File) => Promise<boolean>;
  onUseSignInPhoto: () => Promise<void>;
  onSignOut: () => void;
}

export function AccountMenuView({ photo, name, handle, hasPage, signInPhoto, busy, error, onClose, onUpload, onUseSignInPhoto, onSignOut }: AccountMenuViewProps) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => { if (e instanceof KeyboardEvent ? e.key === "Escape" : !(e.target as HTMLElement).closest(".account-menu")) { setOpen(false); onClose(); } };
    addEventListener("pointerdown", close); addEventListener("keydown", close);
    return () => { removeEventListener("pointerdown", close); removeEventListener("keydown", close); };
  }, [open, onClose]);
  // eslint-disable-next-line @next/next/no-img-element
  const face = (size: string) => photo ? <img src={photo} alt="" className={`${size} rounded-full object-cover shrink-0`} /> : <span className={`${size} rounded-full bg-hair-2 grid place-items-center serif text-ink-2 shrink-0`}>{(name || "?")[0]}</span>;
  const item = "btn-quiet text-left w-full block !border-0 hover:bg-hair-2";
  return <div className="account-menu relative">
    <button type="button" className="grid place-items-center w-9 h-9 rounded-full hover:bg-hair-2 aria-expanded:bg-hair-2" aria-label="Account" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{face("w-7 h-7")}</button>
    <div className={`${open ? "grid" : "hidden"} absolute right-0 top-full mt-1.5 w-60 gap-1 p-3 bg-white border hairline rounded-md shadow-[0_18px_40px_-18px_var(--shadow)] z-30`} role="menu" aria-label="Account">
      <div className="flex items-center gap-3 pb-2 mb-1 border-b hairline">
        {face("w-10 h-10")}
        <div className="min-w-0"><div className="text-[13.5px] text-ink truncate">{name}</div>{handle && <div className="cap truncate">@{handle}</div>}</div>
      </div>
      {hasPage && handle && <>
        <button type="button" role="menuitem" className={item} disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? "Uploading…" : "Change photo"}</button>
        <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f && await onUpload(f)) setOpen(false); }} />
        {signInPhoto && <button type="button" role="menuitem" className={item} onClick={async () => { await onUseSignInPhoto(); setOpen(false); }}>Use my sign-in photo</button>}
        <Link href={`/${handle}?edit=1` as "/"} role="menuitem" className={item} onClick={() => setOpen(false)}>Edit profile</Link>
        <Link href={`/${handle}` as "/"} role="menuitem" className={item} onClick={() => setOpen(false)}>View my page</Link>
      </>}
      {!hasPage && <Link href="/claim" role="menuitem" className={item} onClick={() => { stashReturn(); setOpen(false); }}>Publish to Explore</Link>}
      <button type="button" role="menuitem" className={item} onClick={onSignOut}>Sign out</button>
      {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}
    </div>
  </div>;
}
