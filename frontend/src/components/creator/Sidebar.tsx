"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TbLayoutDashboard } from "react-icons/tb";
import { RiFileList3Line, RiFlagLine, RiFeedbackLine } from "react-icons/ri";
import { BiSolidWallet } from "react-icons/bi";
import { HiMenu, HiX } from "react-icons/hi";

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const linkClasses = (href: string) => {
    const isActive =
      pathname === href || (href !== "/creator" && pathname.startsWith(href));
    return `flex items-center gap-2 border-l-[4px] py-2 pl-3 font-bold uppercase tracking-wide text-xs transition-colors ${
      isActive
        ? "border-brutal-pink bg-brutal-yellow/40 text-foreground"
        : "border-transparent text-muted-foreground hover:border-brutal-cyan hover:text-foreground"
    }`;
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        className="fixed right-4 top-4 z-50 flex min-h-11 min-w-11 items-center justify-center brutal-border brutal-shadow bg-brutal-yellow p-2.5 md:hidden"
      >
        {isOpen ? <HiX size={24} /> : <HiMenu size={24} />}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-40 flex h-full w-64 max-w-[80vw] flex-col border-r-[3px] border-foreground bg-card p-4 transition-transform duration-300 sm:w-56 md:relative md:h-screen md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-8 flex items-center justify-between border-b-[3px] border-foreground pb-4">
          <Image src="/logo.png" alt="Logo" width={55} height={32} />
          <span className="text-xs font-black uppercase tracking-wide">Creators</span>
        </div>

        <nav className="flex flex-col gap-3">
          <Link href="/creator" className={linkClasses("/creator")} onClick={() => setIsOpen(false)}>
            <TbLayoutDashboard size={18} />
            <span>Dashboard</span>
          </Link>
          <Link
            href="/creator/quests"
            className={linkClasses("/creator/quests")}
            onClick={() => setIsOpen(false)}
          >
            <RiFileList3Line size={18} />
            <span>Quests</span>
          </Link>
          <Link
            href="/creator/responses"
            className={linkClasses("/creator/responses")}
            onClick={() => setIsOpen(false)}
          >
            <RiFeedbackLine size={18} />
            <span>Responses</span>
          </Link>
          <Link
            href="/creator/milestones"
            className={linkClasses("/creator/milestones")}
            onClick={() => setIsOpen(false)}
          >
            <RiFlagLine size={18} />
            <span>Milestones</span>
          </Link>
          <Link
            href="/creator/wallet"
            className={linkClasses("/creator/wallet")}
            onClick={() => setIsOpen(false)}
          >
            <BiSolidWallet size={18} />
            <span>Wallet</span>
          </Link>
        </nav>

        <div className="mt-auto m-2 h-28 w-full brutal-border brutal-shadow bg-brutal-cyan" />
      </aside>
    </>
  );
}
