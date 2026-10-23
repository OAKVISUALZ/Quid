"use client";

import Image from "next/image";
import { Submission } from "@/app/hooks/useQuestData";
import { useState } from "react";
import { toast } from "@/context/ToastContext";
import IpfsPreview from "@/components/creator/IpfsPreview";

export default function SubmissionCard({
  submission,
  onApprove,
  onReject,
  onTip,
  isApproved,
  isPaying = false,
  isRejecting = false,
  approveDisabled = false,
  approveDisabledReason,
}: {
  submission: Submission;
  onApprove: () => void;
  onReject?: () => void;
  /** Issue #341: opens the send-tip modal for this hunter. Only offered once approved. */
  onTip?: () => void;
  isApproved?: boolean;
  /** True while the payout transaction is in flight. */
  isPaying?: boolean;
  /** True while the reject_submission transaction is in flight (issue #321). */
  isRejecting?: boolean;
  /** Blocks the approve CTA — wrong network, or not the quest founder. */
  approveDisabled?: boolean;
  /** Shown as the disabled button's tooltip. */
  approveDisabledReason?: string;
}) {
  const [selectWinner, setSelectWinner] = useState<Record<string, boolean>>({});
  const isWinnerSelected = selectWinner[submission.id] || isApproved;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-500/20 text-green-400 border border-green-500";
      case "paid":
        return "bg-emerald-500/20 text-emerald-400 border border-emerald-500";
      case "rejected":
        return "bg-red-500/20 text-red-400 border border-red-500";
      case "pending":
        return "bg-yellow-500/20 text-yellow-400 border border-yellow-500";
      default:
        return "bg-gray-500/20 text-gray-400 border border-gray-500";
    }
  };

  return (
    <div className="p-2 md:p-3">
      <div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center brutal-border brutal-shadow bg-card  p-3 md:p-4 m-2 md:m-4 gap-4 md:gap-0">
          <div className="flex flex-col gap-3 w-full md:w-auto">
            <h2 className="text-lg md:text-xl text-foreground font-medium">
              It&apos;s time to select the winners
            </h2>
            <p className="text-foreground text-xs md:text-sm flex items-center gap-2">
              Click this{" "}
              <span>
                <Image
                  src="/quest-detail/stellar-icon.png"
                  alt="Stellar"
                  width={16}
                  height={16}
                  className="size-4"
                />
              </span>{" "}
              icon to add a winner
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <h4 className="text-xs md:text-sm text-foreground">Winners selected</h4>
            <p className="text-foreground font-semibold text-lg md:text-2xl md:text-right">
              8/ <span className="text-foreground">24</span>
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center text-foreground px-2 md:px-4 gap-4 md:gap-0 w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Image
                src="/quest-detail/avatar-quid.png"
                alt={submission.user}
                width={48}
                height={48}
                className="size-10 md:size-12 rounded-full flex-shrink-0"
              />
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <p className="text-sm md:text-base font-medium truncate">{submission.user}</p>
                <p className="text-foreground text-xs md:text-sm">
                  Submitted{" "}
                  {typeof submission.date === "object"
                    ? submission.date.toLocaleDateString()
                    : submission.date}
                </p>
                <p className="text-xs md:text-sm text-gray-400 break-words">
                  {submission.content}
                </p>
                {submission.status === "rejected" && submission.rejectionReason && (
                  <p className="text-xs text-red-300">
                    Reason: {submission.rejectionReason}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 md:gap-4 flex-shrink-0">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${getStatusColor(submission.status)}`}
              >
                {submission.status}
              </span>

              {submission.status === "pending" && !isApproved && (
                <>
                  <button
                    onClick={onApprove}
                    disabled={approveDisabled || isPaying || isRejecting}
                    className="brutal-border brutal-shadow bg-brutal-pink hover:translate-x-[-1px] hover:translate-y-[-1px] text-foreground px-3 py-1  text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0"
                    title={approveDisabled ? approveDisabledReason : "Approve submission"}
                  >
                    {isPaying ? "Paying…" : "✓ Approve"}
                  </button>
                  {onReject && (
                    <button
                      onClick={onReject}
                      disabled={isPaying || isRejecting}
                      className="border border-red-500/50 text-red-400 hover:bg-red-500/10 px-3 py-1  text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      title="Reject submission"
                    >
                      {isRejecting ? "Rejecting…" : "✕ Reject"}
                    </button>
                  )}
                </>
              )}

              {submission.status === "rejected" && (
                <span className="px-3 py-1  text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/30">
                  Rejected
                </span>
              )}

              {submission.status === "paid" && (
                <span className="px-3 py-1 text-sm font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Paid
                </span>
              )}

              {(submission.status === "approved" || submission.status === "paid") && onTip && (
                <button
                  onClick={onTip}
                  className="brutal-border brutal-shadow bg-brutal-yellow hover:translate-x-[-1px] hover:translate-y-[-1px] text-background px-3 py-1 text-sm font-medium transition-colors"
                  title="Send an extra tip to this hunter"
                >
                  🎁 Tip
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  setSelectWinner((prev) => {
                    const isNowSelected = !prev[submission.id];
                    if (isNowSelected) {
                      toast.success(`Winner selected: ${submission.user}`, {
                        description: "Marked for winner reward payout.",
                      });
                    } else {
                      toast.info(`Winner deselected: ${submission.user}`);
                    }
                    return {
                      ...prev,
                      [submission.id]: isNowSelected,
                    };
                  })
                }
                className={`rounded-full p-1 md:p-2 transition-colors ${
                  isWinnerSelected
                    ? "brutal-border brutal-shadow bg-brutal-pink"
                    : "hover:opacity-80"
                }`}
                aria-label="Select as winner"
              >
                <Image
                  src="/quest-detail/stellar-icon.png"
                  alt="Select as winner"
                  width={32}
                  height={32}
                  className="size-6 md:size-8"
                />
              </button>
            </div>
          </div>

          {/* Issue #328: Show IPFS preview for submission */}
          {submission.ipfsCid && (
            <div className="px-2 md:px-4 mt-2">
              <IpfsPreview
                cid={submission.ipfsCid}
                textPayload={submission.content}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
