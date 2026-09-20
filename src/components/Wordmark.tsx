import Link from "next/link";

export function Wordmark({ size = 28, href = "/", transitionTypes }: { size?: number; href?: string | null; transitionTypes?: string[] }) {
  const el = <span className="wm" style={{ fontSize: size, lineHeight: 1 }}>pr<i>i</i>ors</span>;
  return href ? <Link href={href as "/"} transitionTypes={transitionTypes} className="no-underline text-ink">{el}</Link> : el;
}
