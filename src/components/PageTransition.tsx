import { ViewTransition } from "react";
import type { ReactNode } from "react";

/**
 * Wraps page content so route navigations animate: links tagged `nav-forward` slide
 * deeper (content exits left, new page enters from the right), `nav-back` reverses,
 * and untyped navigations crossfade with a small rise. Must wrap each page, not the
 * layout — layouts persist across navigations so enter/exit never fire there.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      enter={{ "nav-forward": "vt-fwd-in", "nav-back": "vt-back-in", default: "vt-in" }}
      exit={{ "nav-forward": "vt-fwd-out", "nav-back": "vt-back-out", default: "vt-out" }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
