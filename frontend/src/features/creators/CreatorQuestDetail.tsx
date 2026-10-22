import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CheckCircle, AlertCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton-list";
import QuestHeader from "./QuestHeader";
import SubmissionCard from "./SubmissionCard";
import TaskInfo from "./TaskInfo";
import NetworkMismatchBanner from "@/components/wallet/NetworkMismatchBanner";
import { Submission, Quest } from "@/app/hooks/useQuestData";
import { useWallet } from "@/context/WalletProvider";
import { payoutParticipantToContract } from "@/lib/soroban-client";
import { getMissionTipTotal } from "@/lib/tip-jar-client";
import { parseQuidError } from "@/lib/errorMap";
import { toast } from "@/context/ToastContext";
import SendTipModal from "@/components/creator/send-tip-modal";

type Notification = { type: "success" | "error"; message: string };

export default function CreatorQuestDetail({
  quest,
  submissions,
  questId,
  isActive = true,
  loading = false,
  error,
  onRetry,
}: {
  quest?: Quest | null;
  submissions: Submission[];
  questId?: string;
  isActive?: boolean;
  loading?: boolean;
  /** Issue #325: set when the quest itself failed to load from the API. */
  error?: string | null;
  onRetry?: () => void;
}) {
  const router = useRouter();
  const { publicKey, connected, isNetworkMismatch } = useWallet();
  const [approvedSubmissions, setApprovedSubmissions] = useState<string[]>([]);
  const [rejectedSubmissions, setRejectedSubmissions] = useState<string[]>([]);
  const [rejectConfirm, setRejectConfirm] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notification | null>(null);
  // Issue #341: send-tip modal target + the mission's running tip total.
  const [tipTarget, setTipTarget] = useState<Submission | null>(null);
  const [tipTotal, setTipTotal] = useState<bigint | null>(null);
  const [tipTotalError, setTipTotalError] = useState<string | null>(null);

  /**
   * `payout_participant` calls `mission.owner.require_auth()` on-chain, so the
   * UI blocks earlier rather than letting the founder burn a signing prompt on
   * a call that can only revert.
   */
  const isOwner = Boolean(
    connected && publicKey && quest?.ownerAddress === publicKey,
  );

  const canPay = isOwner && !isNetworkMismatch && quest?.missionId != null;

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

  const handleReject = (submissionId: string) => {
    setRejectedSubmissions((prev) => {
      if (prev.includes(submissionId)) {
        return prev.filter((id) => id !== submissionId);
      }
      return [...prev, submissionId];
    });
    setApprovedSubmissions((prev) => prev.filter((id) => id !== submissionId));
    toast.error("Submission rejected", {
      description: rejectReason
        ? `Reason: ${rejectReason}`
        : `Submission #${submissionId} marked as rejected.`,
    });
    setRejectConfirm(null);
    setRejectReason("");
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
      <div className="font-inter flex justify-between items-center w-full">
        <div className="flex flex-col justify-normal items-start gap-2 text-foreground py-6">
          <h2 className="text-2xl md:text-4xl font-bold">{quest?.title || "Quest"}</h2>
          <div className="flex gap-4 items-center text-sm md:text-base">
            <span className={`px-3 py-1 rounded-full capitalize ${quest?.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
              {quest?.status || "unknown"}
            </span>
          </div>
        </div>
        {isActive && (
          <button
            onClick={handleEditQuest}
            className="text-sm text-[#9110FF] pr-6 cursor-pointer hover:text-[#b844ff] transition-colors duration-200"
          >
            Edit Quest
          </button>
        )}
      </div>

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
                    approveDisabled={!canPay}
                    approveDisabledReason={
                      isNetworkMismatch
                        ? "Switch your wallet to the correct network to pay out"
                        : !isOwner
                          ? "Only the quest founder can release a payout"
                          : undefined
                    }
                  />
                  {rejectConfirm === sub.id && (
                    <div className="mx-4 mb-4 bg-[#1A1330] border border-red-500/30  p-4">
                      <p className="text-sm text-foreground mb-3">
                        Are you sure you want to reject this submission?
                      </p>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Optional reason for rejection…"
                        rows={2}
                        className="w-full brutal-border bg-background border border-foreground  px-3 py-2 text-foreground text-sm focus:outline-none focus:border-red-400 resize-none mb-3"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleReject(sub.id)}
                          className="bg-red-500 hover:bg-red-600 text-foreground px-4 py-2  text-sm font-medium transition-colors"
                        >
                          Confirm Reject
                        </button>
                        <button
                          onClick={() => { setRejectConfirm(null); setRejectReason(""); }}
                          className="border border-foreground hover:brutal-border bg-background text-foreground px-4 py-2  text-sm transition-colors"
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