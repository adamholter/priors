"use client";
import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Whether an element is within `margin` of the viewport. A page of a hundred charts mounts each one as it
 * scrolls near and drops it when it scrolls far away, so only the few on screen hold a chart instance.
 */
export function useNearView<T extends Element>(margin = 800): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: `${margin}px 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, near];
}
