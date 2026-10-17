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
  const item = "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-sm text-left text-[13.5px] hover:bg-hair-2 focus-visible:outline-indigo";
  const icon = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, className: "shrink-0" };
  const canEdit = hasPage && handle;
  return <div className="account-menu relative">
    <button type="button" className="grid place-items-center w-9 h-9 rounded-full hover:bg-hair-2 aria-expanded:bg-hair-2" aria-label="Account" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{face("w-7 h-7")}</button>
    <div className={`${open ? "grid" : "hidden"} absolute right-0 top-full mt-1.5 w-64 gap-1 p-2 bg-white border hairline rounded-md shadow-[0_18px_40px_-18px_var(--shadow)] z-30`} role="menu" aria-label="Account">
      <div className="flex items-center gap-3 p-1.5">
        {canEdit
          ? <button type="button" className="group relative shrink-0 rounded-full focus-visible:outline-indigo" aria-label={busy ? "Uploading photo" : "Change photo"} title="Change photo" disabled={busy} onClick={() => fileRef.current?.click()}>
              {face("w-10 h-10")}
              <span className={`absolute inset-0 rounded-full grid place-items-center bg-black/55 text-white transition-opacity ${busy ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}>{busy ? <span className="text-[10px]">…</span> : <svg {...icon} width={15} height={15}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4" /></svg>}</span>
            </button>
          : face("w-10 h-10")}
        <div className="min-w-0 flex-1"><div className="text-[13.5px] text-ink truncate">{name}</div>{handle && <div className="cap truncate">@{handle}</div>}</div>
        {canEdit && <Link href={`/${handle}?edit=1` as "/"} role="menuitem" className="p-1.5 -mr-1 rounded-sm text-grey hover:text-ink hover:bg-hair-2 focus-visible:outline-indigo" aria-label="Edit profile" title="Edit profile" onClick={() => setOpen(false)}><svg {...icon} width={17} height={17}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4" /></svg></Link>}
      </div>
      {canEdit && <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f && await onUpload(f)) setOpen(false); }} />}
      {canEdit && signInPhoto && <button type="button" role="menuitem" className="cap text-left px-2.5 pb-1 hover:text-ink underline-offset-2 hover:underline" onClick={async () => { await onUseSignInPhoto(); setOpen(false); }}>Use my sign-in photo</button>}
      {canEdit && <Link href={`/${handle}` as "/"} role="menuitem" className={`${item} !bg-[var(--indigo-fill)] !text-[var(--on-accent)] font-medium hover:brightness-110`} onClick={() => setOpen(false)}>
        <svg {...icon}><path d="M14 4h6v6M20 4l-8 8M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></svg>View my page
      </Link>}
      {!hasPage && <Link href="/claim" role="menuitem" className={`${item} !bg-[var(--indigo-fill)] !text-[var(--on-accent)] font-medium hover:brightness-110`} onClick={() => { stashReturn(); setOpen(false); }}><svg {...icon}><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>Publish to Explore</Link>}
      <div className="border-t hairline my-1" role="separator" />
      <button type="button" role="menuitem" className={`${item} text-ink-2 hover:text-ink`} onClick={onSignOut}><svg {...icon}><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M15 8l4 4-4 4M19 12H9" /></svg>Sign out</button>
      {error && <p role="alert" className="text-[12px] text-danger px-2.5">{error}</p>}
    </div>
  </div>;
}
