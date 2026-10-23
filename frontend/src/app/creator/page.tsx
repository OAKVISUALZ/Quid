"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, AlertCircle } from "lucide-react";
import { StatsOverview } from "@/features/creators/StatsOverview";
import { CreatorQuestCard } from "@/features/creators/CreatorQuestCard";
import { ResponsePreview } from "@/features/creators/ResponsePreview";
import { DashboardSkeleton } from "@/features/creators/SkeletonLoaders";
import {
  NoQuestsEmptyState,
  NoResponsesEmptyState,
} from "@/features/creators/DashboardEmptyState";
import { EmptyState } from "@/components/ui/empty-state";
import { useWallet } from "@/context/WalletProvider";
import { creatorApiFetch } from "@/lib/creator-api";

/**
 * Issue #325: creator dashboard, wired to `GET /missions/me` instead of
 * `MockData.ts`. There is no dedicated "recent activity across all my
 * missions" endpoint, so the response preview is derived client-side: the
 * few most recently updated missions that have at least one submission are
 * each queried for their submissions (`GET /missions/:id/submissions`,
 * owner-gated), merged, and the newest few are shown. Documented as a
 * judgment call in the PR description.
 */

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

interface SubmissionPreviewResponse {
  id: string;
  createdAt: string;
  hunter?: { address: string; displayName: string | null };
}

interface DashboardQuest {
  id: string;
  title: string;
  category: string;
  budget: string;
  dueDate: string;
  submissionCount: { current: number; total: number };
}

interface DashboardResponsePreview {
  id: string;
  respondentName: string;
  questTitle: string;
  timeSinceSubmission: string;
}

interface DashboardState {
  loading: boolean;
  error: string | null;
  quests: DashboardQuest[];
  responses: DashboardResponsePreview[];
  stats: {
    activeQuests: number;
    totalResponses: number;
    totalRewards: number;
  };
}

const questIcons = ["/namelogo.png", "/namelogo.png", "/namelogo.png", "/namelogo.png"];

const MAX_RECENT_MISSIONS_FOR_RESPONSES = 3;
const MAX_RESPONSES_SHOWN = 3;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getRelativeTime(value: string): string {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (elapsedSeconds < 60) return "just now";
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}m ago`;
  if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)}h ago`;
  return `${Math.floor(elapsedSeconds / 86400)}d ago`;
}

function shortAddress(address: string): string {
  return address.length > 10 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;
}

function mapMissionToDashboardQuest(mission: MissionResponse): DashboardQuest {
  const metadata = asRecord(mission.metadata);
  return {
    id: mission.id,
    title: mission.title,
    category: typeof metadata.category === "string" ? metadata.category : "General",
    budget: `${Number(mission.rewardAmount) || 0} XLM`,
    dueDate: `Updated ${getRelativeTime(mission.updatedAt)}`,
    submissionCount: {
      current: mission._count?.submissions ?? 0,
      total: mission.maxParticipants,
    },
  };
}

