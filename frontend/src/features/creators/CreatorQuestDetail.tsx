import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CheckCircle, AlertCircle, ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton-list";
import QuestHeader from "./QuestHeader";
import SubmissionCard from "./SubmissionCard";
import TaskInfo from "./TaskInfo";
import NetworkMismatchBanner from "@/components/wallet/NetworkMismatchBanner";
import { Submission, Quest, QuestStatus } from "@/app/hooks/useQuestData";
import { useWallet } from "@/context/WalletProvider";
import {
  payoutParticipantToContract,
  pauseMissionToContract,
  cancelMissionToContract,
  rejectSubmissionToContract,
} from "@/lib/soroban-client";
import { approveSubmissionApi, rejectSubmissionApi } from "@/lib/creator-api";
import { getMissionTipTotal } from "@/lib/tip-jar-client";
import { parseQuidError } from "@/lib/errorMap";
import { toast } from "@/context/ToastContext";
import SendTipModal from "@/components/creator/send-tip-modal";

type Notification = { type: "success" | "error"; message: string };

/** Issue #322: a mission whose status blocks any further pause/cancel/payout. */
const CLOSED_STATUSES: QuestStatus[] = ["cancelled", "completed"];

export default function CreatorQuestDetail({
  quest,
  submissions,
  questId,
  isActive = true,
  loading = false,
  error,
  isForbidden = false,
  submissionsError,
  onRetry,
}: {
  quest?: Quest | null;
  submissions: Submission[];
  questId?: string;
  isActive?: boolean;
  loading?: boolean;
  /** Issue #325: set when the quest itself failed to load from the API. */
  error?: string | null;
  isForbidden?: boolean;
  submissionsError?: string | null;
  onRetry?: () => void;
}) {
  const router = useRouter();
  const { publicKey, connected, isNetworkMismatch } = useWallet();
  const [approvedSubmissions, setApprovedSubmissions] = useState<string[]>([]);
  const [rejectedSubmissions, setRejectedSubmissions] = useState<string[]>([]);
  const [rejectConfirm, setRejectConfirm] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notification | null>(null);
  // Issue #341: send-tip modal target + the mission's running tip total.
  const [tipTarget, setTipTarget] = useState<Submission | null>(null);
  const [tipTotal, setTipTotal] = useState<bigint | null>(null);
  const [tipTotalError, setTipTotalError] = useState<string | null>(null);

  // Issue #322: optimistic status override once pause/cancel lands on-chain.
  // `quest` itself comes from `useQuestData`, which has no mutation API yet,
  // so the detail view tracks the post-tx status locally.
  const [statusOverride, setStatusOverride] = useState<QuestStatus | null>(null);
  const [pauseConfirmOpen, setPauseConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [missionActionPending, setMissionActionPending] = useState<
    "pause" | "cancel" | null
  >(null);

  const effectiveStatus: QuestStatus | undefined = statusOverride ?? quest?.status;

  /**
   * `payout_participant` / `pause_mission` / `cancel_mission` /
   * `reject_submission` all call `mission.owner.require_auth()` on-chain, so
   * the UI blocks earlier rather than letting the founder burn a signing
   * prompt on a call that can only revert.
   */
  const isOwner = Boolean(
    connected && publicKey && quest?.ownerAddress === publicKey,
  );

  const canPay = isOwner && !isNetworkMismatch && quest?.missionId != null;
  const canManageMission = canPay; // same gate; kept distinct for readability at call sites
  const isMissionClosed = Boolean(
    effectiveStatus && CLOSED_STATUSES.includes(effectiveStatus),
  );
  const isMissionPaused = effectiveStatus === "paused";

  /** Issue #322: unfilled slots x reward-per-slot, mirroring the contract's
   * `cancel_mission` / `expire_mission` refund formula. `approvedSubmissions`
   * is the UI's best local signal for "slots already paid out" until the
   * quest hook exposes a real `participantsCount`. */
  const perWinnerReward =
    quest?.slots && quest.slots > 0 ? quest.reward / quest.slots : 0;
  const remainingSlots = Math.max(
    (quest?.slots ?? 0) - approvedSubmissions.length,
    0,
  );
  const estimatedRefund = Math.round(perWinnerReward * remainingSlots);

  // Issue #341: best-effort read of the on-chain running tip total for this
  // mission. There is no per-tip history endpoint yet (see PR description),
  // so this total is the closest available stand-in for "tip history".
  useEffect(() => {
    if (!publicKey || quest?.missionId == null) {
      const timeoutId = window.setTimeout(() => setTipTotal(null), 0);
      return () => window.clearTimeout(timeoutId);
    }

    let cancelled = false;
    const missionId = quest.missionId;
    const address = publicKey;
    const timeoutId = window.setTimeout(() => {
      getMissionTipTotal(missionId, address)
        .then((total) => {
          if (!cancelled) {
            setTipTotal(total);
            setTipTotalError(null);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setTipTotal(null);
            setTipTotalError(
              err instanceof Error ? err.message : "Unable to read tip total",
            );
          }
        });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      cancelled = true;
    };
  }, [publicKey, quest?.missionId]);

  const handleApprove = async (submission: Submission) => {
    if (!canPay || quest?.missionId == null) return;
    if (!submission.hunterAddress) {
      setNotification({
        type: "error",
        message: "This submission has no wallet address, so it cannot be paid.",
      });
      return;
    }

    setPayingId(submission.id);
    setNotification(null);

    try {
      const receipt = await payoutParticipantToContract({
        missionId: quest.missionId,
        hunterAddress: submission.hunterAddress,
        ownerAddress: publicKey as string,
      });

      setApprovedSubmissions((prev) =>
        prev.includes(submission.id)
          ? prev
          : [...prev, submission.id],
      );
      setRejectedSubmissions((prev) =>
        prev.filter((id) => id !== submission.id),
      );
      setNotification({
        type: "success",
        message: `Paid ${submission.user}. Tx ${receipt.txHash.slice(0, 8)}…`,
      });

      // Issue #328: sync approved status with backend review API
      if (quest?.id && publicKey) {
        try {
          await approveSubmissionApi(quest.id, submission.id, publicKey);
        } catch (apiErr) {
          console.warn("[Quid] Backend approval sync failed:", apiErr);
        }
      }
    } catch (error: unknown) {
      // Map the numeric contract code (AlreadyPaid, MissionClosed,
      // NotAuthorized, ...) onto a message the founder can act on.
      const info = parseQuidError(
        error instanceof Error ? error.message : error,
      );
      setNotification({
        type: "error",
        message: `${info.title} — ${info.description}`,
      });
    } finally {
      setPayingId(null);
    }
  };

  /**
   * Issue #321: invokes `reject_submission` on quid-store, which refunds the
   * hunter's stake and marks the submission `Rejected` on-chain. The optional
   * `rejectReason` has no on-chain field (the contract doesn't take one), so
   * it is only ever surfaced in the toast / notification here.
   */
  const handleReject = async (submission: Submission) => {
    if (!canManageMission || quest?.missionId == null) return;
    if (!submission.hunterAddress) {
      setNotification({
        type: "error",
        message: "This submission has no wallet address, so it cannot be rejected on-chain.",
      });
      return;
    }

    setRejectingId(submission.id);
    setNotification(null);

    try {
      await rejectSubmissionToContract({
        missionId: quest.missionId,
        hunterAddress: submission.hunterAddress,
        ownerAddress: publicKey as string,
        reason: rejectReason || undefined,
      });

      setRejectedSubmissions((prev) =>
        prev.includes(submission.id) ? prev : [...prev, submission.id],
      );
      setApprovedSubmissions((prev) => prev.filter((id) => id !== submission.id));

      toast.error("Submission rejected", {
        description: rejectReason
          ? `Reason: ${rejectReason}`
          : `Submission from ${submission.user} was rejected and their stake was refunded.`,
      });
      setNotification({
        type: "success",
        message: `Rejected ${submission.user}'s submission. Their stake was refunded on-chain.`,
      });

      // Issue #328: sync rejection status with backend review API
      if (quest?.id && publicKey) {
        try {
          await rejectSubmissionApi(
            quest.id,
            submission.id,
            publicKey,
            rejectReason.trim() || undefined,
          );
        } catch (apiErr) {
          console.warn("[Quid] Backend rejection sync failed:", apiErr);
        }
      }
    } catch (error: unknown) {
      const info = parseQuidError(error instanceof Error ? error.message : error);
      setNotification({
        type: "error",
        message: `${info.title} — ${info.description}`,
      });
      toast.error("Reject failed", { description: info.description });
    } finally {
      setRejectingId(null);
      setRejectConfirm(null);
      setRejectReason("");
    }
  };

  /** Issue #322: pause blocks new submissions; escrow stays put. */
  const handlePauseMission = async () => {
    if (!canManageMission || quest?.missionId == null) return;

    setMissionActionPending("pause");
    setNotification(null);

    try {
      await pauseMissionToContract({
        missionId: quest.missionId,
        ownerAddress: publicKey as string,
      });

      setStatusOverride("paused");
      setNotification({
        type: "success",
        message: "Quest paused. New submissions are now blocked; existing escrow is untouched.",
      });
      toast.success("Quest paused", {
        description: "Hunters can no longer submit new feedback to this quest.",
      });
    } catch (error: unknown) {
      const info = parseQuidError(error instanceof Error ? error.message : error);
      setNotification({
        type: "error",
        message: `${info.title} — ${info.description}`,
      });
      toast.error("Pause failed", { description: info.description });
    } finally {
      setMissionActionPending(null);
      setPauseConfirmOpen(false);
    }
  };

  /** Issue #322: cancel refunds the unspent reward pool back to the founder. */
  const handleCancelMission = async () => {
    if (!canManageMission || quest?.missionId == null) return;

    setMissionActionPending("cancel");
    setNotification(null);

    try {
      const receipt = await cancelMissionToContract({
        missionId: quest.missionId,
        ownerAddress: publicKey as string,
      });

      setStatusOverride("cancelled");
      setNotification({
        type: "success",
        message: `Quest cancelled. ~${estimatedRefund} XLM refunded to your wallet. Tx ${receipt.txHash.slice(0, 8)}…`,
      });
      toast.success("Quest cancelled", {
        description: `Unspent escrow (~${estimatedRefund} XLM) was refunded to your wallet.`,
      });
    } catch (error: unknown) {
      const info = parseQuidError(error instanceof Error ? error.message : error);
      setNotification({
        type: "error",
        message: `${info.title} — ${info.description}`,
      });
      toast.error("Cancel failed", { description: info.description });
    } finally {
      setMissionActionPending(null);
      setCancelConfirmOpen(false);
    }
  };

  const getEffectiveStatus = (sub: Submission): Submission["status"] => {
    if (rejectedSubmissions.includes(sub.id)) return "rejected";
    if (approvedSubmissions.includes(sub.id)) return "approved";
    return sub.status;
  };

  const handleEditQuest = () => {
    if (questId) {
      router.push(`/creator/quests/${questId}/edit`);
    }
  };
  const [activeTab, setActiveTab] = useState<"details" | "response">("details");

  if (error && !loading && !quest) {
    return (
      <div className="text-foreground px-3 py-1">
        <QuestHeader />
        <EmptyState
          title="Could not load this quest"
          description={error}
          variant="card"
          action={onRetry ? { label: "Try again", onClick: onRetry } : undefined}
        />
      </div>
    );
  }

  return (
    <div className="text-foreground px-3 py-1">
      <QuestHeader />
      <NetworkMismatchBanner />
      {connected && !isOwner && (
        <p className="mt-2 text-sm text-muted-foreground">
          Connect the founder wallet to release payouts for this quest.
        </p>
      )}
      {notification && (
        <div
          role="status"
          className={`mt-3 flex items-center gap-2 px-4 py-3 text-sm ${
            notification.type === "success"
              ? "bg-green-500/10 border border-green-500/30 text-green-300"
              : "bg-red-500/10 border border-red-500/30 text-red-300"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle className="h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" />
          )}
          <p>{notification.message}</p>
        </div>
      )}
      <div className="font-inter flex flex-col gap-4 justify-between items-start w-full md:flex-row md:items-center">
        <div className="flex flex-col justify-normal items-start gap-2 text-foreground py-6">
          <h2 className="text-2xl md:text-4xl font-bold">{quest?.title || "Quest"}</h2>
          <div className="flex gap-4 items-center text-sm md:text-base">
            <span
              className={`px-3 py-1 rounded-full capitalize ${
                effectiveStatus === "active"
                  ? "bg-green-500/20 text-green-400"
                  : effectiveStatus === "paused"
                    ? "bg-yellow-500/20 text-yellow-400"
                    : effectiveStatus === "cancelled"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-gray-500/20 text-gray-400"
              }`}
            >
              {effectiveStatus || "unknown"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 pb-2 md:pb-0">
          {isActive && (
            <button
              onClick={handleEditQuest}
              className="text-sm text-[#9110FF] cursor-pointer hover:text-[#b844ff] transition-colors duration-200"
            >
              Edit Quest
            </button>
          )}
          {/* Issue #322: pause/cancel, both owner-gated and destructive, so
              both require an explicit confirm step before signing. */}
          {canManageMission && !isMissionClosed && (
            <>
              <button
                type="button"
                onClick={() => setPauseConfirmOpen((prev) => !prev)}
                disabled={isMissionPaused || missionActionPending !== null}
                className="brutal-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-yellow-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                title={isMissionPaused ? "Quest is already paused" : "Pause new submissions"}
              >
                {isMissionPaused ? "Paused" : "Pause Quest"}
              </button>
              <button
                type="button"
                onClick={() => setCancelConfirmOpen((prev) => !prev)}
                disabled={missionActionPending !== null}
                className="border border-red-500/50 bg-background px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                title="Cancel quest and reclaim unspent escrow"
              >
                Cancel Quest
              </button>
            </>
          )}
        </div>
      </div>

      {pauseConfirmOpen && (
        <div className="brutal-border mb-4 bg-[#1A1330] p-4">
          <p className="mb-3 text-sm text-foreground">
            Pause this quest? Hunters will no longer be able to submit new
            feedback. Existing escrow stays locked and submissions already
            received can still be approved or rejected.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => void handlePauseMission()}
              disabled={missionActionPending !== null}
              className="bg-yellow-500 px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {missionActionPending === "pause" ? "Pausing…" : "Confirm Pause"}
            </button>
            <button
              onClick={() => setPauseConfirmOpen(false)}
              disabled={missionActionPending !== null}
              className="border border-foreground bg-background px-4 py-2 text-sm text-foreground transition-colors hover:brutal-border"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {cancelConfirmOpen && (
        <div className="brutal-border mb-4 bg-[#1A1330] p-4">
          <p className="mb-1 text-sm text-foreground">
            Cancel this quest? This closes it permanently — no further
            submissions, approvals, or payouts will be possible.
          </p>
          <p className="mb-3 text-sm font-semibold text-foreground">
            Estimated refund to your wallet: ~{estimatedRefund} XLM
            <span className="font-normal text-muted-foreground">
              {" "}
              ({remainingSlots} unfilled slot{remainingSlots === 1 ? "" : "s"} × ~
              {Math.round(perWinnerReward)} XLM)
            </span>
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => void handleCancelMission()}
              disabled={missionActionPending !== null}
              className="bg-red-500 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {missionActionPending === "cancel" ? "Cancelling…" : "Confirm Cancel"}
            </button>
            <button
              onClick={() => setCancelConfirmOpen(false)}
              disabled={missionActionPending !== null}
              className="border border-foreground bg-background px-4 py-2 text-sm text-foreground transition-colors hover:brutal-border"
            >
              Keep Quest
            </button>
          </div>
        </div>
      )}

      {/* Issue #322: paused missions keep existing submissions reviewable but
          block new ones — call that out so the founder isn't surprised when
          the response count stops moving. */}
      {isMissionPaused && (
        <div className="mb-6 bg-yellow-500/10 border border-yellow-500/30 px-4 py-3 text-sm text-yellow-300">
          This quest is paused. Hunters cannot submit new feedback until you
          resume it; existing submissions can still be approved or rejected.
        </div>
      )}
      {effectiveStatus === "cancelled" && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
          This quest is cancelled. No further submissions, approvals, or
          payouts can happen.
        </div>
      )}

      {/* Quest Description */}
      {quest?.description && (
        <div className="brutal-border brutal-shadow bg-card  p-4 md:p-6 mb-6">
          <h3 className="text-foreground font-semibold mb-2">Description</h3>
          <p className="text-foreground text-sm md:text-base">{quest.description}</p>
        </div>
      )}
      <div className="flex justify-normal items-start">
        <div className="w-[30%] hidden md:block">
          <p className="text-[#8C86B8] p-2">About survery</p>
          <div className=" border-t border-r border-b border-foreground">
            <div className="text-foreground flex flex-col gap-2 p-3 border-b border-b-[#241B4A] py-6">
              <p>Product link</p>
              <p className="brutal-border bg-background p-2 ">
                https://productlink.com
              </p>
            </div>
          </div>
          <div className=" border-r border-b border-foreground flex flex-col gap-2 items-start text-foreground p-2 py-6">
            <div className="flex items-center gap-2">
              <Image
                src="/quest-detail/stellar-icon.png"
                alt="Stellar"
                width={24}
                height={24}
                className="size-6"
              />
              <h2 className="text-2xl font-semibold">{quest?.reward || 640} XLM</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-3 brutal-border brutal-shadow bg-brutal-pink rounded-full" />
              <p className="text-foreground">{quest?.slots ? Math.floor(quest.reward / quest.slots) : 10} XLM per Winner</p>
            </div>
          </div>
          <div className=" border-r border-b border-foreground flex flex-col gap-2 items-start text-foreground p-2 py-6">
            <h2 className="text-2xl font-semibold">{quest?.slots || 24}</h2>
            <p className="text-foreground">Available Slots</p>
          </div>
          <div className=" border-r border-b border-foreground flex flex-col gap-2 items-start text-foreground p-2 py-6">
            <h2 className="text-2xl font-semibold">{submissions.length}</h2>
            <p className="text-foreground">Total Responses</p>
          </div>
          <div className=" border-r border-b border-foreground flex flex-col gap-2 items-start text-foreground p-2 py-6">
            <h2 className="text-xl font-semibold">{quest?.deadline ? new Date(quest.deadline).toLocaleDateString() : "N/A"}</h2>
            <p className="text-foreground">Deadline</p>
            <p className="text-foreground">Time Left</p>
          </div>
          <div className=" border-r border-b border-foreground flex flex-col gap-1 items-start text-foreground p-2 py-4">
            <p className="text-foreground">Winner announcement</p>
            <p>24th January, 2026</p>
          </div>
          {/* Issue #341: stand-in "tip history" until a per-tip indexer endpoint exists. */}
          <div className=" border-r border-foreground flex flex-col gap-2 items-start text-foreground p-2 py-6">
            <h2 className="text-xl font-semibold">
              {tipTotal != null
                ? `${(Number(tipTotal) / 10_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM`
                : tipTotalError
                  ? "—"
                  : "…"}
            </h2>
            <p className="text-foreground">Total tips sent (on-chain)</p>
          </div>
        </div>
        {/* END OF ABOUT SURVERY SECTION  */}
        <div className="md:w-[70%] w-full">
          <div className="flex justify-normal items-center gap-6 text-foreground p-0.75 pl-2  border-b-[#241B4A] border-b">
            {["Details", "Response"].map((tab) => (
              <button
                key={tab}
                className={`border-b-2 cursor-pointer flex items-center ${
                  activeTab.toLowerCase() === tab.toLowerCase()
                    ? "border-b-[#601AFF] text-foreground"
                    : "border-transparent text-foreground"
                }`}
                onClick={() =>
                  setActiveTab(
                    tab.toLowerCase() === "details" ? "details" : "response",
                  )
                }
              >
                {tab}
                {submissions.length > 0 && tab === "Response" && (
                  <span className="brutal-border brutal-shadow bg-brutal-pink text-xs ml-2 py-1 mb-2 px-2 rounded-md ">
                    {submissions.length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div>
            {activeTab === "details" ? (
              <TaskInfo />
            ) : loading ? (
              <SkeletonList count={2} variant="submission" />
            ) : isForbidden || (!isOwner && quest && publicKey && quest.ownerAddress !== publicKey) ? (
              <EmptyState
                title="Access Restricted"
                description="You are not authorized to view submissions for this quest. Only the quest founder can view and review responses."
                icon={<ShieldAlert className="size-8 text-red-400" />}
                variant="card"
              />
            ) : submissionsError ? (
              <div className="brutal-border brutal-shadow bg-card p-6 text-center space-y-4 m-2">
                <p className="text-red-400 text-sm font-semibold">{submissionsError}</p>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="brutal-border brutal-shadow bg-brutal-cyan px-4 py-2 font-bold uppercase text-xs"
                  >
                    Retry
                  </button>
                )}
              </div>
            ) : submissions.length === 0 ? (
              <EmptyState
                title="No Submissions Yet"
                description="Responses will appear here once participants start submitting feedback to this quest."
                variant="card"
              />
            ) : (
              submissions.map((sub) => (
                <div key={sub.id}>
                  <SubmissionCard
                    submission={{ ...sub, status: getEffectiveStatus(sub) }}
                    onApprove={() => void handleApprove(sub)}
                    onReject={() => setRejectConfirm(sub.id)}
                    onTip={
                      isOwner && sub.hunterAddress
                        ? () => setTipTarget(sub)
                        : undefined
                    }
                    isApproved={approvedSubmissions.includes(sub.id)}
                    isPaying={payingId === sub.id}
                    isRejecting={rejectingId === sub.id}
                    approveDisabled={!canPay || isMissionClosed}
                    approveDisabledReason={
                      isMissionClosed
                        ? "This quest is cancelled or completed — no further payouts"
                        : isNetworkMismatch
                          ? "Switch your wallet to the correct network to pay out"
                          : !isOwner
                            ? "Only the quest founder can release a payout"
                            : undefined
                    }
                  />
                  {rejectConfirm === sub.id && (
                    <div className="mx-4 mb-4 bg-[#1A1330] border border-red-500/30  p-4">
                      <p className="text-sm text-foreground mb-3">
                        Are you sure you want to reject this submission? The
                        hunter&apos;s stake will be refunded in full.
                      </p>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Optional reason for rejection…"
                        rows={2}
                        disabled={rejectingId === sub.id}
                        className="w-full brutal-border bg-background border border-foreground  px-3 py-2 text-foreground text-sm focus:outline-none focus:border-red-400 resize-none mb-3 disabled:opacity-60"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => void handleReject(sub)}
                          disabled={rejectingId === sub.id || isMissionClosed}
                          className="bg-red-500 hover:bg-red-600 text-foreground px-4 py-2  text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {rejectingId === sub.id ? "Rejecting…" : "Confirm Reject"}
                        </button>
                        <button
                          onClick={() => { setRejectConfirm(null); setRejectReason(""); }}
                          disabled={rejectingId === sub.id}
                          className="border border-foreground hover:brutal-border bg-background text-foreground px-4 py-2  text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {tipTarget && tipTarget.hunterAddress && quest?.missionId != null && (
        <SendTipModal
          isOpen={Boolean(tipTarget)}
          onClose={() => setTipTarget(null)}
          missionId={quest.missionId}
          hunterAddress={tipTarget.hunterAddress}
          hunterName={tipTarget.user}
          onSuccess={() => setTipTarget(null)}
        />
      )}
    </div>
  );
}