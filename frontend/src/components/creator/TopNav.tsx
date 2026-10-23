"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/context/WalletProvider";
import { Bell, LogOut } from "lucide-react";
import { useState } from "react";

const topNavItems = [
  {
    href: "/creator",
    label: "Overview",
  },
  {
    href: "/creator/quests",
    label: "Quests",
  },
  {
    href: "/creator/responses",
    label: "Responses",
  },
  {
    href: "/creator/wallet",
    label: "Wallet",
  },
];

function truncateKey(key: string): string {
  if (key.length <= 8) return key;
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export default function TopNav() {
  const pathname = usePathname();
  const { publicKey, disconnect } = useWallet();
  const [showLogout, setShowLogout] = useState(false);

  const isActive = (href: string) =>
    pathname === href ||
    (href !== "/creator" && pathname.startsWith(href));

  return (
    <header className="shrink-0 border-b-[3px] border-foreground bg-card">
      <div className="flex h-20 items-center justify-between px-5 sm:px-8 lg:px-12">
        <nav className="hidden items-center gap-10 text-sm text-muted-foreground lg:flex">
          {topNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`transition-colors hover:text-foreground ${
                isActive(item.href) ? "text-foreground" : ""
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4 text-sm font-semibold">
          <Bell className="hidden size-5 text-foreground sm:block" />
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowLogout((prev) => !prev)}
              className="flex cursor-pointer items-center gap-2 brutal-border bg-brutal-cyan px-3 py-1.5 font-mono text-xs font-bold text-foreground hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
            >
              <span className="h-2 w-2 bg-brutal-lime brutal-border" />
              {publicKey ? truncateKey(publicKey) : ""}
            </button>
            {showLogout && (
              <div className="absolute right-0 z-50 mt-2 w-48 brutal-border brutal-shadow bg-card p-2">
                <button
                  type="button"
                  onClick={() => {
                    disconnect();
                    setShowLogout(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm font-bold text-foreground hover:bg-brutal-pink/40"
                >
                  <LogOut className="size-4" />
                  Disconnect wallet
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
