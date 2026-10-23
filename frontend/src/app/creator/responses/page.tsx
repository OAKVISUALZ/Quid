"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CalendarDays,
  ExternalLink,
  FileCheck,
  FileText,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";

import { useWallet } from "@/context/WalletProvider";
import {
  ApiSessionExpiredError,
  CreatorApiForbiddenError,
  creatorApiFetch,
  approveSubmissionApi,
  rejectSubmissionApi,
  type CreatorSubmission,
} from "@/lib/creator-api";
import {
  payoutParticipantToContract,
  rejectSubmissionToContract,
} from "@/lib/soroban-client";
import { parseQuidError } from "@/lib/errorMap";
import { toast } from "@/context/ToastContext";
import IpfsPreview from "@/components/creator/IpfsPreview";
import SendTipModal from "@/components/creator/send-tip-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { PendingBadge } from "@/components/ui/PendingBadge";
import { SkeletonList } from "@/components/ui/skeleton-list";

interface CreatorMission {
  id: string;
  title: string;
  status: string;
  onChainId: string | null;
  rewardAmount: string;
  maxParticipants: number;
  updatedAt: string;
  _count?: { submissions?: number };
}

interface ReviewQueueItem extends CreatorSubmission {
  questTitle: string;
  onChainMissionId?: number;
}

type FilterStatus = "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "PAID";

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

function StatusBadge({
  status,
  reason,
}: {
  status: ReviewQueueItem["status"];
  reason?: string | null;
}) {
  switch (status) {
    case "PENDING":
      return (
        <span className="flex items-center gap-1.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 text-xs font-semibold text-yellow-300">
          <PendingBadge />
          Review pending
        </span>
      );
    case "APPROVED":
      return (
        <span className="inline-flex items-center rounded-full border border-green-500/40 bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-400">
          Approved
        </span>
      );
    case "REJECTED":
      return (
        <span
          className="inline-flex items-center rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-300"
          title={reason || undefined}
        >
          Rejected
        </span>
      );
    case "PAID":
      return (
        <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
          Paid
        </span>
      );
  }
}

