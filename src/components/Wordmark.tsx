import Link from "next/link";

export function Wordmark({ size = 22, href = "/" }: { size?: number; href?: string | null }) {
  const el = <span className="wm" style={{ fontSize: size, lineHeight: 1 }}>pr<i>i</i>ors</span>;
  return href ? <Link href={href as "/"} className="no-underline text-ink">{el}</Link> : el;
}
