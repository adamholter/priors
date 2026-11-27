import { IconArrowsSort, IconChartBar, IconCompass, IconCube, IconListCheck } from "@tabler/icons-react";

export type SiteId = "builder" | "models" | "benchmarks" | "explore" | "rank";
type Href = "/builder" | "/models" | "/benchmarks" | "/explore" | "/rank";

/** The five site-level places, each with the icon the header, the phone row and the footer share. */
export const SITE_PLACES: { id: SiteId; href: Href; label: string; short: string; icon: typeof IconCube; title: string }[] = [
  { id: "builder", href: "/builder", label: "Data", short: "Data", icon: IconChartBar, title: "Rankings and charts for every model" },
  { id: "models", href: "/models", label: "Models", short: "Models", icon: IconCube, title: "Every model Priors tracks, with its rank, benchmarks and price" },
  { id: "benchmarks", href: "/benchmarks", label: "Benchmarks", short: "Benchmarks", icon: IconListCheck, title: "Every benchmark Priors reads, with its quality and leaderboard" },
  { id: "explore", href: "/explore", label: "Explore", short: "Explore", icon: IconCompass, title: "See rankings people have published" },
  { id: "rank", href: "/rank", label: "Rank models", short: "Rank", icon: IconArrowsSort, title: "Find your priors by ranking models" },
];
