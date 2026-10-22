"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, BriefcaseBusiness, RefreshCw, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton-list";
import { fetchPublicMissions, type PublicMission } from "@/lib/missions-api";

/** Issue #326: hunter mission board, wired to `GET /missions`. */

type BoardFilter = "all" | "open" | "completed";

interface Mission {
  id: string;
  brand: string;
  title: string;
  category: string;
  reward: string;
  posted: string;
  icon: string;
  status: "open" | "completed";
}

const MISSION_ICONS = [
  "/dashboard/brand1.svg",
  "/dashboard/brand2.svg",
  "/dashboard/brand3.svg",
  "/dashboard/brand4.svg",
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function shortAddress(address: string): string {
  return address.length > 10 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;
}

function getRelativeTime(value: string): string {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (elapsedSeconds < 60) return "just now";
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}m ago`;
  if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)}h ago`;
  return `${Math.floor(elapsedSeconds / 86400)}d ago`;
}

function mapMission(mission: PublicMission, index: number): Mission {
  const metadata = asRecord(mission.metadata);
  const isOpen = mission.status === "OPEN" || mission.status === "STARTED";

  return {
    id: mission.id,
    brand:
      mission.owner?.displayName ||
      (mission.owner?.address ? shortAddress(mission.owner.address) : "Quid Founder"),
    title: mission.title,
    category: typeof metadata.category === "string" ? metadata.category : "Product Quest",
    reward: `${Number(mission.rewardAmount) || 0} XLM`,
    posted: `Posted ${getRelativeTime(mission.createdAt)}`,
    icon: MISSION_ICONS[index % MISSION_ICONS.length],
    status: isOpen ? "open" : "completed",
  };
}

/** `BoardFilter` -> the backend's `MissionQueryStatus`, when there is a direct mapping. */
function filterToApiStatus(filter: BoardFilter): "OPEN" | "COMPLETED" | undefined {
  if (filter === "open") return "OPEN";
  if (filter === "completed") return "COMPLETED";
  return undefined;
}

export default function MissionBoardPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<BoardFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadMissions = useCallback(async (activeFilter: BoardFilter) => {
    setLoading(true);
    setError(null);

    try {
      const apiMissions = await fetchPublicMissions({
        status: filterToApiStatus(activeFilter),
        sort: "newest",
      });
      setMissions(apiMissions.map(mapMission));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load missions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only re-fetch when the server-side filter changes; search stays client-side.
    const timeoutId = window.setTimeout(() => void loadMissions(filter), 0);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleRefresh = () => {
    void loadMissions(filter);
  };

  const filteredMissions = missions.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.brand.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background brutal-grid-bg px-5 py-8 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-foreground/70">
              Hunter Portal
            </p>
            <h1 className="mt-1 text-3xl font-black uppercase tracking-tight sm:text-4xl">
              Mission Board
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Browse available quests from Stellar builders, give feedback, and earn rewards.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 brutal-border brutal-shadow bg-card px-4 py-2 text-sm font-bold uppercase tracking-wide hover:bg-muted"
          >
            <RefreshCw className="size-4" />
            Refresh
          </button>
        </div>

        {/* Controls */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {(["all", "open", "completed"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`brutal-border px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-transform ${
                  filter === tab
                    ? "bg-primary text-primary-foreground brutal-shadow"
                    : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search missions or founders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full brutal-border bg-card py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="mt-6">
          {loading ? (
            <SkeletonList count={4} variant="quest" />
          ) : error ? (
            <div className="flex flex-col items-center py-12 text-center">
              <AlertCircle className="mb-3 size-6 text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
              <button
                type="button"
                onClick={handleRefresh}
                className="mt-4 brutal-border bg-card px-4 py-2 text-sm font-bold uppercase hover:bg-muted"
              >
                Try again
              </button>
            </div>
          ) : filteredMissions.length === 0 ? (
            <EmptyState
              title={searchQuery ? "No missions match your search" : "No missions available"}
              description={
                searchQuery
                  ? `No missions found matching "${searchQuery}". Try a different search term or clear the filter.`
                  : "There are currently no missions listed in this category. Check back soon for new missions."
              }
              variant="card"
              action={
                searchQuery
                  ? {
                      label: "Clear Search",
                      onClick: () => setSearchQuery(""),
                    }
                  : {
                      label: "View All Missions",
                      onClick: () => {
                        setFilter("all");
                        setSearchQuery("");
                      },
                    }
              }
            />
          ) : (
            <div className="space-y-4">
              {filteredMissions.map((mission) => (
                <article
                  key={mission.id}
                  className="grid gap-4 brutal-border brutal-shadow bg-card p-4 transition-transform hover:translate-x-[-1px] hover:translate-y-[-1px] sm:grid-cols-[80px_1fr_auto] sm:items-center"
                >
                  <Image
                    src={mission.icon}
                    alt={mission.brand}
                    width={80}
                    height={80}
                    className="size-16 brutal-border object-cover sm:size-20"
                  />
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-bold">{mission.title}</h2>
                    <p className="text-sm text-muted-foreground">{mission.brand}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 font-semibold text-foreground/80">
                        <BriefcaseBusiness className="size-3.5" />
                        {mission.category}
                      </span>
                      <span>{mission.posted}</span>
                      <span className="uppercase">{mission.status}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:items-end">
                    <span className="text-2xl font-black text-foreground">
                      {mission.reward}
                    </span>
                    <Link
                      href="/hunter"
                      className="inline-flex items-center justify-center brutal-border brutal-shadow bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:opacity-95"
                    >
                      View Details
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
