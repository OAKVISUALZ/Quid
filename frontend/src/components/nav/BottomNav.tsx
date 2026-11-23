"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HiDotsHorizontal, HiX } from "react-icons/hi";
import { ComingSoonNavItem } from "@/components/ui/coming-soon";
import {
  getNavConfig,
  isNavItemActive,
  type DashboardMode,
} from "@/components/nav/config";
import { UPCOMING_FEATURES } from "@/lib/upcoming-features";

export default function BottomNav({ mode }: { mode: DashboardMode }) {
  const pathname = usePathname();
  const [openMorePath, setOpenMorePath] = useState<string | null>(null);
  const isMoreOpen = openMorePath === pathname && pathname !== null;
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const config = getNavConfig(mode);
  const panelId = `bottom-nav-more-${mode}`;
  const comingSoonItems = config.comingSoon.filter(
    ({ feature }) => UPCOMING_FEATURES[feature].status === "coming-soon",
  );

  useEffect(() => {
    if (!isMoreOpen) return;

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMorePath(null);
        moreButtonRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMoreOpen]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div
        id={panelId}
        role="dialog"
        aria-label="More navigation"
        hidden={!isMoreOpen}
        className="absolute bottom-full left-1/2 mb-2 w-[min(20rem,calc(100vw-2rem))] max-w-full -translate-x-1/2 brutal-border brutal-shadow bg-card p-3"
      >
        <div className="mb-2 flex items-center justify-between gap-2 border-b-[3px] border-foreground pb-2">
          <p className="text-xs font-black uppercase tracking-widest">More</p>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => {
              setOpenMorePath(null);
              moreButtonRef.current?.focus();
            }}
            aria-label="Close more navigation"
            className="flex min-h-11 min-w-11 items-center justify-center brutal-border bg-brutal-yellow text-foreground"
          >
            <HiX size={18} />
          </button>
        </div>
        <p className="mb-1 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Coming soon
        </p>
        <div className="flex flex-col gap-1">
          {comingSoonItems.map(({ feature, icon }) => (
            <div key={feature} className="flex min-h-11 items-center">
              <ComingSoonNavItem feature={feature} icon={icon} />
            </div>
          ))}
        </div>
      </div>

      <nav
        aria-label={config.navLabel}
        className="border-t-[3px] border-foreground bg-card pb-[env(safe-area-inset-bottom)]"
      >
        <ul className={`mx-auto grid w-full max-w-md ${mode === "creator" ? "grid-cols-6" : "grid-cols-5"}`}>
          {config.items.map((item) => {
            const Icon = item.icon;
            const isActive = isNavItemActive(pathname, item.href, config.basePath);

            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setOpenMorePath(null)}
                  className={`flex min-h-11 w-full min-w-0 flex-col items-center justify-center gap-1 border-t-[4px] px-0.5 py-1.5 text-center text-[9px] font-black uppercase leading-tight tracking-tight transition-colors ${
                    isActive
                      ? `border-brutal-pink text-foreground ${config.activeClassName}`
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon size={20} />
                  <span className="w-full min-w-0 break-words">{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li className="min-w-0">
            <button
              ref={moreButtonRef}
              type="button"
              onClick={() =>
                setOpenMorePath((current) =>
                  current === pathname ? null : pathname,
                )
              }
              aria-expanded={isMoreOpen}
              aria-controls={panelId}
              aria-label={isMoreOpen ? "Close more navigation" : "Open more navigation"}
              className={`flex min-h-11 w-full min-w-0 flex-col items-center justify-center gap-1 border-t-[4px] px-0.5 py-1.5 text-center text-[9px] font-black uppercase leading-tight tracking-tight transition-colors ${
                isMoreOpen
                  ? `border-brutal-pink text-foreground ${config.activeClassName}`
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <HiDotsHorizontal size={20} />
              <span className="w-full min-w-0">More</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
