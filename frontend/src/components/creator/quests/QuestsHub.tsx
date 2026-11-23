"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import QuestRow from "./QuestRow";
import EmptyActiveQuests from "./EmptyActiveQuests";
import type { QuestRowData, QuestTabKey } from "./types";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton-list";
import { useWallet } from "@/context/WalletProvider";
import { creatorApiFetch } from "@/lib/creator-api";

type MissionStatus = "OPEN" | "STARTED" | "PAUSED" | "COMPLETED" | "CANCELLED";

interface MissionResponse {
  id: string;
  title: string;
  status: MissionStatus;
  metadata: unknown;
  rewardAmount: string;
  maxParticipants: number;
  updatedAt: string;
  _count?: { submissions?: number };
}

interface MissionDraftResponse {
  id: string;
  title: string;
  updatedAt: string;
}

const TABS: { key: QuestTabKey; label: string }[] = [
  { key: "active", label: "Active Missions" },
  { key: "drafted", label: "Drafted" },
  { key: "completed", label: "Completed" },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function asNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRelativeTime(value: string): string {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );

  if (elapsedSeconds < 60) return "just now";
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}m ago`;
  if (elapsedSeconds < 86400) {
    return `${Math.floor(elapsedSeconds / 3600)}h ago`;
  }
  return `${Math.floor(elapsedSeconds / 86400)}d ago`;
}

function missionTab(status: MissionStatus): QuestTabKey {
  if (status === "PAUSED") return "drafted";
  if (status === "COMPLETED" || status === "CANCELLED") return "completed";
  return "active";
}

function mapMissionToQuest(mission: MissionResponse): QuestRowData {
  const tab = missionTab(mission.status);
  const metadata = asRecord(mission.metadata);
  const perWinner = asNumber(mission.rewardAmount) ?? 0;
  const configuredPool = asNumber(metadata.pool);

  return {
    id: mission.id,
    title: mission.title,
    tagLabel:
      mission.status === "CANCELLED"
        ? "Cancelled"
        : tab === "drafted"
          ? "Draft"
          : tab === "completed"
            ? "Completed"
            : mission.status === "STARTED"
              ? "Reviewing submissions"
              : "Active",
    tagVariant:
      tab === "drafted" ? "draft" : tab === "completed" ? "completed" : "active",
    category:
      typeof metadata.category === "string" ? metadata.category : "General",
    pool: configuredPool ?? perWinner * mission.maxParticipants,
    perWinner,
    responses: mission._count?.submissions ?? 0,
    meta:
      tab === "completed"
        ? `${mission.status === "CANCELLED" ? "Cancelled" : "Completed"} ${new Date(
            mission.updatedAt,
          ).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}`
        : `${tab === "drafted" ? "Last edited" : "Updated"} ${getRelativeTime(
            mission.updatedAt,
          )}`,
    tab,
  };
}

export default function QuestsHub() {
  const { connected, publicKey, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<QuestTabKey>("active");
  const [quests, setQuests] = useState<QuestRowData[]>([]);
  const [draft, setDraft] = useState<MissionDraftResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQuests = useCallback(async () => {
    if (!publicKey) return;

    setLoading(true);
    setError(null);

    try {
      const [response, draftResponse] = await Promise.all([
        creatorApiFetch("/missions/me", publicKey),
        creatorApiFetch("/missions/drafts/me", publicKey),
      ]);
      if (!response.ok) {
        throw new Error(`Unable to load missions (${response.status})`);
      }

      const missions = (await response.json()) as MissionResponse[];
      setQuests(missions.map(mapMissionToQuest));
      if (draftResponse.ok) {
        setDraft((await draftResponse.json()) as MissionDraftResponse);
      } else if (draftResponse.status === 404) {
        setDraft(null);
      } else {
        throw new Error(`Unable to load your draft (${draftResponse.status})`);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load your missions",
      );
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadQuests(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadQuests]);

  const counts = useMemo<Record<QuestTabKey, number>>(
    () => ({
      active: quests.filter((quest) => quest.tab === "active").length,
      drafted: quests.filter((quest) => quest.tab === "drafted").length + (draft ? 1 : 0),
      completed: quests.filter((quest) => quest.tab === "completed").length,
    }),
    [draft, quests],
  );

  const visibleQuests = quests.filter((quest) => quest.tab === activeTab);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Missions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, manage and review your participation campaigns.
          </p>
        </div>
        <Link
          href="/creator/quests/new"
          className="inline-flex shrink-0 items-center justify-center  bg-brutal-violet px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-brutal-violet"
        >
          + Add new Mission
        </Link>
      </div>

      <div
        className="flex gap-6 border-b border-foreground/30 text-sm font-medium text-muted-foreground"
        role="tablist"
        aria-label="Mission status"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex items-center gap-1.5 pb-3 transition-colors hover:text-foreground ${
                isActive ? "text-foreground" : ""
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs ${
                  isActive
                    ? "bg-brutal-violet/20 text-foreground"
                    : "bg-white/5 text-muted-foreground"
                }`}
              >
                {counts[tab.key]}
              </span>
              {isActive ? (
                <span className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-brutal-violet" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="pt-6">
        {!connected || !publicKey ? (
          <EmptyState
            title="Wallet Not Connected"
            description="Connect your wallet to load and manage your missions."
            action={{
              label: "Connect wallet",
              onClick: () => void connect(),
            }}
          />
        ) : loading ? (
          <SkeletonList count={3} variant="quest" />
        ) : error ? (
          <div className="flex flex-col items-center py-12 text-center">
            <AlertCircle className="mb-3 size-6 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => void loadQuests()}
              className="mt-4 rounded-md border border-white/15 px-3 py-1.5 text-sm text-foreground hover:bg-white/5"
            >
              Try again
            </button>
          </div>
        ) : visibleQuests.length === 0 ? (
          activeTab === "active" ? (
            <EmptyActiveQuests />
          ) : (
            activeTab === "drafted" && draft ? (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{draft.title || "Untitled mission"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Saved {getRelativeTime(draft.updatedAt)}</p>
                </div>
                <Link href="/creator/quests/new?resume=latest" className="shrink-0 rounded-md border border-white/15 px-3 py-1.5 text-sm text-foreground hover:bg-white/5">
                  Resume draft
                </Link>
              </div>
            ) : (
              <EmptyState
                title={`No ${activeTab} missions`}
                description={`You don't have any ${activeTab} missions right now.`}
                variant="compact"
              />
            )
          )
        ) : (
          <div className="divide-y divide-white/5">
            {activeTab === "drafted" && draft ? (
              <div className="flex items-center justify-between gap-4 border-b border-white/5 py-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{draft.title || "Untitled mission"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Saved {getRelativeTime(draft.updatedAt)}</p>
                </div>
                <Link href="/creator/quests/new?resume=latest" className="shrink-0 rounded-md border border-white/15 px-3 py-1.5 text-sm text-foreground hover:bg-white/5">
                  Resume draft
                </Link>
              </div>
            ) : null}
            {visibleQuests.map((quest) => (
              <QuestRow key={quest.id} quest={quest} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