function ResponsesQueueContent() {
  const searchParams = useSearchParams();
  const initialQuestId = searchParams.get("questId") || "all";

  const { connected, publicKey, authenticate, isNetworkMismatch } = useWallet();

  const [missions, setMissions] = useState<CreatorMission[]>([]);
  const [selectedQuestId, setSelectedQuestId] = useState<string>(initialQuestId);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [submissions, setSubmissions] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Review action states
  const [payingId, setPayingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectConfirmId, setRejectConfirmId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [tipTarget, setTipTarget] = useState<ReviewQueueItem | null>(null);

  /**
   * Loads missions and submissions for the review queue.
   */
  const loadReviewQueue = useCallback(async () => {
    if (!publicKey) return;

    setLoading(true);
    setError(null);
    setIsForbidden(false);
    setSessionExpired(false);

    try {
      // 1. Fetch creator's missions
      const missionsRes = await creatorApiFetch("/missions/me", publicKey);
      if (!missionsRes.ok) {
        if (missionsRes.status === 403) {
          setIsForbidden(true);
          setLoading(false);
          return;
        }
        throw new Error(`Failed to load quests (${missionsRes.status})`);
      }

      const missionsData = (await missionsRes.json()) as CreatorMission[];
      setMissions(missionsData);

      if (missionsData.length === 0) {
        setSubmissions([]);
        setLoading(false);
        return;
      }

      // 2. Fetch submissions for selected mission or all missions
      const targetMissions =
        selectedQuestId === "all"
          ? missionsData
          : missionsData.filter((m) => m.id === selectedQuestId);

      if (targetMissions.length === 0 && selectedQuestId !== "all") {
        setSubmissions([]);
        setLoading(false);
        return;
      }

      let hadForbidden = false;

      const submissionsByMission = await Promise.all(
        targetMissions.map(async (m) => {
          try {
            const subsRes = await creatorApiFetch(
              `/missions/${m.id}/submissions`,
              publicKey,
            );

            if (!subsRes.ok) {
              if (subsRes.status === 403) {
                hadForbidden = true;
              }
              return [];
            }

            const rawSubs = (await subsRes.json()) as CreatorSubmission[];
            return rawSubs.map((sub) => ({
              ...sub,
              questTitle: m.title,
              onChainMissionId: m.onChainId ? Number(m.onChainId) : undefined,
            }));
          } catch (fetchErr) {
            if (fetchErr instanceof ApiSessionExpiredError) {
              throw fetchErr;
            }
            if (fetchErr instanceof CreatorApiForbiddenError) {
              hadForbidden = true;
            }
            return [];
          }
        }),
      );

      if (hadForbidden && targetMissions.length === 1) {
        setIsForbidden(true);
      }

      const allSubmissions = submissionsByMission
        .flat()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setSubmissions(allSubmissions);
    } catch (err) {
      if (err instanceof ApiSessionExpiredError) {
        setSessionExpired(true);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load review queue");
      }
    } finally {
      setLoading(false);
    }
  }, [publicKey, selectedQuestId]);

  useEffect(() => {
    const timer = setTimeout(() => void loadReviewQueue(), 0);
    return () => clearTimeout(timer);
  }, [loadReviewQueue]);

  const handleConnectSession = async () => {
    try {
      await authenticate();
      await loadReviewQueue();
    } catch (authErr) {
      setError(authErr instanceof Error ? authErr.message : "Authentication failed");
    }
  };

  /**
   * Approves a submission: invokes on-chain payout when on-chain ID exists,
   * then updates the backend status.
   */
  const handleApprove = async (item: ReviewQueueItem) => {
    if (!publicKey) return;

    if (!item.hunterAddress) {
      toast.error("Approval Blocked", {
        description: "This submission is missing a hunter wallet address.",
      });
      return;
    }

    setPayingId(item.id);

    try {
      // If mission is published on-chain, release payout via contract
      if (item.onChainMissionId != null) {
        if (isNetworkMismatch) {
          toast.error("Network Mismatch", {
            description: "Switch your wallet to the testnet network to release payment.",
          });
          setPayingId(null);
          return;
        }

        await payoutParticipantToContract({
          missionId: item.onChainMissionId,
          hunterAddress: item.hunterAddress,
          ownerAddress: publicKey,
        });
      }

      // Update backend submission status
      await approveSubmissionApi(item.missionId, item.id, publicKey).catch(() => {
        // Backend update is best-effort if contract succeeded
      });

      // Optimistically update local queue
      setSubmissions((prev) =>
        prev.map((sub) =>
          sub.id === item.id ? { ...sub, status: "APPROVED" } : sub,
        ),
      );

      toast.success("Submission Approved!", {
        description: `Approved response from ${item.hunter?.displayName || shortAddress(item.hunterAddress)}.`,
      });
    } catch (err: unknown) {
      const parsed = parseQuidError(err instanceof Error ? err.message : err);
      toast.error(parsed.title || "Approval Failed", {
        description: parsed.description,
      });
    } finally {
      setPayingId(null);
    }
  };

  /**
   * Rejects a submission: invokes reject_submission on-chain (refunding stake)
   * and updates backend status with optional reason.
   */
  const handleReject = async (item: ReviewQueueItem) => {
    if (!publicKey) return;

    setRejectingId(item.id);

    try {
      if (item.onChainMissionId != null) {
        await rejectSubmissionToContract({
          missionId: item.onChainMissionId,
          hunterAddress: item.hunterAddress,
          ownerAddress: publicKey,
          reason: rejectReason || undefined,
        });
      }

      await rejectSubmissionApi(
        item.missionId,
        item.id,
        publicKey,
        rejectReason || undefined,
      ).catch(() => {});

      setSubmissions((prev) =>
        prev.map((sub) =>
          sub.id === item.id
            ? { ...sub, status: "REJECTED", rejectionReason: rejectReason || null }
            : sub,
        ),
      );

      toast.error("Submission Rejected", {
        description: `Rejected response. Hunter stake refunded on-chain.`,
      });
    } catch (err: unknown) {
      const parsed = parseQuidError(err instanceof Error ? err.message : err);
      toast.error(parsed.title || "Reject Failed", {
        description: parsed.description,
      });
    } finally {
      setRejectingId(null);
      setRejectConfirmId(null);
      setRejectReason("");
    }
  };

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      // Status filter
      if (statusFilter !== "ALL" && sub.status !== statusFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesUser =
          sub.hunter?.displayName?.toLowerCase().includes(query) ||
          sub.hunterAddress.toLowerCase().includes(query);
        const matchesContent = sub.textPayload?.toLowerCase().includes(query);
        const matchesQuest = sub.questTitle.toLowerCase().includes(query);
        const matchesCid = sub.ipfsCid.toLowerCase().includes(query);
        if (!matchesUser && !matchesContent && !matchesQuest && !matchesCid) {
          return false;
        }
      }

      return true;
    });
  }, [submissions, statusFilter, searchQuery]);

  // Queue counts
  const stats = useMemo(() => {
    const total = submissions.length;
    const pending = submissions.filter((s) => s.status === "PENDING").length;
    const approved = submissions.filter((s) => s.status === "APPROVED").length;
    const rejected = submissions.filter((s) => s.status === "REJECTED").length;
    const paid = submissions.filter((s) => s.status === "PAID").length;
    return { total, pending, approved, rejected, paid };
  }, [submissions]);

  if (!connected || !publicKey) {
    return (
      <div className="px-5 py-6 sm:px-8 lg:px-12">
        <EmptyState
          title="Connect your wallet"
          description="Connect your founder wallet to load and review responses from participants."
          variant="card"
          action={{ label: "Connect wallet", onClick: () => void authenticate() }}
        />
      </div>
    );
  }

  if (sessionExpired) {
    return (
      <div className="px-5 py-6 sm:px-8 lg:px-12">
        <EmptyState
          title="API Session Expired"
          description="Your wallet API session expired. Sign in again with Freighter to review your queue."
          variant="card"
          action={{ label: "Sign in with Freighter", onClick: handleConnectSession }}
        />
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div className="px-5 py-6 sm:px-8 lg:px-12">
        <EmptyState
          title="Access Restricted"
          description="You are not authorized to view submissions for this mission. The review queue is restricted to quest founders."
          icon={<ShieldAlert className="size-8 text-red-400" />}
          variant="card"
        />
      </div>
    );
  }

  return (
    <div className="px-5 py-4 sm:px-8 sm:py-6 lg:px-12 text-foreground">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-foreground/30 pb-5">
        <div>
          <p className="text-xs uppercase font-mono tracking-[0.2em] text-brutal-cyan">
            Founder Review Queue
          </p>
          <h1 className="mt-1 text-2xl font-black uppercase tracking-tight sm:text-3xl">
            Creator Responses
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Inspect IPFS feedback and proofs, review participant submissions, and approve payouts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadReviewQueue()}
          disabled={loading}
          className="inline-flex items-center gap-2 brutal-border brutal-shadow bg-card px-4 py-2 text-xs font-bold uppercase transition-transform hover:translate-x-[-1px] hover:translate-y-[-1px] disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats ribbon */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="brutal-border brutal-shadow bg-card p-3">
          <p className="text-[11px] font-bold uppercase text-muted-foreground">Total In Queue</p>
          <p className="mt-1 text-2xl font-black">{stats.total}</p>
        </div>
        <div className="brutal-border brutal-shadow bg-brutal-yellow/20 p-3">
          <p className="text-[11px] font-bold uppercase text-yellow-300">Needs Review</p>
          <p className="mt-1 text-2xl font-black text-yellow-300">{stats.pending}</p>
        </div>
        <div className="brutal-border brutal-shadow bg-green-500/20 p-3">
          <p className="text-[11px] font-bold uppercase text-green-400">Approved</p>
          <p className="mt-1 text-2xl font-black text-green-400">{stats.approved}</p>
        </div>
        <div className="brutal-border brutal-shadow bg-emerald-500/20 p-3">
          <p className="text-[11px] font-bold uppercase text-emerald-300">Paid Out</p>
          <p className="mt-1 text-2xl font-black text-emerald-300">{stats.paid}</p>
        </div>
      </div>

      {/* Controls & Filters */}
      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Quest selector & search */}
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-[220px]">
            <select
              aria-label="Filter by Quest"
              value={selectedQuestId}
              onChange={(e) => setSelectedQuestId(e.target.value)}
              className="w-full appearance-none brutal-border brutal-shadow bg-card px-3 py-2 text-xs font-bold text-foreground focus:outline-none"
            >
              <option value="all">All Quests ({missions.length})</option>
              {missions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} {m._count?.submissions != null ? `(${m._count.submissions})` : ""}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-2.5 text-xs text-muted-foreground">
              ▼
            </div>
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter by hunter, text, CID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full brutal-border bg-card pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-foreground/20 pt-3 lg:border-t-0 lg:pt-0">
          {(
            [
              { key: "ALL", label: "All" },
              { key: "PENDING", label: "Pending" },
              { key: "APPROVED", label: "Approved" },
              { key: "PAID", label: "Paid" },
              { key: "REJECTED", label: "Rejected" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`brutal-border px-3 py-1.5 text-xs font-bold uppercase transition-colors ${
                statusFilter === tab.key
                  ? "bg-brutal-pink text-foreground brutal-shadow"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.key === "PENDING" && stats.pending > 0 && (
                <span className="ml-1.5 rounded bg-yellow-400 px-1.5 py-0.2 text-[10px] font-black text-black">
                  {stats.pending}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Review Queue List */}
      <div className="mt-8">
        {loading ? (
          <SkeletonList count={3} variant="submission" />
        ) : error ? (
          <div className="brutal-border brutal-shadow bg-card p-6 text-center space-y-4">
            <AlertCircle className="mx-auto size-10 text-red-500" />
            <h2 className="text-lg font-bold text-foreground">Error Loading Queue</h2>
            <p className="text-xs text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={() => void loadReviewQueue()}
              className="brutal-border brutal-shadow bg-brutal-cyan px-4 py-2 text-xs font-bold uppercase"
            >
              Try Again
            </button>
          </div>
        ) : missions.length === 0 ? (
          <EmptyState
            title="No Quests Created"
            description="You have not created any quests yet. Create a quest to start receiving responses in your review queue."
            variant="card"
            action={{
              label: "Create Quest",
              href: "/creator/quests/new",
            }}
          />
        ) : filteredSubmissions.length === 0 ? (
          <EmptyState
            title="No Submissions In Queue"
            description={
              statusFilter !== "ALL" || searchQuery
                ? "No submissions matched your selected filters."
                : "Responses will appear here once participants submit feedback to your quests."
            }
            icon={<FileText className="size-8 text-brutal-cyan" />}
            variant="card"
          />
        ) : (
          <div className="space-y-6">
            {filteredSubmissions.map((sub) => {
              const isApproved = sub.status === "APPROVED" || sub.status === "PAID";
              const isPaying = payingId === sub.id;
              const isRejecting = rejectingId === sub.id;

              return (
                <div
                  key={sub.id}
                  className="brutal-border brutal-shadow bg-card p-4 transition-all hover:border-foreground sm:p-6"
                >
                  {/* Quest header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-foreground/20 pb-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/creator/quests/${sub.missionId}`}
                        className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-foreground hover:text-brutal-violet underline underline-offset-2"
                      >
                        <FileCheck className="size-3.5 text-brutal-cyan" />
                        <span>{sub.questTitle}</span>
                        <ExternalLink className="size-3" />
                      </Link>
                    </div>

                    <StatusBadge status={sub.status} reason={sub.rejectionReason} />
                  </div>

                  {/* Hunter info & submission details */}
                  <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <Image
                        src="/quest-detail/avatar-quid.png"
                        alt={sub.hunter?.displayName || "Hunter"}
                        width={44}
                        height={44}
                        className="size-10 rounded-full sm:size-11 flex-shrink-0"
                      />
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-foreground truncate">
                            {sub.hunter?.displayName || shortAddress(sub.hunterAddress)}
                          </p>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {shortAddress(sub.hunterAddress)}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="size-3" />
                            {new Date(sub.createdAt).toLocaleDateString()} (
                            {getRelativeTime(sub.createdAt)})
                          </span>
                          {sub.sentiment != null && (
                            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                              Rating: {Math.round(sub.sentiment * 5)}/5
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Review Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      {sub.status === "PENDING" && (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleApprove(sub)}
                            disabled={isPaying || isRejecting}
                            className="brutal-border brutal-shadow bg-brutal-pink px-4 py-1.5 text-xs font-bold uppercase transition-transform hover:translate-x-[-1px] hover:translate-y-[-1px] disabled:opacity-50"
                            title="Approve submission and release payout"
                          >
                            {isPaying ? "Paying…" : "✓ Approve"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setRejectConfirmId(sub.id);
                              setRejectReason("");
                            }}
                            disabled={isPaying || isRejecting}
                            className="border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-xs font-bold uppercase text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                            title="Reject submission"
                          >
                            ✕ Reject
                          </button>
                        </>
                      )}

                      {isApproved && (
                        <button
                          type="button"
                          onClick={() => setTipTarget(sub)}
                          className="brutal-border brutal-shadow bg-brutal-yellow px-3 py-1.5 text-xs font-bold uppercase text-black hover:translate-x-[-1px] hover:translate-y-[-1px]"
                          title="Send extra reward to this hunter"
                        >
                          🎁 Tip Hunter
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Reject Confirm Box */}
                  {rejectConfirmId === sub.id && (
                    <div className="mt-4 brutal-border bg-[#1A1330] p-4 text-xs space-y-3">
                      <p className="font-bold text-red-300">
                        Confirm rejection for this submission:
                      </p>
                      <input
                        type="text"
                        placeholder="Rejection reason (optional)..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="w-full brutal-border bg-black/40 px-3 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleReject(sub)}
                          disabled={isRejecting}
                          className="brutal-border bg-red-500 px-3 py-1 font-bold uppercase text-white hover:bg-red-600 disabled:opacity-50"
                        >
                          {isRejecting ? "Rejecting…" : "Confirm Reject"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectConfirmId(null)}
                          className="border border-foreground/30 px-3 py-1 font-bold uppercase hover:bg-white/10"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Feedback text */}
                  {sub.textPayload && (
                    <div className="mt-4 rounded bg-background/60 p-3 border border-foreground/10 text-xs">
                      <span className="block font-bold text-[10px] uppercase text-muted-foreground mb-1">
                        Feedback Response
                      </span>
                      <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                        {sub.textPayload}
                      </p>
                    </div>
                  )}

                  {/* Issue #328: Show IPFS preview for submission */}
                  {sub.ipfsCid && (
                    <div className="mt-4">
                      <IpfsPreview cid={sub.ipfsCid} textPayload={sub.textPayload} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tip Modal */}
      {tipTarget && (
        <SendTipModal
          isOpen={Boolean(tipTarget)}
          onClose={() => setTipTarget(null)}
          missionId={tipTarget.onChainMissionId || tipTarget.missionId}
          hunterAddress={tipTarget.hunterAddress}
          hunterName={tipTarget.hunter?.displayName || shortAddress(tipTarget.hunterAddress)}
        />
      )}
    </div>
  );
}

export default function CreatorResponsesPage() {
  return (
    <Suspense
      fallback={
        <div className="px-5 py-6 sm:px-8 lg:px-12">
          <SkeletonList count={3} variant="submission" />
        </div>
      }
    >
      <ResponsesQueueContent />
    </Suspense>
  );
}
