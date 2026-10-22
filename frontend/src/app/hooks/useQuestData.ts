'use client';
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/context/WalletProvider";
import { creatorApiFetch, ApiSessionExpiredError } from "@/lib/creator-api";
import { getApiBaseUrl } from "@/lib/api-base";

/**
 * Issue #325: real data for a single creator quest (mission), replacing the
 * hardcoded placeholder this hook used to return.
 *
 * `GET /missions/:id` is public (no owner check), so the quest itself loads
 * regardless of wallet state. `GET /missions/:id/submissions` is owner-gated
 * on the backend (JwtAuthGuard + an ownerAddress check in MissionsService),
 * so submissions only load once a wallet is connected, and silently come
 * back empty for a non-owner rather than surfacing a 403 as a page error.
 */

export type SubmissionStatus = "pending" | "approved" | "rejected";
export type QuestStatus = "active" | "completed" | "cancelled" | "draft";

export type Quest = {
  id: string;
  title: string;
  description: string;
  reward: number;
  slots: number;
  deadline?: Date;
  status: QuestStatus;
  /**
   * On-chain mission id on `quid-store` (u64) used for `payout_participant`.
   * Kept separate from the off-chain `id`, which is a UUID. Undefined until
   * the mission has been published on-chain (`Mission.onChainId`).
   */
  missionId?: number;
  /** Stellar address of the founder — the only account allowed to pay out. */
  ownerAddress?: string;
};

export type Submission = {
  id: string;
  user: string;
  content: string;
  status: SubmissionStatus;
  date: Date;
  /** Stellar address of the hunter, required to pay this submission. */
  hunterAddress?: string;
};

type MissionApiStatus = "OPEN" | "STARTED" | "PAUSED" | "COMPLETED" | "CANCELLED";

interface MissionDetailResponse {
  id: string;
  title: string;
  aiSummary: string;
  rewardAmount: string;
  maxParticipants: number;
  status: MissionApiStatus;
  onChainId: string | null;
  ownerAddress: string;
  metadata: unknown;
}

interface SubmissionApiResponse {
  id: string;
  hunterAddress: string;
  textPayload: string | null;
  ipfsCid: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  hunter?: { address: string; displayName: string | null };
}

function missionStatusToQuestStatus(status: MissionApiStatus): QuestStatus {
  switch (status) {
    case "PAUSED":
      return "draft";
    case "COMPLETED":
      return "completed";
    case "CANCELLED":
      return "cancelled";
    default:
      return "active";
  }
}

function shortAddress(address: string): string {
  return address.length > 10 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;
}

function mapSubmission(sub: SubmissionApiResponse): Submission {
  return {
    id: sub.id,
    user: sub.hunter?.displayName || (sub.hunter?.address ?? shortAddress(sub.hunterAddress)),
    content: sub.textPayload || `IPFS: ${sub.ipfsCid}`,
    status: sub.status.toLowerCase() as SubmissionStatus,
    date: new Date(sub.createdAt),
    hunterAddress: sub.hunterAddress,
  };
}

export function useQuestData(questId: string) {
  const { publicKey } = useWallet();
  const [quest, setQuest] = useState<Quest | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestData = useCallback(async () => {
    if (!questId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/missions/${questId}`);
      if (!response.ok) {
        throw new Error(`Unable to load quest (${response.status})`);
      }

      const mission = (await response.json()) as MissionDetailResponse;
      const metadata =
        mission.metadata && typeof mission.metadata === "object"
          ? (mission.metadata as Record<string, unknown>)
          : {};
      const deadlineRaw = typeof metadata.deadline === "string" ? metadata.deadline : undefined;

      setQuest({
        id: mission.id,
        title: mission.title,
        description: mission.aiSummary,
        reward: Number(mission.rewardAmount) || 0,
        slots: mission.maxParticipants,
        deadline: deadlineRaw ? new Date(deadlineRaw) : undefined,
        status: missionStatusToQuestStatus(mission.status),
        missionId: mission.onChainId ? Number(mission.onChainId) : undefined,
        ownerAddress: mission.ownerAddress,
      });

      if (!publicKey) {
        setSubmissions([]);
      } else {
        try {
          const subsResponse = await creatorApiFetch(
            `/missions/${questId}/submissions`,
            publicKey,
          );
          if (subsResponse.ok) {
            const subs = (await subsResponse.json()) as SubmissionApiResponse[];
            setSubmissions(subs.map(mapSubmission));
          } else {
            // Not the owner (403) or nothing to show - not a page-level error.
            setSubmissions([]);
          }
        } catch (subsErr) {
          if (!(subsErr instanceof ApiSessionExpiredError)) {
            console.warn("[Quid] Failed to load quest submissions:", subsErr);
          }
          setSubmissions([]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load this quest");
      setQuest(null);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, [questId, publicKey]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchQuestData(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchQuestData]);

  return { quest, submissions, loading, error, refetch: fetchQuestData };
}