export default function CreatorDashboard() {
  const { connected, publicKey, connect } = useWallet();
  const router = useRouter();
  const [state, setState] = useState<DashboardState>({
    loading: true,
    error: null,
    quests: [],
    responses: [],
    stats: { activeQuests: 0, totalResponses: 0, totalRewards: 0 },
  });

  const fetchDashboardData = useCallback(async () => {
    if (!publicKey) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await creatorApiFetch("/missions/me", publicKey);
      if (!response.ok) {
        throw new Error(`Unable to load dashboard data (${response.status})`);
      }

      const missions = (await response.json()) as MissionResponse[];

      const activeMissions = missions.filter(
        (m) => m.status === "OPEN" || m.status === "STARTED",
      );
      const totalResponses = missions.reduce(
        (sum, m) => sum + (m._count?.submissions ?? 0),
        0,
      );
      const totalRewards = missions.reduce(
        (sum, m) => sum + (Number(m.rewardAmount) || 0),
        0,
      );

      const quests = activeMissions
        .slice(0, 4)
        .map(mapMissionToDashboardQuest);

      // Best few missions to pull submission previews from: most recently
      // updated ones that actually have submissions.
      const missionsWithSubmissions = [...missions]
        .filter((m) => (m._count?.submissions ?? 0) > 0)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, MAX_RECENT_MISSIONS_FOR_RESPONSES);

      const responsePreviews = (
        await Promise.all(
          missionsWithSubmissions.map(async (mission) => {
            try {
              const subsRes = await creatorApiFetch(
                `/missions/${mission.id}/submissions`,
                publicKey,
              );
              if (!subsRes.ok) return [];
              const subs = (await subsRes.json()) as SubmissionPreviewResponse[];
              return subs.map((sub) => ({
                id: sub.id,
                respondentName:
                  sub.hunter?.displayName ||
                  (sub.hunter?.address ? shortAddress(sub.hunter.address) : "Hunter"),
                questTitle: mission.title,
                timeSinceSubmission: getRelativeTime(sub.createdAt),
                createdAt: sub.createdAt,
              }));
            } catch {
              return [];
            }
          }),
        )
      )
        .flat()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, MAX_RESPONSES_SHOWN);

      setState({
        loading: false,
        error: null,
        quests,
        responses: responsePreviews,
        stats: {
          activeQuests: activeMissions.length,
          totalResponses,
          totalRewards,
        },
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to load dashboard data. Please try again.",
      }));
    }
  }, [publicKey]);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  const handleCreateQuest = () => {
    router.push("/creator/quests/new");
  };

  if (!connected || !publicKey) {
    return (
      <div className="min-h-screen text-foreground flex flex-col">
        <main className="flex-1 px-5 py-6 sm:px-8 lg:px-12">
          <EmptyState
            title="Connect your wallet"
            description="Connect your founder wallet to load your quests and dashboard stats."
            variant="card"
            action={{ label: "Connect wallet", onClick: () => void connect() }}
          />
        </main>
      </div>
    );
  }

  if (state.loading) {
    return (
      <div className="min-h-screen text-foreground flex flex-col">
        <main className="flex-1 px-5 py-6 sm:px-8 lg:px-12">
          <DashboardSkeleton />
        </main>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-screen text-foreground flex flex-col">
        <main className="flex-1 px-5 py-6 sm:px-8 lg:px-12">
          <div className="flex flex-col items-center justify-center px-4 py-12 sm:py-20">
            <AlertCircle className="mb-4 h-12 w-12 text-red-500 sm:h-16 sm:w-16" />
            <h2 className="mb-2 text-center text-2xl font-semibold text-foreground">
              Error Loading Dashboard
            </h2>
            <p className="mb-6 text-center text-sm text-muted-foreground sm:text-base">
              {state.error}
            </p>
            <button
              type="button"
              onClick={() => void fetchDashboardData()}
              className="cursor-pointer brutal-border brutal-shadow bg-brutal-cyan px-6 py-3 text-sm font-bold uppercase sm:text-base"
            >
              Try Again
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col text-foreground">
      <main className="flex-1 px-5 py-4 sm:px-8 sm:py-6 lg:px-12">
        <StatsOverview
          activeQuests={state.stats.activeQuests}
          totalResponses={state.stats.totalResponses}
          totalRewards={state.stats.totalRewards}
          onCreateQuest={handleCreateQuest}
        />

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
          <div className="lg:col-span-2 lg:border-r lg:border-foreground/30 lg:pr-8">
            <div className="mb-6 flex items-center justify-between border-b border-foreground/30 pb-4">
              <h2 className="text-lg font-black uppercase tracking-tight text-foreground">
                Active Quests
              </h2>
              <button
                type="button"
                onClick={() => router.push("/creator/quests")}
                className="group flex cursor-pointer items-center space-x-1 text-sm font-bold uppercase text-foreground transition-colors hover:text-brutal-violet"
              >
                <span>View all</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            {state.quests.length === 0 ? (
              <NoQuestsEmptyState onCreateQuest={handleCreateQuest} />
            ) : (
              <div className="space-y-9">
                {state.quests.map((quest, index) => (
                  <CreatorQuestCard
                    key={quest.id}
                    id={quest.id}
                    title={quest.title}
                    category={quest.category}
                    budget={quest.budget}
                    dueDate={quest.dueDate}
                    submissionCount={quest.submissionCount}
                    icon={questIcons[index % questIcons.length]}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="mb-6 flex items-center justify-between border-b border-foreground/30 pb-4">
              <h2 className="text-lg font-black uppercase tracking-tight text-foreground">
                Recent Response
              </h2>
              <button
                type="button"
                onClick={() => router.push("/creator/responses")}
                className="group flex cursor-pointer items-center space-x-1 text-sm font-bold uppercase text-foreground transition-colors hover:text-brutal-violet"
              >
                <span>View all</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            {state.responses.length === 0 ? (
              <NoResponsesEmptyState />
            ) : (
              <div className="space-y-3">
                {state.responses.map((response) => (
                  <ResponsePreview
                    key={response.id}
                    id={response.id}
                    respondentName={response.respondentName}
                    questTitle={response.questTitle}
                    timeSinceSubmission={response.timeSinceSubmission}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
