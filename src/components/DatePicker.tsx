"use client";
import { useRouter } from "next/navigation";

/** Time travel: every day's snapshot is kept, so the whole page can be viewed as of any date. */
export function DatePicker({ current, dates }: { current: string; dates: string[] }) {
  const router = useRouter();
  if (dates.length <= 1) return <span className="cap" title="Snapshot date">{current}</span>;
  return (
    <select value={current} onChange={(e) => { const u = new URL(window.location.href); if (e.target.value === dates[0]) u.searchParams.delete("date"); else u.searchParams.set("date", e.target.value); router.push((u.pathname + u.search) as "/"); }} className="cap bg-transparent border-0 cursor-pointer" title="View as of date">
      {dates.map((d) => <option key={d} value={d}>{d}{d === dates[0] ? " (latest)" : ""}</option>)}
    </select>
  );
}
