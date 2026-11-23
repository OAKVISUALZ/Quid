import type { ComponentType } from "react";
import { BiSolidWallet } from "react-icons/bi";
import { RiBankLine, RiFileList3Line, RiFlagLine, RiMessage2Line } from "react-icons/ri";
import { TbLayoutDashboard } from "react-icons/tb";
import { LuClipboardCheck, LuScale, LuShieldCheck } from "react-icons/lu";
import type { UpcomingFeatureId } from "@/lib/upcoming-features";

export type NavIcon = ComponentType<{ size?: number }>;

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
}

export interface ComingSoonNavEntry {
  feature: UpcomingFeatureId;
  icon: NavIcon;
}

export type DashboardMode = "hunter" | "creator";

export interface DashboardNavConfig {
  mode: DashboardMode;
  basePath: string;
  modeLabel: string;
  logoAlt: string;
  navLabel: string;
  items: readonly NavItem[];
  comingSoon: readonly ComingSoonNavEntry[];
  activeClassName: string;
  promo: {
    className: string;
    title?: string;
    description?: string;
  };
}

export const HUNTER_NAV_ITEMS: readonly NavItem[] = [
  { href: "/hunter", label: "Dashboard", icon: TbLayoutDashboard },
  { href: "/hunter/mission-board", label: "Mission Board", icon: RiFileList3Line },
  { href: "/hunter/my-submissions", label: "My Submissions", icon: LuClipboardCheck },
  { href: "/hunter/wallet", label: "Wallet", icon: BiSolidWallet },
];

export const CREATOR_NAV_ITEMS: readonly NavItem[] = [
  { href: "/creator", label: "Dashboard", icon: TbLayoutDashboard },
  { href: "/creator/quests", label: "Missions", icon: RiFileList3Line },
  { href: "/creator/responses", label: "Responses", icon: RiMessage2Line },
  { href: "/creator/milestones", label: "Milestones", icon: RiFlagLine },
  { href: "/creator/wallet", label: "Wallet", icon: BiSolidWallet },
];

export const NAV_CONFIG: Record<DashboardMode, DashboardNavConfig> = {
  hunter: {
    mode: "hunter",
    basePath: "/hunter",
    modeLabel: "Hunters",
    logoAlt: "Quid",
    navLabel: "Hunter navigation",
    items: HUNTER_NAV_ITEMS,
    comingSoon: [
      { feature: "disputes", icon: LuScale },
      { feature: "sep24-cashout", icon: RiBankLine },
    ],
    activeClassName: "bg-brutal-yellow/30",
    promo: {
      className: "mt-auto brutal-border brutal-shadow bg-brutal-orange p-4 text-sm",
      title: "Hunter mode",
      description:
        "Test Stellar dApps, file reports, and track every reward you earn.",
    },
  },
  creator: {
    mode: "creator",
    basePath: "/creator",
    modeLabel: "Creators",
    logoAlt: "Logo",
    navLabel: "Creator navigation",
    items: CREATOR_NAV_ITEMS,
    comingSoon: [
      { feature: "proof-of-test", icon: LuShieldCheck },
      { feature: "disputes", icon: LuScale },
    ],
    activeClassName: "bg-brutal-yellow/40",
    promo: {
      className:
        "m-2 mt-auto h-28 w-full brutal-border brutal-shadow bg-brutal-cyan",
    },
  },
};

export function getNavConfig(mode: DashboardMode): DashboardNavConfig {
  return NAV_CONFIG[mode];
}

function normalizePath(path: string): string {
  return path.replace(/\/+$/, "") || "/";
}

export function isNavItemActive(
  pathname: string,
  itemOrHref: string | NavItem,
  basePathOrConfig: string | Pick<DashboardNavConfig, "basePath">,
): boolean {
  const href = typeof itemOrHref === "string" ? itemOrHref : itemOrHref.href;
  const basePath =
    typeof basePathOrConfig === "string"
      ? basePathOrConfig
      : basePathOrConfig.basePath;
  const current = normalizePath(pathname);
  const target = normalizePath(href);

  if (current === target) return true;
  if (target === normalizePath(basePath)) return false;

  return current.startsWith(`${target}/`);
}
