"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** Easter egg: press D three times in a row (not while typing) and go to `href`, the 3D view of the ranking in front of you. */
export function useTripleD(href: string | null) {
  const router = useRouter();
  const where = useRef(href);
  useEffect(() => { where.current = href; });
  useEffect(() => {
    let count = 0, last = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== "d") { if (!e.repeat && e.key.toLowerCase() !== "d" && !["Shift", "Meta", "Control", "Alt"].includes(e.key)) count = 0; return; }
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const now = Date.now();
      count = now - last < 900 ? count + 1 : 1; last = now;
      if (count >= 3 && where.current) { count = 0; router.push(where.current as "/3d"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
}
