import type { ReactNode } from "react";
import { Wordmark } from "./Wordmark";
import { SiteNav } from "./SiteNav";
import { SiteSearchButton } from "./SiteSearch";
import { HeaderAccount } from "./AccountMenu";
import { SettingsButton } from "./SiteSettings";
import type { SiteId } from "./site-places";
import { RankFloat } from "./RankFloat";

/**
 * The header every page of the site shares, so its height, spacing and contents match everywhere: the wordmark, the five places, the
 * universal search (an open field from 1024px, which grows into the free space up to 340px; an icon below that), then the page's own
 * actions (`actions`), sign-in and settings. On phones the five places, with Search, are a row under it that hides while you scroll down.
 * The Builder and published pages keep their own headers (mix tabs, share, publish) at the same height.
 */
export function SiteHeader({ current, actions, account = true }: { current?: SiteId; actions?: ReactNode; account?: boolean }) {
  return <header className="site-header flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-8 py-2 sm:min-h-14 border-b hairline">
    <div className="flex items-center gap-5 shrink-0"><Wordmark /><span className="max-sm:hidden"><SiteNav current={current} /></span></div>
    <div className="max-lg:hidden flex-1 min-w-[150px] max-w-[340px]"><SiteSearchButton wide /></div>
    <span className="ml-auto flex items-center gap-2"><span className="max-sm:hidden lg:hidden"><SiteSearchButton /></span>{actions}{account && <HeaderAccount />}<SettingsButton /></span>
    <span className="sm:hidden w-full"><SiteNav current={current} mobile /></span>
    {current !== "rank" && <RankFloat />}
  </header>;
}
