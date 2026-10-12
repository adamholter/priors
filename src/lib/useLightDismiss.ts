"use client";
import { useEffect, type RefObject } from "react";

/** Dismiss transient controls without stealing focus from the next thing clicked. */
export function useLightDismiss(ref: RefObject<HTMLElement | null>, dismiss: (reason: "outside" | "escape") => void) {
  useEffect(() => {
    const outside = (event: Event) => {
      if (ref.current && event.target instanceof Node && !ref.current.contains(event.target)) dismiss("outside");
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && ref.current?.contains(document.activeElement)) dismiss("escape");
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [ref, dismiss]);
}
